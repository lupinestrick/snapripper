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
      id: "scheme_lifecycle_gtd",
      name: "方案 A：GTD 消费生命周期流转架构 (Lifecycle Pipeline)",
      strategy: "按任务状态与消费生命周期流转，将待下载资源与活跃工程分流，强力促成内存瘦身与断舍离",
      tags: ["GTD流转", "强烈推荐", "告别囤积"],
      categories: [
        {
          name: "🔨 活跃工程与开发",
          description: "当前正在着手推进的软硬件刷机、代码开发与网络调试项目",
          matchDomains: ["github.com", "nodeseek.com", "right.com.cn", "metacubex.one", "blog.laoda.de", "modules.lsposed.org"],
          matchKeywords: ["openwrt", "刷机", "docker", "vps", "clash", "git"],
          targetPanelName: "🔨 活跃工程",
          color: "#3b82f6",
          createGroup: true,
        },
        {
          name: "💾 待下载转存·同人与资源",
          description: "DLsite 作品、同人音声、网盘与论坛资源，建议转存本地或书签后批量关闭",
          matchDomains: ["dlsite.com", "asmr.one", "anime-sharing.com", "laowang.vip", "otomi-games.com", "doujinstyle.com"],
          matchKeywords: ["dlsite", "asmr", "同人", "音声", "rj", "download"],
          targetPanelName: "💾 待下载归档",
          color: "#ec4899",
          createGroup: true,
        },
        {
          name: "📚 常驻参考·游戏与模组",
          description: "Galgame 批评空间评测、Minecraft 模组百科等长期高频回访知识库",
          matchDomains: ["erogamescape.dyndns.org", "mcmod.cn", "play.mcmod.cn", "think-game.com", "igg-games.com", "zodgame.xyz"],
          matchKeywords: ["erogame", "批评空间", "mcmod", "模组", "wiki", "百科"],
          targetPanelName: "📚 常驻参考",
          color: "#10b981",
          createGroup: true,
        },
        {
          name: "🥽 虚拟工坊·3D资产与空间",
          description: "Booth.pm 资产模型、VRChat 空间与 VR 魔趣",
          matchDomains: ["booth.pm", "vrchat.com", "vrmoo.net"],
          matchKeywords: ["booth", "vrchat", "avatar", "quest"],
          targetPanelName: "🥽 虚拟工坊",
          color: "#8b5cf6",
          createGroup: true,
        },
        {
          name: "📥 待读流·社交与资讯",
          description: "X.com 推特动态、Reddit 社区讨论与论坛，阅后即关",
          matchDomains: ["reddit.com", "x.com", "forum.naixi.net", "google.com"],
          matchKeywords: ["reddit", "twitter", "tweet"],
          targetPanelName: "📥 待读流",
          color: "#06b6d4",
          createGroup: false,
        },
      ],
      pros: ["专治标签囤积症，待下载和待读页面可一键批量清理", "明确区分正在做的任务与长期资料库"],
      cons: ["需要养成消费后关闭标签的断舍离习惯"],
    },
    {
      id: "scheme_matrix_group",
      name: "方案 B：任务专题折叠组架构 (Task Groups + Fast Triage)",
      strategy: "将各大重点专题打包进 Sidebery 原生可折叠 Group 组，收拢 80% 视觉高度",
      tags: ["极简视觉", "折叠整洁", "利用Sidebery特性"],
      categories: [
        {
          name: "📁 [折叠组] 固件刷机与网络配置",
          matchDomains: ["right.com.cn", "nodeseek.com"],
          matchKeywords: ["rax3000", "uboot", "刷机", "openwrt"],
          color: "#3b82f6",
          createGroup: true,
        },
        {
          name: "📁 [折叠组] Galgame 批评空间鉴赏",
          matchDomains: ["erogamescape.dyndns.org"],
          matchKeywords: ["erogamescape", "感想"],
          color: "#10b981",
          createGroup: true,
        },
        {
          name: "📁 [折叠组] Booth 3D 资产清单",
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
          name: "📁 [折叠组] 待转存音声与作品清单",
          matchDomains: ["dlsite.com", "asmr.one"],
          matchKeywords: ["dlsite", "asmr"],
          color: "#ec4899",
          createGroup: true,
        },
      ],
      pros: ["侧边栏高度骤降 80%，无需一直拉滚动条", "每个专题一键折叠或展开"],
      cons: ["长尾站点仍需归于杂项或保持根层级"],
    },
    {
      id: "scheme_domain_focus",
      name: "方案 C：核心场景与领域纵深架构 (Domain Focused Architecture)",
      strategy: "按用户核心业务领域纵向切分，清晰划分技术研发、游戏测评、二次元音画与日常工具",
      tags: ["领域垂直", "权责清晰", "分类直观"],
      categories: [
        {
          name: "💻 研发·硬件与系统工具",
          description: "代码仓库、开源工具、路由器刷机与服务器运维",
          matchDomains: ["github.com", "nodeseek.com", "right.com.cn", "metacubex.one"],
          matchKeywords: ["openwrt", "刷机", "docker", "vps", "clash"],
          targetPanelName: "💻 研发工程",
          color: "#3b82f6",
          createGroup: true,
        },
        {
          name: "🌸 二次元·同人音声与鉴赏",
          description: "DLsite 作品、同人音声、Galgame 批评空间测评",
          matchDomains: ["dlsite.com", "asmr.one", "erogamescape.dyndns.org", "anime-sharing.com"],
          matchKeywords: ["dlsite", "asmr", "批评空间", "同人"],
          targetPanelName: "🌸 二次元",
          color: "#ec4899",
          createGroup: true,
        },
        {
          name: "🎮 游戏·模组百科与工坊",
          description: "Minecraft 模组百科、Booth 3D资产与 VRChat 空间",
          matchDomains: ["mcmod.cn", "play.mcmod.cn", "booth.pm", "vrchat.com"],
          matchKeywords: ["mcmod", "booth", "vrchat", "模组"],
          targetPanelName: "🎮 游戏工坊",
          color: "#8b5cf6",
          createGroup: true,
        },
        {
          name: "🌐 综合·资讯动态与日常",
          description: "社交网络动态、社区讨论与搜索引擎",
          matchDomains: ["x.com", "reddit.com", "google.com"],
          matchKeywords: ["tweet", "reddit"],
          targetPanelName: "🌐 综合日常",
          color: "#06b6d4",
          createGroup: false,
        },
      ],
      pros: ["符合直觉分类习惯，权责分明", "易于长久维护各领域书签"],
      cons: ["各面板内仍需定期手动清理待转存页面"],
    },
  ];
}
