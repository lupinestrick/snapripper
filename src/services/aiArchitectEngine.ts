import { SideberySnapshot, SideberyTab, SideberyPanel, TabTreeNode } from "@/types/sidebery";
import {
  AIConfig,
  AIProcessedCache,
  ReorganizationScheme,
  ReorganizationCategory,
} from "@/types/ai";
import { extractDomain, isExemptUrl } from "@/utils/urlHelper";
import { sendAIChatRequest, repairJSONString, extractAndParseJSON } from "./aiService";
import { DEFAULT_AI_ARCHITECT_PROMPT } from "@/constants/aiPrompts";
import {
  reorganizeTreeIntoCategories,
  reorganizeTabsIntoPanels,
} from "./treeOperations";
import { buildTabTree, flattenTabTree } from "./snapshotParser";

/**
 * 诊断快照元数据与结构分布，生成供 AI 架构师理解的高维特征摘要
 */
export function generateSnapshotDiagnosticSummary(
  tabs: SideberyTab[],
  panels?: Record<string, SideberyPanel>
): string {
  const totalTabs = tabs.length;
  const nonExempt = tabs.filter((t) => !isExemptUrl(t.url, t.pinned));
  const exemptCount = totalTabs - nonExempt.length;

  // 1. 面板分布与空闲检测
  const panelMap: Record<string, { name: string; count: number }> = {};
  if (panels) {
    for (const [id, p] of Object.entries(panels)) {
      panelMap[id] = { name: p.name || id, count: 0 };
    }
  }

  for (const t of tabs) {
    const pId = t.panelId || "main";
    if (!panelMap[pId]) {
      panelMap[pId] = { name: pId === "main" ? "主面板" : pId, count: 0 };
    }
    panelMap[pId].count++;
  }

  const emptyPanels: string[] = [];
  const activePanels: { id: string; name: string; count: number; pct: string }[] = [];

  for (const [id, p] of Object.entries(panelMap)) {
    if (p.count === 0) {
      emptyPanels.push(p.name);
    } else {
      activePanels.push({
        id,
        name: p.name,
        count: p.count,
        pct: `${((p.count / Math.max(1, totalTabs)) * 100).toFixed(1)}%`,
      });
    }
  }

  // 2. 域名聚类分析
  const domainStats: Record<string, { count: number; titles: string[] }> = {};
  for (const t of nonExempt) {
    const d = extractDomain(t.url);
    if (!domainStats[d]) {
      domainStats[d] = { count: 0, titles: [] };
    }
    domainStats[d].count++;
    if (domainStats[d].titles.length < 3 && t.title) {
      domainStats[d].titles.push(t.title.trim().slice(0, 45));
    }
  }

  const sortedDomains = Object.entries(domainStats).sort((a, b) => b[1].count - a[1].count);
  const top25Domains = sortedDomains.slice(0, 25).map(([dom, data]) => ({
    domain: dom,
    count: data.count,
    percentage: `${((data.count / Math.max(1, nonExempt.length)) * 100).toFixed(1)}%`,
    sampleTitles: data.titles,
  }));

  const tailCount = sortedDomains.slice(25).reduce((sum, [, d]) => sum + d.count, 0);

  // 3. 树层级深度统计
  const depthDist: Record<number, number> = {};
  for (const t of tabs) {
    const lvl = t.lvl || 0;
    depthDist[lvl] = (depthDist[lvl] || 0) + 1;
  }

  return JSON.stringify(
    {
      totalTabs,
      nonExemptCount: nonExempt.length,
      exemptProtectedCount: exemptCount,
      panels: {
        activePanels,
        emptyPanelsCount: emptyPanels.length,
        emptyPanelNames: emptyPanels,
      },
      treeDepthDistribution: depthDist,
      topDomainClusters: top25Domains,
      tailSitesSummary: {
        domainCount: Math.max(0, sortedDomains.length - 25),
        totalTabs: tailCount,
      },
    },
    null,
    2
  );
}

/**
 * 与 AI 智能架构师进行对话交互：发送诊断数据与历史消息，返回自然语言回复以及结构化的重构方案
 */
