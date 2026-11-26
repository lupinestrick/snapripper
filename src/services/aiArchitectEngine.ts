import { SideberySnapshot, SideberyTab, SideberyPanel, TabTreeNode } from "@/types/sidebery";
import {
  AIConfig,
  AIProcessedCache,
  ClusterCompressionReport,
  ClusterGranularity,
  ReorganizationScheme,
  ReorganizationCategory,
  TabMicroCluster,
  ArchitectDirectionChip,
} from "@/types/ai";
import { extractDomain, isExemptUrl } from "@/utils/urlHelper";
import {
  AIChatTurn,
  AICallOptions,
  sendAIConversationRequest,
  repairJSONString,
} from "./aiService";
import { DEFAULT_AI_ARCHITECT_PROMPT } from "@/constants/aiPrompts";
import {
  reorganizeTreeIntoCategories,
  reorganizeTabsIntoPanels,
} from "./treeOperations";
import { buildTabTree, flattenTabTree } from "./snapshotParser";
import {
  clusterSnapshotTabs,
  formatClusterReportForPrompt,
} from "./tabClusterEngine";

const CATEGORY_PALETTE = [
  "#3b82f6",
  "#ec4899",
  "#10b981",
  "#8b5cf6",
  "#f59e0b",
  "#06b6d4",
  "#6366f1",
  "#f97316",
];

/**
 * 诊断快照元数据与微簇聚类摘要，生成供 AI 架构师理解的零盲区高维摘要
 */
export function generateSnapshotDiagnosticSummary(
  tabs: SideberyTab[],
  panels?: Record<string, SideberyPanel>,
  granularity: ClusterGranularity = "balanced"
): string {
  const report = clusterSnapshotTabs(tabs, panels, granularity);
  return formatClusterReportForPrompt(report);
}

function extractSchemesFromAIResponse(rawResponse: string): {
  schemes?: ReorganizationScheme[];
  cleanedText: string;
} {
  // 剥离推理模型 <think>...</think> 避免干扰 JSON 匹配
  const withoutThink = rawResponse.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  const fencedMatch = withoutThink.match(/```(?:json)?\s*(\[\s*\{[\s\S]*?\}\s*\])\s*```/);
  const candidateJson = fencedMatch?.[1] || withoutThink.match(/(\[\s*\{[\s\S]*\}\s*\])/)?.[1];

  let schemes: ReorganizationScheme[] | undefined;
  if (candidateJson) {
    try {
      const parsed = JSON.parse(candidateJson);
      if (Array.isArray(parsed) && parsed.length > 0) {
        schemes = normalizeSchemes(parsed);
      }
    } catch {
      try {
        const repaired = repairJSONString(candidateJson);
        const parsed = JSON.parse(repaired);
        if (Array.isArray(parsed) && parsed.length > 0) {
          schemes = normalizeSchemes(parsed);
        }
      } catch {
        // ignore malformed fallback
      }
    }
  }

  const cleanedText = withoutThink
    .replace(/```(?:json)?\s*\[\s*\{[\s\S]*?\}\s*\]\s*```/g, "")
    .trim();

  return { schemes, cleanedText };
}

export const DEFAULT_ARCHITECT_DIRECTION_CHIPS: ArchitectDirectionChip[] = [
  {
    id: "cleanup",
    label: "减负清理",
    description: "归档碎片与低频页面",
    prompt: "请以「减负清理」为方向：保留核心常用分类，将零散、低频、临时查阅的微簇归拢到「待清理/临时归档」分类中，尽量减少顶层面板数量。",
  },
  {
    id: "reorg",
    label: "主题重组",
    description: "跨面板按领域重建",
    prompt: "请以「主题重组」为方向：打破原有混乱面板，按开发技术、资料文档、媒体娱乐、日常工具等清晰语义领域重新规划面板结构。",
  },
  {
    id: "incremental",
    label: "增量收纳",
    description: "保留有序面板仅收杂项",
    prompt: "请以「增量收纳」为方向：尽量尊重并沿用快照中已有的高聚合面板名称，仅把散落或未分类的微簇归并到最合适的现有分类中。",
  },
  {
    id: "rules",
    label: "规则优先",
    description: "高频域名集中便于建规则",
    prompt: "请以「规则沉淀」为方向：优先将相同高频域名（如 GitHub、B站、文档站等）对应的微簇归入独立专类，方便后续沉淀为自动化规则。",
  },
];

