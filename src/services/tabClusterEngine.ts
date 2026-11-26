import { SideberyPanel, SideberyTab, TabTreeNode } from "@/types/sidebery";
import {
  ClusterCohesionReason,
  ClusterCompressionReport,
  ClusterGranularity,
  TabMicroCluster,
} from "@/types/ai";
import { extractDomain, isExemptUrl } from "@/utils/urlHelper";
import { buildTabTree, getGroupTitle, isGroupTab } from "./snapshotParser";

const STOPWORDS = new Set([
  "http",
  "https",
  "www",
  "html",
  "htm",
  "php",
  "jsp",
  "asp",
  "aspx",
  "com",
  "org",
  "net",
  "edu",
  "gov",
  "index",
  "page",
  "home",
  "login",
  "signup",
  "search",
  "watch",
  "video",
  "post",
  "thread",
  "topic",
  "article",
  "docs",
  "wiki",
  "blog",
  "the",
  "and",
  "for",
  "with",
  "from",
  "that",
  "this",
  "you",
  "are",
  "not",
  "new",
  "all",
  "untitled",
  "首页",
  "官网",
  "官方",
  "登录",
  "注册",
  "教程",
  "指南",
  "讨论",
  "分享",
  "页面",
  "第",
  "页",
]);

interface AtomicClusterUnit {
  tabIds: string[];
  tabs: SideberyTab[];
  domains: string[];
  titles: string[];
  panelIds: string[];
  tokens: string[];
  cohesionReason: ClusterCohesionReason;
  preferredLabel?: string;
  lockSubtree: boolean;
}

/**
 * 轻量中英日分词器：提取 ASCII 词元与 CJK 词段，用于无依赖本地语义相似度聚类
 */
export function tokenizeTabText(text: string): string[] {
  if (!text) return [];
  const normalized = text.toLowerCase();
  const tokens: string[] = [];

  // 1. ASCII / alphanumeric terms (length >= 2)
  const asciiMatches = normalized.match(/[a-z0-9][a-z0-9_-]{1,24}/g) || [];
  for (const w of asciiMatches) {
    if (!STOPWORDS.has(w) && !/^\d+$/.test(w)) {
      tokens.push(w);
    }
  }

  // 2. CJK contiguous runs -> whole word (if <= 4 chars) or 2-char segments
  const cjkRuns = normalized.match(/[\u4e00-\u9fff\u3040-\u30ff\u31f0-\u31ff]{2,}/g) || [];
  for (const run of cjkRuns) {
    if (run.length <= 4) {
      if (!STOPWORDS.has(run)) tokens.push(run);
    } else {
      for (let i = 0; i < run.length - 1; i += 2) {
        const seg = run.slice(i, i + 2);
        if (!STOPWORDS.has(seg)) tokens.push(seg);
      }
      if (run.length % 2 === 1) {
        const tailSeg = run.slice(run.length - 2);
        if (!STOPWORDS.has(tailSeg)) tokens.push(tailSeg);
      }
    }
  }

  return Array.from(new Set(tokens));
}

function extractPathBucket(url: string, domain: string, granularity: ClusterGranularity): string {
  if (granularity === "coarse") return domain;
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments.length === 0) return domain;

    // 针对高聚合多项目平台提取二级语义前缀
    if (domain === "github.com" && segments.length >= 1) {
      return `${domain}/${segments[0].toLowerCase()}`;
    }
    if ((domain === "reddit.com" || domain.endsWith(".reddit.com")) && segments[0] === "r" && segments[1]) {
      return `reddit.com/r/${segments[1].toLowerCase()}`;
    }
    if (granularity === "fine" && segments[0] && segments[0].length <= 24) {
      return `${domain}/${segments[0].toLowerCase()}`;
    }
    return domain;
  } catch {
    return domain;
  }
}

function collectSubtreeTabs(node: TabTreeNode): SideberyTab[] {
  const result: SideberyTab[] = [node.tab];
  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      result.push(...collectSubtreeTabs(child));
    }
  }
  return result;
}

function isTabProtectedExempt(tab: SideberyTab): boolean {
  if (isGroupTab(tab)) return false;
  return isExemptUrl(tab.url, tab.pinned);
}

