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
  AIMergeReport,
  AIMergeReportItem,
  AIMergeCategorySummary,
} from "@/types/ai";
import { extractDomain, isExemptUrl } from "@/utils/urlHelper";
import {
  AIChatTurn,
  AICallOptions,
  sendAIConversationRequest,
  repairJSONString,
} from "./aiService";
import {
  DEFAULT_AI_ARCHITECT_PROMPT,
  DEFAULT_ARCHITECT_DIAGNOSIS_PROMPT,
  DEFAULT_ARCHITECT_REFINEMENT_PROMPT,
} from "@/constants/aiPrompts";
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

function tryParseSchemesCandidate(rawJson: string): ReorganizationScheme[] | undefined {
  const attempt = (input: string): ReorganizationScheme[] | undefined => {
    const parsed = JSON.parse(input);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return normalizeSchemes(parsed);
    }
    if (parsed && typeof parsed === "object") {
      if (Array.isArray(parsed.schemes) && parsed.schemes.length > 0) {
        return normalizeSchemes(parsed.schemes);
      }
      if (Array.isArray(parsed.data) && parsed.data.length > 0) {
        return normalizeSchemes(parsed.data);
      }
      if (Array.isArray(parsed.categories) && parsed.categories.length > 0) {
        return normalizeSchemes([parsed]);
      }
    }
    return undefined;
  };

  try {
    return attempt(rawJson);
  } catch {
    try {
      return attempt(repairJSONString(rawJson));
    } catch {
      return undefined;
    }
  }
}

export function extractSchemesFromAIResponse(rawResponse: string): {
  schemes?: ReorganizationScheme[];
  cleanedText: string;
} {
  // Strip <think>...</think> reasoning blocks (DeepSeek-R1 / Qwen-QwQ / Gemini Thinking)
  const withoutThink = rawResponse.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  const fenceMatches = Array.from(
    withoutThink.matchAll(/```(?:json)?\s*([\s\S]*?)\s*```/gi)
  );

  let schemes: ReorganizationScheme[] | undefined;
  let matchedRawBlock: string | null = null;

  // Prefer the last valid JSON code fence (prompt requires JSON block at the end)
  for (let i = fenceMatches.length - 1; i >= 0; i--) {
    const candidate = fenceMatches[i][1]?.trim();
    if (!candidate) continue;
    const parsed = tryParseSchemesCandidate(candidate);
    if (parsed) {
      schemes = parsed;
      matchedRawBlock = fenceMatches[i][0];
      break;
    }
  }

  if (!schemes) {
    const fallbackMatch =
      withoutThink.match(/(\[\s*\{[\s\S]*\}\s*\])/) ||
      withoutThink.match(/(\{\s*"schemes"\s*:[\s\S]*\})/);
    if (fallbackMatch?.[1]) {
      schemes = tryParseSchemesCandidate(fallbackMatch[1]);
      if (schemes) matchedRawBlock = fallbackMatch[1];
    }
  }

  const cleanedText = matchedRawBlock
    ? withoutThink.replace(matchedRawBlock, "").trim()
    : withoutThink.replace(/```(?:json)?\s*\[\s*\{[\s\S]*?\}\s*\]\s*```/g, "").trim();

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

export const ARCHITECT_DIAGNOSIS_PROMPT = DEFAULT_ARCHITECT_DIAGNOSIS_PROMPT;

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
  options?: AICallOptions & { customSystemPrompt?: string }
): Promise<{ text: string; chips: ArchitectDirectionChip[] }> {
  const clusterDigest = formatClusterReportForPrompt(contextData);
  const basePrompt = options?.customSystemPrompt?.trim() || DEFAULT_ARCHITECT_DIAGNOSIS_PROMPT;
  const fullSystemPrompt = `${basePrompt}\n\n【当前 Sidebery 快照微簇聚类摘要 (JSON)】:\n${clusterDigest}`;
  const rawResponse = await sendAIConversationRequest(
    config,
    fullSystemPrompt,
    [{ role: "user", content: "请极简犀利地诊断当前快照主要结构痛点，并给出可选整理方向。" }],
    options
  );
  const { chips, cleanedText } = extractDiagnosisChipsFromResponse(rawResponse);
  return { text: cleanedText, chips };
}

/**
 * 构建用于多轮微调的轻量方案状态骨架（还原被剥离 JSON 后的当前方案状态）
 */
export function buildSchemeStateDigest(
  schemes: ReorganizationScheme[],
  clusterReport?: ClusterCompressionReport
): string {
  const allClusterIds = new Set(clusterReport?.clusters.map((c) => c.id) || []);

  const compactSchemes = schemes.map((s) => {
    const assigned = new Set<string>();
    const categories = s.categories.map((c) => {
      const cids = c.clusterIds || [];
      cids.forEach((id) => assigned.add(id));
      return {
        name: c.name,
        clusterIds: cids,
      };
    });
    const excluded = s.excludedClusterIds || [];
    excluded.forEach((id) => assigned.add(id));
    const unassignedClusterIds = Array.from(allClusterIds).filter((id) => !assigned.has(id));

    return {
      id: s.id,
      name: s.name,
      targetMode: s.targetMode || "tree",
      categories,
      ...(excluded.length > 0 ? { excludedClusterIds: excluded } : {}),
      ...(unassignedClusterIds.length > 0 ? { unassignedClusterIds } : {}),
    };
  });

  return JSON.stringify(compactSchemes, null, 2);
}

export interface ArchitectChatOptions extends AICallOptions {
  mode?: "architect" | "refine";
  activeSchemes?: ReorganizationScheme[];
  customRefinementPrompt?: string;
}