export const ARCHITECT_DIAGNOSIS_PROMPT = `你是一位资深的浏览器标签页信息架构师。现在请先对用户的 Sidebery 快照微簇聚类摘要进行【轻量诊断与反问引导】，暂不生成完整重构方案 JSON。

请输出：
1. 用 3~5 条简明要点总结当前标签库的分布特征、主要冗余/混乱点。
2. 提出 1~2 个关键反问，帮助用户明确整理方向。
3. 在回复末尾附带一个 \`\`\`json 代码块，包含 3~4 个贴合当前快照内容的可选整理方向数组，格式严格如下：
\`\`\`json
[
  {
    "id": "dir_1",
    "label": "简短方向名称(4~8字)",
    "description": "一句话说明效果",
    "prompt": "用户点击该方向后发送给 AI 生成完整重构方案的明确指令"
  }
]
\`\`\``;

export function extractDiagnosisChipsFromResponse(rawResponse: string): {
  chips: ArchitectDirectionChip[];
  cleanedText: string;
} {
  const withoutThink = rawResponse.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const fencedMatch = withoutThink.match(/```(?:json)?\s*(\[\s*\{[\s\S]*?\}\s*\])\s*```/);
  const candidateJson = fencedMatch?.[1] || withoutThink.match(/(\[\s*\{[\s\S]*\}\s*\])/)?.[1];

  let chips: ArchitectDirectionChip[] = [];
  if (candidateJson) {
    try {
      const parsed = JSON.parse(candidateJson);
      if (Array.isArray(parsed)) {
        chips = parsed
          .filter((item) => item && typeof item.label === "string" && typeof item.prompt === "string")
          .slice(0, 5)
          .map((item, idx) => ({
            id: String(item.id || `chip_${idx + 1}`),
            label: item.label.trim(),
            description: typeof item.description === "string" ? item.description.trim() : undefined,
            prompt: item.prompt.trim(),
          }));
      }
    } catch {
      try {
        const repaired = JSON.parse(repairJSONString(candidateJson));
        if (Array.isArray(repaired)) {
          chips = repaired
            .filter((item) => item && typeof item.label === "string" && typeof item.prompt === "string")
            .slice(0, 5)
            .map((item, idx) => ({
              id: String(item.id || `chip_${idx + 1}`),
              label: item.label.trim(),
              description: typeof item.description === "string" ? item.description.trim() : undefined,
              prompt: item.prompt.trim(),
            }));
        }
      } catch {
        // fallback below
      }
    }
  }

  const cleanedText = withoutThink
    .replace(/```(?:json)?\s*\[\s*\{[\s\S]*?\}\s*\]\s*```/g, "")
    .trim();

  return {
    chips: chips.length > 0 ? chips : DEFAULT_ARCHITECT_DIRECTION_CHIPS,
    cleanedText: cleanedText || "已完成快照摘要诊断，请选择一个整理方向继续生成重构方案：",
  };
}

/**
 * 轻量诊断与反问引导：先生成诊断简报与方向选项，不直接输出完整方案
 */
export async function sendArchitectDiagnosisRequest(
  config: AIConfig,
  contextData: ClusterCompressionReport,
  options?: AICallOptions
): Promise<{ text: string; chips: ArchitectDirectionChip[] }> {
  const clusterDigest = formatClusterReportForPrompt(contextData);
  const fullSystemPrompt = `${ARCHITECT_DIAGNOSIS_PROMPT}\n\n【当前 Sidebery 快照微簇聚类摘要 (JSON)】:\n${clusterDigest}`;
  const rawResponse = await sendAIConversationRequest(
    config,
    fullSystemPrompt,
    [{ role: "user", content: "请先帮我诊断当前快照的主要结构问题，并给出可选的整理方向。" }],
    options
  );
  const { chips, cleanedText } = extractDiagnosisChipsFromResponse(rawResponse);
  return { text: cleanedText, chips };
}