export async function sendArchitectChatRequest(
  config: AIConfig,
  messages: { role: "user" | "assistant" | "system"; content: string }[],
  snapshotSummary?: string,
  customSystemPrompt?: string
): Promise<{ text: string; schemes?: ReorganizationScheme[] }> {
  const baseSystemPrompt = customSystemPrompt?.trim() || DEFAULT_AI_ARCHITECT_PROMPT;
  const fullSystemPrompt = snapshotSummary
    ? `${baseSystemPrompt}\n\n【用户当前 Sidebery 快照诊断数据 (JSON)】:\n${snapshotSummary}`
    : baseSystemPrompt;

  // 将消息历史拼接为清晰上下文
  let promptText = "";
  for (const m of messages) {
    const rolePrefix = m.role === "user" ? "用户:" : m.role === "assistant" ? "架构师:" : "系统:";
    promptText += `${rolePrefix} ${m.content}\n\n`;
  }

  const rawResponse = await sendAIChatRequest(config, fullSystemPrompt, promptText.trim());

  // 从响应中提取 ```json [ ... ] ``` 代码块
  let schemes: ReorganizationScheme[] | undefined = undefined;
  const jsonMatch = rawResponse.match(/```(?:json)?\s*(\[\s*\{[\s\S]*\}\s*\])\s*```/);

  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (Array.isArray(parsed) && parsed.length > 0) {
        schemes = normalizeSchemes(parsed);
      }
    } catch {
      try {
        const repaired = repairJSONString(jsonMatch[1]);
        const parsed = JSON.parse(repaired);
        if (Array.isArray(parsed) && parsed.length > 0) {
          schemes = normalizeSchemes(parsed);
        }
      } catch {}
    }
  }

  // 清洗回复文本，移除冗余的原始 JSON 代码块，使聊天气泡保持极高可读性
  const cleanedText = rawResponse
    .replace(/```(?:json)?\s*\[\s*\{[\s\S]*\}\s*\]\s*```/, "")
    .trim();

  return {
    text: cleanedText || "我已经为你分析了快照结构并生成了重构方案，请查看下方推荐卡片：",
    schemes,
  };
}

/**
 * 校验并规范化重构方案对象
 */
function normalizeSchemes(rawList: any[]): ReorganizationScheme[] {
  return rawList.map((item, idx) => {
    const id = item.id || `scheme_${idx + 1}`;
    const name = String(item.name || `重构方案 ${idx + 1}`).trim();
    const strategy = String(item.strategy || "智能分类重构").trim();
    const tags = Array.isArray(item.tags) ? item.tags.map(String) : [];
    const pros = Array.isArray(item.pros) ? item.pros.map(String) : [];
    const cons = Array.isArray(item.cons) ? item.cons.map(String) : [];

    const categories: ReorganizationCategory[] = Array.isArray(item.categories)
      ? item.categories.map((c: any) => ({
          name: String(c.name || "未命名分类").trim(),
          description: c.description ? String(c.description).trim() : undefined,
          matchDomains: Array.isArray(c.matchDomains)
            ? c.matchDomains.map((d: any) => String(d).trim().toLowerCase()).filter(Boolean)
            : [],
          matchKeywords: Array.isArray(c.matchKeywords)
            ? c.matchKeywords.map((k: any) => String(k).trim()).filter(Boolean)
            : [],
          targetPanelName: c.targetPanelName ? String(c.targetPanelName).trim() : undefined,
          targetPanelId: c.targetPanelId ? String(c.targetPanelId).trim() : undefined,
          color: c.color || "#38bdf8",
          createGroup: c.createGroup ?? true,
        }))
      : [];

    return {
      id,
      name,
      strategy,
      tags,
      categories,
      pros,
      cons,
      targetMode: item.targetMode === "panel" ? "panel" : "tree",
    };
  });
}

/**
 * 将指定重构方案 (ReorganizationScheme) 直接编译应用到快照，生成 AIProcessedCache 对象
 */