/**
 * 与 AI 智能架构师进行原生多轮对话交互：发送全量微簇摘要、当前方案骨架（微调模式）与历史消息
 */
export async function sendArchitectChatRequest(
  config: AIConfig,
  messages: { role: "user" | "assistant" | "system"; content: string }[],
  contextData?: ClusterCompressionReport | string,
  customSystemPrompt?: string,
  options?: ArchitectChatOptions
): Promise<{ text: string; schemes?: ReorganizationScheme[] }> {
  const isRefine = options?.mode === "refine" && (options.activeSchemes?.length || 0) > 0;
  const baseSystemPrompt = isRefine
    ? options?.customRefinementPrompt?.trim() || DEFAULT_ARCHITECT_REFINEMENT_PROMPT
    : customSystemPrompt?.trim() || DEFAULT_AI_ARCHITECT_PROMPT;

  const clusterDigest =
    typeof contextData === "string"
      ? contextData
      : contextData
        ? formatClusterReportForPrompt(contextData)
        : undefined;

  const stateSection =
    isRefine && options?.activeSchemes
      ? `\n\n【当前方案状态骨架 (JSON)】:\n${buildSchemeStateDigest(
          options.activeSchemes,
          typeof contextData === "object" ? contextData : undefined
        )}`
      : "";

  const fullSystemPrompt = clusterDigest
    ? `${baseSystemPrompt}${stateSection}\n\n【当前 Sidebery 快照全量微簇聚类摘要 (JSON)】:\n${clusterDigest}`
    : `${baseSystemPrompt}${stateSection}`;

  const turns: AIChatTurn[] = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

  const rawResponse = await sendAIConversationRequest(config, fullSystemPrompt, turns, options);
  const { schemes, cleanedText } = extractSchemesFromAIResponse(rawResponse);

  return {
    text: cleanedText || "已完成微簇架构生成，请查看下方方案或微调微簇后预览 DIFF：",
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
    panelName: c.targetPanelName || c.name,
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

/**
 * 对比 AIProcessedCache 的前后快照，生成结构化合并变更报告（含每个标签的原面板 -> 目标面板/分类索引）
 */
export function buildAIMergeReport(cache: AIProcessedCache): AIMergeReport {
  const origPanels = cache.originalSnapshot.panels || {};
  const procPanels = cache.processedSnapshot.panels || {};
  const getPanelName = (pId: string, panelsObj: Record<string, any>) =>
    panelsObj[pId]?.name || (pId === "main" ? "主面板" : pId);

  const origTabPanelMap = new Map<string, string>();
  for (const win of Object.values(cache.originalSnapshot.windows || {})) {
    for (const tab of win.tabs || []) {
      origTabPanelMap.set(String(tab.id), tab.panelId || "main");
    }
  }

  const items: AIMergeReportItem[] = [];
  const catMap = new Map<
    string,
    {
      categoryName: string;
      targetPanelId: string;
      targetPanelName: string;
      tabCount: number;
      movedAcrossPanelsCount: number;
      sampleTitles: string[];
    }
  >();

  let movedAcrossPanelsCount = 0;
  let categorizedCount = 0;

  for (const win of Object.values(cache.processedSnapshot.windows || {})) {
    const tabs = win.tabs || [];
    const tabById = new Map<string, SideberyTab>();
    for (const t of tabs) {
      tabById.set(String(t.id), t);
    }

    for (const tab of tabs) {
      const idStr = String(tab.id);
      // 跳过新合成的分类/Group 占位标题节点
      if (idStr.startsWith("group_") || idStr.startsWith("cat_header_")) continue;

      const fromPanelId = origTabPanelMap.get(idStr) || tab.panelId || "main";
      const toPanelId = tab.panelId || "main";
      const fromPanelName = getPanelName(fromPanelId, origPanels);
      const toPanelName = getPanelName(toPanelId, procPanels);

      let toCategoryName = cache.classificationMap[idStr] || "";
      if (!toCategoryName && tab.parentId !== undefined && tab.parentId !== -1) {
        const parent = tabById.get(String(tab.parentId));
        if (parent && (parent.isGroup || String(parent.id).startsWith("cat_header_"))) {
          toCategoryName = parent.title || "";
        }
      }
      if (!toCategoryName) {
        toCategoryName = "保持原位";
      } else {
        categorizedCount++;
      }

      const moved = fromPanelId !== toPanelId;
      if (moved) movedAcrossPanelsCount++;

      items.push({
        tabId: tab.id,
        title: tab.title || tab.url,
        url: tab.url,
        domain: extractDomain(tab.url),
        fromPanelId,
        fromPanelName,
        toPanelId,
        toPanelName,
        toCategoryName,
      });

      const catKey = `${toCategoryName}::${toPanelId}`;
      const existing = catMap.get(catKey) || {
        categoryName: toCategoryName,
        targetPanelId: toPanelId,
        targetPanelName: toPanelName,
        tabCount: 0,
        movedAcrossPanelsCount: 0,
        sampleTitles: [],
      };
      existing.tabCount++;
      if (moved) existing.movedAcrossPanelsCount++;
      if (existing.sampleTitles.length < 3 && tab.title) {
        existing.sampleTitles.push(tab.title.trim().slice(0, 40));
      }
      catMap.set(catKey, existing);
    }
  }

  const categories: AIMergeCategorySummary[] = Array.from(catMap.values()).sort(
    (a, b) => b.tabCount - a.tabCount
  );

  return {
    id: `merge_report_${Date.now()}`,
    timestamp: Date.now(),
    totalTabs: items.length,
    categorizedCount,
    movedAcrossPanelsCount,
    unchangedCount: Math.max(0, items.length - categorizedCount),
    categories,
    items,
  };
}