/**
 * 与 AI 智能架构师进行原生多轮对话交互：发送全量微簇摘要与历史消息，返回回复与微簇映射方案
 */
export async function sendArchitectChatRequest(
  config: AIConfig,
  messages: { role: "user" | "assistant" | "system"; content: string }[],
  contextData?: ClusterCompressionReport | string,
  customSystemPrompt?: string,
  options?: AICallOptions
): Promise<{ text: string; schemes?: ReorganizationScheme[] }> {
  const baseSystemPrompt = customSystemPrompt?.trim() || DEFAULT_AI_ARCHITECT_PROMPT;

  const clusterDigest =
    typeof contextData === "string"
      ? contextData
      : contextData
        ? formatClusterReportForPrompt(contextData)
        : undefined;

  const fullSystemPrompt = clusterDigest
    ? `${baseSystemPrompt}\n\n【当前 Sidebery 快照全量微簇聚类摘要 (JSON)】:\n${clusterDigest}`
    : baseSystemPrompt;

  const turns: AIChatTurn[] = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

  const rawResponse = await sendAIConversationRequest(config, fullSystemPrompt, turns, options);
  const { schemes, cleanedText } = extractSchemesFromAIResponse(rawResponse);

  return {
    text: cleanedText || "已完成全量微簇诊断并生成重构方案，请在下方卡片勾选调整微簇后预览 DIFF：",
    schemes,
  };
}

/**
 * 校验并规范化重构方案对象（同时支持 clusterIds 映射与规则匹配字段）
 */
export function normalizeSchemes(rawList: any[]): ReorganizationScheme[] {
  return rawList.map((item, idx) => {
    const id = item.id || `scheme_${idx + 1}`;
    const name = String(item.name || `重构方案 ${idx + 1}`).trim();
    const strategy = String(item.strategy || "微簇聚合重构").trim();
    const tags = Array.isArray(item.tags) ? item.tags.map(String) : [];
    const pros = Array.isArray(item.pros) ? item.pros.map(String) : [];
    const cons = Array.isArray(item.cons) ? item.cons.map(String) : [];
    const excludedClusterIds = Array.isArray(item.excludedClusterIds)
      ? item.excludedClusterIds.map((c: any) => String(c).trim()).filter(Boolean)
      : [];

    const categories: ReorganizationCategory[] = Array.isArray(item.categories)
      ? item.categories.map((c: any, cIdx: number) => ({
          name: String(c.name || `分组 ${cIdx + 1}`).trim(),
          description: c.description ? String(c.description).trim() : undefined,
          clusterIds: Array.isArray(c.clusterIds)
            ? Array.from(new Set(c.clusterIds.map((cid: any) => String(cid).trim()).filter(Boolean)))
            : [],
          matchDomains: Array.isArray(c.matchDomains)
            ? c.matchDomains.map((d: any) => String(d).trim().toLowerCase()).filter(Boolean)
            : [],
          matchKeywords: Array.isArray(c.matchKeywords)
            ? c.matchKeywords.map((k: any) => String(k).trim()).filter(Boolean)
            : [],
          targetPanelName: c.targetPanelName ? String(c.targetPanelName).trim() : undefined,
          targetPanelId: c.targetPanelId ? String(c.targetPanelId).trim() : undefined,
          color: c.color || CATEGORY_PALETTE[cIdx % CATEGORY_PALETTE.length],
          createGroup: c.createGroup ?? true,
        }))
      : [];

    return {
      id,
      name,
      strategy,
      tags,
      categories,
      excludedClusterIds,
      granularity: item.granularity,
      pros,
      cons,
      targetMode: item.targetMode === "panel" ? "panel" : "tree",
    };
  });
}

/**
 * 实时计算方案在当前微簇报告下的覆盖率与各分组标签数（0 Token 前端即时计算）
 */