function computeTopKeywords(units: AtomicClusterUnit[], limit = 5): string[] {
  const freq = new Map<string, number>();
  for (const u of units) {
    for (const tok of u.tokens) {
      freq.set(tok, (freq.get(tok) || 0) + 1);
    }
  }
  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([k]) => k);
}

function computeCosineSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersect = 0;
  for (const item of setA) {
    if (setB.has(item)) intersect++;
  }
  return intersect / Math.sqrt(setA.size * setB.size);
}

function buildClusterLabel(
  reason: ClusterCohesionReason,
  domains: string[],
  keywords: string[],
  sampleTitles: string[],
  preferredLabel?: string
): string {
  if (preferredLabel) return preferredLabel;

  if (reason === "tail_misc") {
    const kw = keywords.slice(0, 2).join(" / ");
    return kw ? `长尾归集 · ${kw}` : `长尾归集 (${domains.slice(0, 2).join(", ")})`;
  }

  const primaryDomain = domains[0] || "mixed";
  const topKws = keywords
    .filter((k) => !primaryDomain.includes(k))
    .slice(0, 2);

  if (reason === "semantic_topic" && topKws.length > 0) {
    return `专题：${topKws.join(" / ")}`;
  }
  if (topKws.length > 0) {
    return `${primaryDomain} · ${topKws.join(" / ")}`;
  }
  if (sampleTitles[0]) {
    return `${primaryDomain} · ${sampleTitles[0].slice(0, 20)}`;
  }
  return primaryDomain;
}

function mergeUnitsToCluster(
  units: AtomicClusterUnit[],
  reasonOverride?: ClusterCohesionReason,
  preferredLabel?: string
): Omit<TabMicroCluster, "id"> {
  const tabIdSet = new Set<string>();
  const domainCounts = new Map<string, number>();
  const panelIdSet = new Set<string>();
  const sampleTitles: string[] = [];
  const seenTitles = new Set<string>();

  for (const u of units) {
    for (const id of u.tabIds) tabIdSet.add(id);
    for (const d of u.domains) domainCounts.set(d, (domainCounts.get(d) || 0) + 1);
    for (const p of u.panelIds) panelIdSet.add(p);
    for (const t of u.titles) {
      const clean = t.trim().slice(0, 48);
      if (clean && !seenTitles.has(clean) && sampleTitles.length < 4) {
        seenTitles.add(clean);
        sampleTitles.push(clean);
      }
    }
  }

  const sortedDomains = Array.from(domainCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([d]) => d)
    .slice(0, 4);

  const keywords = computeTopKeywords(units, 5);
  const reason = reasonOverride || units[0]?.cohesionReason || "domain_path";
  const labelHint = buildClusterLabel(
    reason,
    sortedDomains,
    keywords,
    sampleTitles,
    preferredLabel || units[0]?.preferredLabel
  );

  return {
    labelHint,
    tabIds: Array.from(tabIdSet),
    tabCount: tabIdSet.size,
    domains: sortedDomains,
    sampleTitles,
    sourcePanelIds: Array.from(panelIdSet),
    sourcePanelNames: [],
    cohesionReason: reason,
    keywords,
  };
}

/**
 * Option B 核心：本地无监督标签页微簇聚类引擎
 * 100% 覆盖非豁免标签（零长尾盲区），同时保持原生折叠组与有意义子树的内聚性。
 */