export function applySchemeToSnapshot(
  rawSnapshot: SideberySnapshot,
  scheme: ReorganizationScheme,
  options?: {
    crossPanelMerge?: boolean;
    createGroupTabs?: boolean;
    targetMode?: "tree" | "panel";
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
    color: c.color || "#38bdf8",
  }));

  // 对每个标签进行规则匹配
  for (const tab of nonExemptTabs) {
    const domain = extractDomain(tab.url).toLowerCase();
    const titleLower = (tab.title || "").toLowerCase();
    const urlLower = (tab.url || "").toLowerCase();

    let matchedCategoryName: string | null = null;

    for (const cat of scheme.categories) {
      // 1. 域名精确或后缀匹配
      if (cat.matchDomains && cat.matchDomains.length > 0) {
        const domainHit = cat.matchDomains.some(
          (d) => domain === d || domain.endsWith(`.${d}`) || d.endsWith(`.${domain}`)
        );
        if (domainHit) {
          matchedCategoryName = cat.name;
          break;
        }
      }

      // 2. 关键词匹配
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
      classificationMap.set(String(tab.id), matchedCategoryName);
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
    // 树状重构
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

/**
 * 离线/开箱即用的预设架构方案（当网络未就绪或快速体验时提供）
 */
export function getFallbackSchemes(
  diagnosticTabs: SideberyTab[]
): ReorganizationScheme[] {
  return [
    {
      id: "scheme_scenario",
      name: "方案 A：场景功能驱动架构 (Domain & Scenario Driven)",
      strategy: "将无序混合的标签按生活与工作高频场景划分为 5 大独立面板，彻底终结跨面板撕裂",
      tags: ["高内聚", "推荐", "心智模型自然"],
      categories: [
        {
          name: "💻 折腾开发",
          description: "开源代码、路由器固件、VPS 与网络调试",
          matchDomains: ["github.com", "nodeseek.com", "right.com.cn", "metacubex.one", "blog.laoda.de", "modules.lsposed.org"],
          matchKeywords: ["openwrt", "刷机", "docker", "vps", "clash", "git"],
          color: "#3b82f6",
          createGroup: true,
        },
        {
          name: "🎧 同人音声与二次元",
          description: "DLsite 作品、ASMR 音频及同人社区",
          matchDomains: ["dlsite.com", "asmr.one", "anime-sharing.com", "laowang.vip", "otomi-games.com", "doujinstyle.com"],
          matchKeywords: ["dlsite", "asmr", "同人", "音声", "rj"],
          color: "#ec4899",
          createGroup: true,
        },
        {
          name: "🎮 游艺与模组空间",
          description: "Galgame 批评空间评测、Minecraft 模组百科、单机游戏攻略",
          matchDomains: ["erogamescape.dyndns.org", "mcmod.cn", "play.mcmod.cn", "think-game.com", "igg-games.com", "zodgame.xyz"],
          matchKeywords: ["erogame", "批评空间", "mcmod", "模组", "游戏"],
          color: "#10b981",
          createGroup: true,
        },
        {
          name: "🥽 虚拟工坊 (VRChat & 3D)",
          description: "VRChat 社区、好友空间、Booth 3D 模型资产",
          matchDomains: ["booth.pm", "vrchat.com", "vrmoo.net"],
          matchKeywords: ["booth", "vrchat", "avatar", "quest"],
          color: "#8b5cf6",
          createGroup: true,
        },
        {
          name: "🌐 社交与信息流",
          description: "X.com 推文关注、Reddit 讨论帖与各类社区",
          matchDomains: ["reddit.com", "x.com", "forum.naixi.net", "google.com"],
          matchKeywords: ["reddit", "twitter", "tweet"],
          color: "#06b6d4",
          createGroup: false,
        },
      ],
      pros: ["找东西极快，每个场景专注不干扰", "彻底解决跨面板零散存放的问题"],
      cons: ["同人与游戏面板的标签数量相对较大"],
    },
    {
      id: "scheme_matrix_group",
      name: "方案 B：矩阵式折叠组架构 (Matrix + Native Group)",
      strategy: "维持 3 个核心大面板，在面板内利用 Sidebery 原生可折叠 Group 组收拢 80% 视觉高度",
      tags: ["极简视觉", "折叠整洁", "利用Sidebery特性"],
      categories: [
        {
          name: "📁 [折叠组] RAX3000Q 刷机与固件",
          matchDomains: ["right.com.cn"],
          matchKeywords: ["rax3000", "uboot", "刷机", "openwrt"],
          color: "#3b82f6",
          createGroup: true,
        },
        {
          name: "📁 [折叠组] Galgame 批评空间测评",
          matchDomains: ["erogamescape.dyndns.org"],
          matchKeywords: ["erogamescape", "感想"],
          color: "#10b981",
          createGroup: true,
        },
        {
          name: "📁 [折叠组] Booth 3D 资产与模型",
          matchDomains: ["booth.pm"],
          matchKeywords: ["booth"],
          color: "#8b5cf6",
          createGroup: true,
        },
        {
          name: "📁 [折叠组] Minecraft 模组与服服百科",
          matchDomains: ["mcmod.cn", "play.mcmod.cn"],
          matchKeywords: ["mcmod"],
          color: "#f59e0b",
          createGroup: true,
        },
        {
          name: "📁 [折叠组] DLsite 同人作品合集",
          matchDomains: ["dlsite.com"],
          matchKeywords: ["dlsite"],
          color: "#ec4899",
          createGroup: true,
        },
        {
          name: "📁 [折叠组] ASMR 音频播放列表",
          matchDomains: ["asmr.one"],
          matchKeywords: ["asmr"],
          color: "#06b6d4",
          createGroup: true,
        },
      ],
      pros: ["侧边栏高度骤降 80%，无需一直滚动滚动条", "每个具体专题一键折叠或展开"],
      cons: ["长尾站点仍需归于杂项或保持根层级"],
    },
  ];
}