export function computeSchemeCoverage(
  scheme: ReorganizationScheme,
  clusterReport?: ClusterCompressionReport | null
): {
  coveredTabs: number;
  totalNonExemptTabs: number;
  coveragePct: number;
  coveredClusterIds: string[];
  categoryTabCounts: Record<string, number>;
} {
  if (!clusterReport) {
    return {
      coveredTabs: 0,
      totalNonExemptTabs: 0,
      coveragePct: 0,
      coveredClusterIds: [],
      categoryTabCounts: {},
    };
  }

  const clusterById = new Map<string, TabMicroCluster>();
  for (const c of clusterReport.clusters) {
    clusterById.set(c.id, c);
  }

  const excluded = new Set(scheme.excludedClusterIds || []);
  const seenTabIds = new Set<string>();
  const coveredClusterIds: string[] = [];
  const categoryTabCounts: Record<string, number> = {};

  for (const cat of scheme.categories) {
    let catCount = 0;
    for (const cid of cat.clusterIds || []) {
      if (excluded.has(cid)) continue;
      const clu = clusterById.get(cid);
      if (!clu) continue;
      coveredClusterIds.push(cid);
      for (const tid of clu.tabIds) {
        if (!seenTabIds.has(tid)) {
          seenTabIds.add(tid);
          catCount++;
        }
      }
    }
    categoryTabCounts[cat.name] = catCount;
  }

  const totalNonExemptTabs = clusterReport.nonExemptCount;
  const coveredTabs = seenTabIds.size;
  const coveragePct =
    totalNonExemptTabs > 0 ? Math.round((coveredTabs / totalNonExemptTabs) * 100) : 0;

  return {
    coveredTabs,
    totalNonExemptTabs,
    coveragePct,
    coveredClusterIds: Array.from(new Set(coveredClusterIds)),
    categoryTabCounts,
  };
}

/**
 * 将指定重构方案 (ReorganizationScheme) 编译应用到快照，生成 AIProcessedCache
 * 优先按 Option B 的 clusterIds 精确映射全部标签，再对未覆盖标签启用域名/关键词规则兜底
 */