export function clusterSnapshotTabs(
  tabs: SideberyTab[],
  panels?: Record<string, SideberyPanel>,
  granularity: ClusterGranularity = "balanced"
): ClusterCompressionReport {
  const totalTabs = tabs.length;
  const panelMeta: Record<string, { name: string; count: number }> = {};

  if (panels) {
    for (const [id, p] of Object.entries(panels)) {
      panelMeta[id] = { name: p.name || id, count: 0 };
    }
  }

  const depthDist: Record<number, number> = {};
  let exemptProtectedCount = 0;

  for (const t of tabs) {
    const pId = t.panelId || "main";
    if (!panelMeta[pId]) {
      panelMeta[pId] = { name: pId === "main" ? "主面板" : pId, count: 0 };
    }
    panelMeta[pId].count++;

    const lvl = t.lvl || 0;
    depthDist[lvl] = (depthDist[lvl] || 0) + 1;

    if (isTabProtectedExempt(t)) {
      exemptProtectedCount++;
    }
  }

  const emptyPanelNames: string[] = [];
  const activePanels: { id: string; name: string; count: number; pct: string }[] = [];
  for (const [id, p] of Object.entries(panelMeta)) {
    if (p.count === 0) {
      emptyPanelNames.push(p.name);
    } else {
      activePanels.push({
        id,
        name: p.name,
        count: p.count,
        pct: `${((p.count / Math.max(1, totalTabs)) * 100).toFixed(1)}%`,
      });
    }
  }

  const nonExemptCount = Math.max(0, totalTabs - exemptProtectedCount);
  if (nonExemptCount === 0) {
    return {
      totalTabs,
      nonExemptCount: 0,
      exemptProtectedCount,
      granularity,
      clusters: [],
      compressionRatio: 0,
      emptyPanelNames,
      activePanels,
      treeDepthDistribution: depthDist,
    };
  }

  // Step 1: 构建树并拆分原子聚类单元（保留原生 Group 与小中型父子树）
  const rootNodes = buildTabTree(tabs);
  const lockedClusters: Omit<TabMicroCluster, "id">[] = [];
  const looseUnits: AtomicClusterUnit[] = [];

  const makeUnit = (tab: SideberyTab, reason: ClusterCohesionReason): AtomicClusterUnit => {
    const domain = extractDomain(tab.url);
    const title = tab.title || "";
    const tokens = tokenizeTabText(title || domain.split(".")[0] || "");
    return {
      tabIds: [String(tab.id)],
      tabs: [tab],
      domains: [domain],
      titles: title ? [title] : [],
      panelIds: [tab.panelId || "main"],
      tokens,
      cohesionReason: reason,
      lockSubtree: false,
    };
  };

  for (const root of rootNodes) {
    const subtreeTabs = collectSubtreeTabs(root).filter((t) => !isTabProtectedExempt(t));
    if (subtreeTabs.length === 0) continue;

    // 原生 Group 且含子节点，或者有子树的父页面（2~25 个标签）作为锁定微簇保留树结构
    const isNativeGroupSubtree = root.isGroup && subtreeTabs.length >= 2;
    const isCompactTreeSubtree =
      !root.isGroup && subtreeTabs.length >= 2 && subtreeTabs.length <= 25;

    if (isNativeGroupSubtree || isCompactTreeSubtree) {
      const reason: ClusterCohesionReason = isNativeGroupSubtree ? "group_subtree" : "tree_subtree";
      const allTokens = tokenizeTabText(
        subtreeTabs.map((t) => `${t.title || ""} ${extractDomain(t.url)}`).join(" ")
      );
      const domains = subtreeTabs
        .filter((t) => !isGroupTab(t))
        .map((t) => extractDomain(t.url));
      const titles = subtreeTabs
        .filter((t) => !isGroupTab(t))
        .map((t) => t.title || "")
        .filter(Boolean);
      const rootLabel = isNativeGroupSubtree
        ? `📁 ${getGroupTitle(root.tab)}`
        : `🌲 ${(root.tab.title || domains[0] || "子树").trim().slice(0, 28)}`;

      const unit: AtomicClusterUnit = {
        tabIds: subtreeTabs.map((t) => String(t.id)),
        tabs: subtreeTabs,
        domains: domains.length > 0 ? domains : ["group"],
        titles,
        panelIds: Array.from(new Set(subtreeTabs.map((t) => t.panelId || "main"))),
        tokens: allTokens,
        cohesionReason: reason,
        preferredLabel: rootLabel,
        lockSubtree: true,
      };
      lockedClusters.push(mergeUnitsToCluster([unit], reason, rootLabel));
    } else {
      for (const t of subtreeTabs) {
        if (!isGroupTab(t)) {
          looseUnits.push(makeUnit(t, "domain_path"));
        }
      }
    }
  }

  // Step 2: 散装节点先按 Domain (+ Path Prefix) 聚合
  const bucketMap = new Map<string, AtomicClusterUnit[]>();
  for (const u of looseUnits) {
    const domain = u.domains[0] || "other";
    const key = extractPathBucket(u.tabs[0]?.url || "", domain, granularity);
    if (!bucketMap.has(key)) bucketMap.set(key, []);
    bucketMap.get(key)!.push(u);
  }

  // 对于细粒度下仅有 1 个标签的子路径桶，温和上卷回主域名以防止过度碎片化
  const rolledUpBuckets = new Map<string, AtomicClusterUnit[]>();
  for (const [key, units] of bucketMap.entries()) {
    const domain = units[0]?.domains[0] || key;
    const targetKey = units.length === 1 && key !== domain && granularity !== "fine" ? domain : key;
    if (!rolledUpBuckets.has(targetKey)) rolledUpBuckets.set(targetKey, []);
    rolledUpBuckets.get(targetKey)!.push(...units);
  }

  // Step 3: 跨域名语义主题聚类（将小微簇/孤立节点按标题词元 Jaccard 相似度合并为跨站专题）
  const workingGroups: { units: AtomicClusterUnit[]; reason: ClusterCohesionReason }[] = [];
  const smallCandidates: AtomicClusterUnit[] = [];

  for (const units of rolledUpBuckets.values()) {
    if (units.length >= 2) {
      workingGroups.push({ units, reason: "domain_path" });
    } else {
      smallCandidates.push(...units);
    }
  }

  const simThreshold = granularity === "coarse" ? 0.2 : granularity === "fine" ? 0.35 : 0.25;
  const visited = new Array<boolean>(smallCandidates.length).fill(false);

  for (let i = 0; i < smallCandidates.length; i++) {
    if (visited[i]) continue;
    visited[i] = true;
    const group: AtomicClusterUnit[] = [smallCandidates[i]];
    const anchorTokens = [...smallCandidates[i].tokens];

    for (let j = i + 1; j < smallCandidates.length; j++) {
      if (visited[j]) continue;
      const sim = computeCosineSimilarity(anchorTokens, smallCandidates[j].tokens);
      if (sim >= simThreshold) {
        visited[j] = true;
        group.push(smallCandidates[j]);
        for (const tok of smallCandidates[j].tokens) {
          if (!anchorTokens.includes(tok)) anchorTokens.push(tok);
        }
      }
    }

    workingGroups.push({
      units: group,
      reason: group.length >= 2 ? "semantic_topic" : "domain_path",
    });
  }

  // Step 4: 根据目标压缩区间收敛极小长尾孤岛，确保总微簇数在 AI 最佳阅读窗口内
  const maxClusters = granularity === "coarse" ? 20 : granularity === "fine" ? 60 : 38;
  const rawClusters: Omit<TabMicroCluster, "id">[] = [
    ...lockedClusters,
    ...workingGroups.map((g) => mergeUnitsToCluster(g.units, g.reason)),
  ];

  // 按标签数量降序排序
  rawClusters.sort((a, b) => b.tabCount - a.tabCount);

  let finalRawClusters = rawClusters;
  if (rawClusters.length > maxClusters) {
    const keepHead = rawClusters.slice(0, maxClusters - 2);
    const tailPool = rawClusters.slice(maxClusters - 2);

    // 将溢出长尾按来源主面板收敛，确保 100% tabIds 不丢失且不乱跨未知上下文
    const tailByPanel = new Map<string, Omit<TabMicroCluster, "id">[]>();
    for (const c of tailPool) {
      const pKey = c.sourcePanelIds[0] || "main";
      if (!tailByPanel.has(pKey)) tailByPanel.set(pKey, []);
      tailByPanel.get(pKey)!.push(c);
    }

    const tailClusters: Omit<TabMicroCluster, "id">[] = [];
    for (const [pId, list] of tailByPanel.entries()) {
      const mergedTabIds: string[] = [];
      const mergedDomains = new Set<string>();
      const mergedTitles: string[] = [];
      const mergedKeywords = new Set<string>();
      for (const item of list) {
        mergedTabIds.push(...item.tabIds);
        item.domains.forEach((d) => mergedDomains.add(d));
        item.sampleTitles.forEach((t) => {
          if (mergedTitles.length < 4) mergedTitles.push(t);
        });
        item.keywords.forEach((k) => {
          if (mergedKeywords.size < 5) mergedKeywords.add(k);
        });
      }
      const pName = panelMeta[pId]?.name || pId;
      const uniqueTabIds = Array.from(new Set(mergedTabIds));
      tailClusters.push({
        labelHint: `长尾聚合 · ${pName} (${list.length} 零散站点)`,
        tabIds: uniqueTabIds,
        tabCount: uniqueTabIds.length,
        domains: Array.from(mergedDomains).slice(0, 5),
        sampleTitles: mergedTitles,
        sourcePanelIds: [pId],
        sourcePanelNames: [pName],
        cohesionReason: "tail_misc",
        keywords: Array.from(mergedKeywords),
      });
    }

    finalRawClusters = [...keepHead, ...tailClusters].sort((a, b) => b.tabCount - a.tabCount);
  }

  // 赋予紧凑短 ID (c1, c2, ...) 并填充面板可读名
  const clusters: TabMicroCluster[] = finalRawClusters.map((c, idx) => ({
    ...c,
    id: `c${idx + 1}`,
    sourcePanelNames: c.sourcePanelIds.map((pid) => panelMeta[pid]?.name || pid),
  }));

  const compressionRatio =
    nonExemptCount > 0
      ? Number(((1 - clusters.length / nonExemptCount) * 100).toFixed(1))
      : 0;

  return {
    totalTabs,
    nonExemptCount,
    exemptProtectedCount,
    granularity,
    clusters,
    compressionRatio: Math.max(0, compressionRatio),
    emptyPanelNames,
    activePanels,
    treeDepthDistribution: depthDist,
  };
}