export function applySchemeToSnapshot(
  rawSnapshot: SideberySnapshot,
  scheme: ReorganizationScheme,
  options?: {
    crossPanelMerge?: boolean;
    createGroupTabs?: boolean;
    targetMode?: "tree" | "panel";
    clusterReport?: ClusterCompressionReport;
  }
): AIProcessedCache {
  const primaryWinId = Object.keys(rawSnapshot.windows)[0] || "1";
  const tabs = rawSnapshot.windows[primaryWinId]?.tabs || [];
  const nonExemptTabs = tabs.filter((t) => !isExemptUrl(t.url, t.pinned));

  const targetMode = options?.targetMode || scheme.targetMode || "tree";
  const crossPanelMerge = options?.crossPanelMerge ?? true;
  const createGroupTab = options?.createGroupTabs ?? true;
  const extensionBaseUrl = rawSnapshot.extensionBaseUrl || "moz-extension://sidebery-placeholder";

  const classificationMap = new Map<string, string>();
  const categoriesDef = scheme.categories.map((c, i) => ({
    id: `cat_${i}_${Date.now()}`,
    name: c.name,
    color: c.color || CATEGORY_PALETTE[i % CATEGORY_PALETTE.length],
  }));

  // 1. 构建微簇查找表（支持传入或按同粒度即时重建）
  const hasClusterIds = scheme.categories.some((c) => (c.clusterIds?.length || 0) > 0);
  const report =
    options?.clusterReport ||
    (hasClusterIds
      ? clusterSnapshotTabs(tabs, rawSnapshot.panels, scheme.granularity || "balanced")
      : undefined);

  const clusterById = new Map<string, TabMicroCluster>();
  if (report) {
    for (const c of report.clusters) {
      clusterById.set(c.id, c);
    }
  }

  const excludedClusterIds = new Set(scheme.excludedClusterIds || []);
  const excludedTabIds = new Set<string>();
  for (const exCid of excludedClusterIds) {
    const clu = clusterById.get(exCid);
    if (clu) {
      clu.tabIds.forEach((tid) => excludedTabIds.add(String(tid)));
    }
  }

  // Pass A: Option B 微簇精准映射
  for (const cat of scheme.categories) {
    for (const cid of cat.clusterIds || []) {
      if (excludedClusterIds.has(cid)) continue;
      const cluster = clusterById.get(cid);
      if (!cluster) continue;
      for (const tabId of cluster.tabIds) {
        const key = String(tabId);
        if (!classificationMap.has(key)) {
          classificationMap.set(key, cat.name);
        }
      }
    }
  }

  // Pass B: 规则匹配兜底（仅作用于未被微簇映射且未被显式排除的标签）
  for (const tab of nonExemptTabs) {
    const tabKey = String(tab.id);
    if (classificationMap.has(tabKey) || excludedTabIds.has(tabKey)) continue;

    const domain = extractDomain(tab.url).toLowerCase();
    const titleLower = (tab.title || "").toLowerCase();
    const urlLower = (tab.url || "").toLowerCase();

    let matchedCategoryName: string | null = null;
    for (const cat of scheme.categories) {
      if (cat.matchDomains && cat.matchDomains.length > 0) {
        const domainHit = cat.matchDomains.some(
          (d) => domain === d || domain.endsWith(`.${d}`) || d.endsWith(`.${domain}`)
        );
        if (domainHit) {
          matchedCategoryName = cat.name;
          break;
        }
      }

      if (cat.matchKeywords && cat.matchKeywords.length > 0) {
        const kwHit = cat.matchKeywords.some(
          (k) => titleLower.includes(k.toLowerCase()) || urlLower.includes(k.toLowerCase())
        );
        if (kwHit) {
          matchedCategoryName = cat.name;
          break;
        }
      }
    }

    if (matchedCategoryName) {
      classificationMap.set(tabKey, matchedCategoryName);
    }
  }

  // 构建重组快照
  let processedSnapshot: SideberySnapshot;
  let processedTree: TabTreeNode[];

  if (targetMode === "panel") {
    const { tabs: updatedTabs, panels: updatedPanels } = reorganizeTabsIntoPanels(
      tabs,
      classificationMap,
      categoriesDef,
      rawSnapshot.panels || {}
    );
    processedSnapshot = {
      ...rawSnapshot,
      panels: updatedPanels,
      windows: {
        ...rawSnapshot.windows,
        [primaryWinId]: { tabs: updatedTabs },
      },
    };
    processedTree = buildTabTree(updatedTabs);
  } else {
    processedTree = reorganizeTreeIntoCategories(
      buildTabTree(tabs),
      classificationMap,
      categoriesDef.map((c) => c.name),
      {
        crossPanelMerge,
        createGroupTab,
        extensionBaseUrl,
      }
    );
    const updatedTabs = flattenTabTree(processedTree);
    processedSnapshot = {
      ...rawSnapshot,
      windows: {
        ...rawSnapshot.windows,
        [primaryWinId]: { tabs: updatedTabs },
      },
    };
  }

  const categoryCounts: Record<string, number> = {};
  for (const c of scheme.categories) {
    categoryCounts[c.name] = 0;
  }
  for (const catName of classificationMap.values()) {
    categoryCounts[catName] = (categoryCounts[catName] || 0) + 1;
  }

  const total = tabs.length;
  const categorizedCount = classificationMap.size;
  const uncategorizedCount = Math.max(0, total - categorizedCount);

  return {
    originalSnapshot: rawSnapshot,
    processedSnapshot,
    timestamp: Date.now(),
    categoryNames: scheme.categories.map((c) => c.name),
    classificationMap: Object.fromEntries(classificationMap),
    summary: {
      total,
      categorizedCount,
      uncategorizedCount,
      categoryCounts,
    },
    targetMode,
  };
}