/**
 * 将压缩后的微簇报告格式化为极省 Token 的 LLM Prompt 上下文摘要，
 * 同时注入 0-Token 预计算的跨面板割裂域名与树深度摘要信号。
 */
export function formatClusterReportForPrompt(report: ClusterCompressionReport): string {
  const compactClusters = report.clusters.map((c) => ({
    id: c.id,
    label: c.labelHint,
    count: c.tabCount,
    reason: c.cohesionReason,
    domains: c.domains.slice(0, 3),
    panels: c.sourcePanelNames.slice(0, 2),
    samples: c.sampleTitles.slice(0, 3),
  }));

  // Precompute domains fragmented across 2+ panels so LLM spots split topics immediately
  const domainMap = new Map<
    string,
    { clusterIds: Set<string>; panels: Set<string>; tabCount: number }
  >();
  for (const c of report.clusters) {
    if (c.cohesionReason === "tail_misc") continue;
    for (const d of c.domains) {
      if (!d || d === "group" || d === "other") continue;
      const entry = domainMap.get(d) || {
        clusterIds: new Set<string>(),
        panels: new Set<string>(),
        tabCount: 0,
      };
      entry.clusterIds.add(c.id);
      c.sourcePanelNames.forEach((p) => entry.panels.add(p));
      entry.tabCount += c.tabCount;
      domainMap.set(d, entry);
    }
  }

  const crossPanelDomains = Array.from(domainMap.entries())
    .filter(([, v]) => v.panels.size >= 2 && v.clusterIds.size >= 2)
    .sort((a, b) => b[1].tabCount - a[1].tabCount)
    .slice(0, 8)
    .map(([domain, v]) => ({
      domain,
      tabCount: v.tabCount,
      clusterIds: Array.from(v.clusterIds),
      panels: Array.from(v.panels),
    }));

  const depthEntries = Object.entries(report.treeDepthDistribution || {});
  let maxDepth = 0;
  let deepTabCount = 0;
  for (const [lvlStr, count] of depthEntries) {
    const lvl = Number(lvlStr);
    if (!Number.isNaN(lvl)) {
      if (lvl > maxDepth) maxDepth = lvl;
      if (lvl >= 2) deepTabCount += count;
    }
  }

  return JSON.stringify(
    {
      overview: {
        totalTabs: report.totalTabs,
        nonExemptCount: report.nonExemptCount,
        exemptProtectedCount: report.exemptProtectedCount,
        clusterCount: report.clusters.length,
        compressionRatioPct: report.compressionRatio,
        maxTreeDepth: maxDepth,
        deepNestedTabs: deepTabCount,
      },
      panels: {
        activePanels: report.activePanels,
        emptyPanelNames: report.emptyPanelNames,
      },
      ...(crossPanelDomains.length > 0 ? { crossPanelDomains } : {}),
      microClusters: compactClusters,
    },
    null,
    2
  );
}