function isClusterCompressionReport(
  val: Record<string, SideberyPanel> | ClusterCompressionReport | undefined
): val is ClusterCompressionReport {
  return Boolean(
    val &&
      typeof val === "object" &&
      Array.isArray((val as ClusterCompressionReport).clusters) &&
      typeof (val as ClusterCompressionReport).nonExemptCount === "number"
  );
}

/**
 * Option B 动态离线/即时架构方案生成器：
 * 完全依据当前快照的真实微簇聚类结果生成 3 套互补架构选项（零硬编码站点）
 */
export function getFallbackSchemes(
  tabs: SideberyTab[],
  panelsOrReport?: Record<string, SideberyPanel> | ClusterCompressionReport,
  granularity: ClusterGranularity = "balanced"
): ReorganizationScheme[] {
  const report: ClusterCompressionReport = isClusterCompressionReport(panelsOrReport)
    ? panelsOrReport
    : clusterSnapshotTabs(tabs, panelsOrReport, granularity);

  const clusters = report.clusters;
  if (clusters.length === 0) {
    return [
      {
        id: "scheme_empty",
        name: "方案 A：基础默认归类",
        strategy: "当前快照暂无可聚类的非豁免标签页",
        tags: ["空快照"],
        granularity: report.granularity,
        categories: [],
        pros: ["保持现有结构"],
        cons: [],
      },
    ];
  }

  // 1. 方案 A：高频微簇主题聚合架构（前若干大簇独立成组，长尾归集）
  const topClusters = clusters.filter((c) => c.cohesionReason !== "tail_misc").slice(0, 6);
  const topClusterIdSet = new Set(topClusters.map((c) => c.id));
  const remainingClusters = clusters.filter((c) => !topClusterIdSet.has(c.id));

  const schemeACategories: ReorganizationCategory[] = topClusters.map((c, idx) => ({
    name: `📌 ${c.labelHint}`,
    description: `包含 ${c.tabCount} 个标签 (${c.domains.slice(0, 2).join(", ")})`,
    clusterIds: [c.id],
    matchDomains: c.domains.slice(0, 3),
    matchKeywords: c.keywords.slice(0, 3),
    color: CATEGORY_PALETTE[idx % CATEGORY_PALETTE.length],
    createGroup: c.tabCount >= 2,
  }));

  if (remainingClusters.length > 0) {
    schemeACategories.push({
      name: "🗂️ 其他长尾与零散专题",
      description: `聚合剩余 ${remainingClusters.length} 个小微簇，便于集中断舍离`,
      clusterIds: remainingClusters.map((c) => c.id),
      matchDomains: [],
      matchKeywords: [],
      color: "#64748b",
      createGroup: true,
    });
  }

  // 2. 方案 B：来源面板与跨面板收敛架构（按主来源面板整理 + 多面板聚合）
  const byPanel = new Map<string, TabMicroCluster[]>();
  for (const c of clusters) {
    const pName = c.sourcePanelNames[0] || "主面板";
    if (!byPanel.has(pName)) byPanel.set(pName, []);
    byPanel.get(pName)!.push(c);
  }

  const schemeBCategories: ReorganizationCategory[] = Array.from(byPanel.entries()).map(
    ([panelName, groupClusters], idx) => ({
      name: `🧭 ${panelName} · 专题簇`,
      description: `收敛原本隶属「${panelName}」的 ${groupClusters.length} 个核心微簇`,
      clusterIds: groupClusters.map((c) => c.id),
      matchDomains: Array.from(new Set(groupClusters.flatMap((c) => c.domains))).slice(0, 4),
      matchKeywords: [],
      targetPanelName: panelName,
      color: CATEGORY_PALETTE[(idx + 2) % CATEGORY_PALETTE.length],
      createGroup: true,
    })
  );

  // 3. 方案 C：原生折叠组极简收拢架构（按聚类生成动机：折叠组/子树 vs 域名专题 vs 长尾收口）
  const subtreeClusters = clusters.filter(
    (c) => c.cohesionReason === "group_subtree" || c.cohesionReason === "tree_subtree"
  );
  const topicClusters = clusters.filter(
    (c) => c.cohesionReason === "domain_path" || c.cohesionReason === "semantic_topic"
  );
  const tailClusters = clusters.filter((c) => c.cohesionReason === "tail_misc");

  const schemeCCategories: ReorganizationCategory[] = [];
  if (subtreeClusters.length > 0) {
    schemeCCategories.push({
      name: "🌲 原生树与既有折叠组",
      description: "完整保留原有的层级子树与折叠上下文",
      clusterIds: subtreeClusters.map((c) => c.id),
      matchDomains: [],
      matchKeywords: [],
      color: "#10b981",
      createGroup: true,
    });
  }
  if (topicClusters.length > 0) {
    const mid = Math.ceil(topicClusters.length / 2);
    const primaryTopics = topicClusters.slice(0, mid);
    const secondaryTopics = topicClusters.slice(mid);

    schemeCCategories.push({
      name: "📁 [折叠] 高频核心站点组",
      description: `收纳频率最高的 ${primaryTopics.length} 个域名/主题簇`,
      clusterIds: primaryTopics.map((c) => c.id),
      matchDomains: Array.from(new Set(primaryTopics.flatMap((c) => c.domains))).slice(0, 5),
      matchKeywords: [],
      color: "#3b82f6",
      createGroup: true,
    });

    if (secondaryTopics.length > 0) {
      schemeCCategories.push({
        name: "📁 [折叠] 专题扩展与语义组",
        description: `收纳其余 ${secondaryTopics.length} 个细分主题与跨站专题簇`,
        clusterIds: secondaryTopics.map((c) => c.id),
        matchDomains: Array.from(new Set(secondaryTopics.flatMap((c) => c.domains))).slice(0, 5),
        matchKeywords: [],
        color: "#8b5cf6",
        createGroup: true,
      });
    }
  }
  if (tailClusters.length > 0) {
    schemeCCategories.push({
      name: "📥 [折叠] 零散长尾待清区",
      description: "集中待筛选或待关闭的孤立页，随时一键释放内存",
      clusterIds: tailClusters.map((c) => c.id),
      matchDomains: [],
      matchKeywords: [],
      color: "#f59e0b",
      createGroup: true,
    });
  }

  return [
    {
      id: "scheme_cluster_topics",
      name: "方案 A：高频微簇主题聚合架构",
      strategy: `基于本地预聚类压缩出的 ${clusters.length} 个微簇（100% 覆盖 ${report.nonExemptCount} 个非豁免标签），将核心专题独立分组并收拢长尾`,
      tags: ["100%覆盖", "零盲区推荐", "专题清晰"],
      granularity: report.granularity,
      categories: schemeACategories,
      pros: ["直接利用真实微簇映射，未分类率为 0", "可在卡片中点击微簇随时零成本微调"],
      cons: ["若大簇过多，建议在面板模式或折叠模式下查看"],
      targetMode: "tree",
    },
    {
      id: "scheme_panel_topology",
      name: "方案 B：面板拓扑均衡重构架构",
      strategy: "尊重现有面板划分并收敛散落标签，消除碎片化孤岛，适合多工作区协同",
      tags: ["面板模式", "拓扑整理", "不破坏习惯"],
      granularity: report.granularity,
      categories: schemeBCategories,
      pros: ["保留用户原有工作区/面板心智", "同一域下的分散标签会自动靠拢"],
      cons: ["若原面板数量极少，单面板内组数依然较多"],
      targetMode: schemeBCategories.length > 1 ? "panel" : "tree",
    },
    {
      id: "scheme_folding_compact",
      name: "方案 C：Sidebery 原生折叠组高密收拢",
      strategy: "保留既有父子树结构，将散装域与语义簇全部打包为 Sidebery 原生可折叠 Group，极大压缩侧边栏高度",
      tags: ["极简视觉", "高密折叠", "保留子树"],
      granularity: report.granularity,
      categories: schemeCCategories,
      pros: ["保留所有原有树状父子上下文", "垂直滚动高度骤减，视觉极度清爽"],
      cons: ["需要展开对应折叠组才能浏览底层子标签"],
      targetMode: "tree",
    },
  ];
}
