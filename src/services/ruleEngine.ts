import { SideberyTab, TabTreeNode, CategorizationRule, RulesSettings } from "@/types/sidebery";
import { extractDomain, isExemptUrl } from "@/utils/urlHelper";
import { isGroupTab } from "./snapshotParser";

/**
 * 契合主流互联网用户与重度浏览器使用习惯的通用分类规则集
 */
export const DEFAULT_RULES: CategorizationRule[] = [
  {
    id: "rule_dev",
    name: "💻 开发与技术",
    enabled: true,
    scope: "all",
    matchDomain: "github.com, gitlab.com, gitee.com, stackoverflow.com, npmjs.com, pypi.org, developer.mozilla.org, rust-lang.org, go.dev, vercel.com",
    matchKeyword: "github, git, repo, commit, pull request, issue, docs, api, bug, typescript, python, rust, react, vue",
    minThreshold: 2,
    color: "#3b82f6",
  },
  {
    id: "rule_ai",
    name: "🤖 AI 与大模型",
    enabled: true,
    scope: "all",
    matchDomain: "chatgpt.com, openai.com, anthropic.com, claude.ai, perplexity.ai, huggingface.co, deepseek.com, grok.com, ollama.com",
    matchKeyword: "chatgpt, claude, ai, gpt, llm, prompt, model, 提示词, 大模型",
    minThreshold: 2,
    color: "#10b981",
  },
  {
    id: "rule_media",
    name: "🎬 影音与流媒体",
    enabled: true,
    scope: "all",
    matchDomain: "youtube.com, bilibili.com, netflix.com, twitch.tv, spotify.com, nicovideo.jp, vimeo.com, soundcloud.com",
    matchKeyword: "youtube, video, watch, 视频, 播放, 直播, live, bgm, 动漫, 影视",
    minThreshold: 2,
    color: "#ef4444",
  },
  {
    id: "rule_social",
    name: "💬 社交与社区交流",
    enabled: true,
    scope: "all",
    matchDomain: "twitter.com, x.com, reddit.com, discord.com, t.me, v2ex.com, threads.net, bluesky.social, weibo.com, tieba.baidu.com",
    matchKeyword: "reddit, thread, tweet, discussion, 社区, 帖子, 论坛, 讨论, 动态",
    minThreshold: 2,
    color: "#06b6d4",
  },
  {
    id: "rule_research",
    name: "📚 知识库与学术研究",
    enabled: true,
    scope: "all",
    matchDomain: "wikipedia.org, arxiv.org, scholar.google.com, zhihu.com, medium.com, substack.com, juejin.cn, csdn.net",
    matchKeyword: "wiki, paper, research, article, doc, tutorial, 论文, 专栏, 指南, 百科",
    minThreshold: 2,
    color: "#8b5cf6",
  },
  {
    id: "rule_productivity",
    name: "💼 办公协作与文档",
    enabled: true,
    scope: "all",
    matchDomain: "notion.so, docs.google.com, drive.google.com, feishu.cn, larksuite.com, trello.com, jira.atlassian.com, linear.app, slack.com",
    matchKeyword: "notion, doc, sheet, slide, board, workspace, 文档, 表格, 协作, 任务",
    minThreshold: 2,
    color: "#f59e0b",
  },
  {
    id: "rule_shopping",
    name: "🛒 电商与购物消费",
    enabled: true,
    scope: "all",
    matchDomain: "amazon.com, taobao.com, jd.com, aliexpress.com, ebay.com, store.steampowered.com",
    matchKeyword: "buy, shop, cart, store, price, deal, 商品, 购买, 订单, 购物车",
    minThreshold: 2,
    color: "#ec4899",
  },
  {
    id: "rule_news",
    name: "📰 新闻与科技快讯",
    enabled: true,
    scope: "all",
    matchDomain: "news.ycombinator.com, techcrunch.com, theverge.com, bbc.com, 36kr.com, sspai.com",
    matchKeyword: "news, daily, feed, report, 资讯, 早报, 科技, 快讯",
    minThreshold: 2,
    color: "#64748b",
  },
  {
    id: "rule_design",
    name: "🎨 设计与创意灵感",
    enabled: true,
    scope: "all",
    matchDomain: "figma.com, dribbble.com, behance.net, pinterest.com, artstation.com, unsplash.com",
    matchKeyword: "design, figma, ui, ux, inspiration, illustration, 设计, 画板, 素材",
    minThreshold: 2,
    color: "#f97316",
  },
];

export const RULE_PRESETS: Record<string, { name: string; description: string; rules: CategorizationRule[] }> = {
  general: {
    name: "🌐 互联网通用日常习惯",
    description: "涵盖社交、视频、新闻、购物、办公、知识库等主流场景",
    rules: DEFAULT_RULES,
  },
  developer: {
    name: "💻 程序员/开发者专注",
    description: "侧重代码托管、技术规范、API文档、AI 助手、Issue 追踪",
    rules: [
      DEFAULT_RULES[0], // Dev
      DEFAULT_RULES[1], // AI
      DEFAULT_RULES[4], // Research
      DEFAULT_RULES[5], // Productivity
      DEFAULT_RULES[7], // News
    ],
  },
  student_research: {
    name: "📚 学者与深度研究",
    description: "侧重学术论文、维基百科、文献检索与笔记管理",
    rules: [
      DEFAULT_RULES[4], // Research
      DEFAULT_RULES[1], // AI
      DEFAULT_RULES[5], // Productivity
      DEFAULT_RULES[7], // News
    ],
  },
  media_entertainment: {
    name: "🎬 影音生活与娱乐",
    description: "侧重长短视频、流媒体、社交讨论、音乐与社区分享",
    rules: [
      DEFAULT_RULES[2], // Media
      DEFAULT_RULES[3], // Social
      DEFAULT_RULES[6], // Shopping
      DEFAULT_RULES[8], // Design
    ],
  },
};

export const DEFAULT_RULES_SETTINGS: RulesSettings = {
  treatExistingGroupsAsUnit: true,
  defaultMinThreshold: 2,
  rules: DEFAULT_RULES,
};

export function matchTabWithRule(tab: SideberyTab, rule: CategorizationRule): boolean {
  if (!rule.enabled) return false;

  // Scope check
  if (rule.scope === "panel" && rule.targetScopeId && tab.panelId !== rule.targetScopeId) {
    return false;
  }
  if (rule.scope === "container" && rule.targetScopeId && tab.containerId !== rule.targetScopeId) {
    return false;
  }

  // Domain check
  if (rule.matchDomain) {
    const domains = rule.matchDomain.split(",").map((d) => d.trim().toLowerCase()).filter(Boolean);
    const tabDomain = extractDomain(tab.url).toLowerCase();
    for (const d of domains) {
      if (tabDomain === d || tabDomain.endsWith(`.${d}`)) {
        return true;
      }
    }
  }

  // Keyword check in title or URL
  if (rule.matchKeyword) {
    const keywords = rule.matchKeyword.split(",").map((k) => k.trim().toLowerCase()).filter(Boolean);
    const titleLower = (tab.title || "").toLowerCase();
    const urlLower = (tab.url || "").toLowerCase();
    for (const k of keywords) {
      if (titleLower.includes(k) || urlLower.includes(k)) {
        return true;
      }
    }
  }

  return false;
}

export function applyRulesToTreeNodes(
  nodes: TabTreeNode[],
  settings: RulesSettings,
  extensionBaseUrl = "moz-extension://sidebery-placeholder"
): {
  newNodes: TabTreeNode[];
  matchedCount: number;
  groupsCreated: number;
} {
  const activeRules = settings.rules.filter((r) => r.enabled);
  if (activeRules.length === 0) {
    return { newNodes: nodes, matchedCount: 0, groupsCreated: 0 };
  }

  // Group candidate nodes: collect root nodes or nodes to cluster
  const ruleBuckets = new Map<string, { rule: CategorizationRule; nodes: TabTreeNode[] }>();
  for (const rule of activeRules) {
    ruleBuckets.set(rule.id, { rule, nodes: [] });
  }

  const unassignedNodes: TabTreeNode[] = [];
  let matchedCount = 0;

  for (const node of nodes) {
    // Check if node is exempt (pinned, etc.)
    if (node.isPinned || isExemptUrl(node.tab.url, node.tab.pinned)) {
      unassignedNodes.push(node);
      continue;
    }

    // Check if already a group and setting says treat as unit
    if (node.isGroup && settings.treatExistingGroupsAsUnit) {
      unassignedNodes.push(node);
      continue;
    }

    // Match against rules in priority order
    let matched = false;
    for (const rule of activeRules) {
      if (matchTabWithRule(node.tab, rule)) {
        ruleBuckets.get(rule.id)!.nodes.push(node);
        matched = true;
        matchedCount += 1;
        break;
      }
    }

    if (!matched) {
      unassignedNodes.push(node);
    }
  }

  const resultNodes: TabTreeNode[] = [];
  let groupsCreated = 0;

  // Build group headers for rules that meet threshold
  for (const [_, { rule, nodes: matchedNodes }] of ruleBuckets.entries()) {
    const threshold = rule.minThreshold || settings.defaultMinThreshold || 2;

    if (matchedNodes.length >= threshold) {
      groupsCreated += 1;
      const groupId = `group_rule_${rule.id}_${Date.now()}`;
      const groupTabUrl = `${extensionBaseUrl}/sidebery/group.html#${encodeURIComponent(rule.name)}`;

      const groupTab: SideberyTab = {
        id: groupId,
        panelId: matchedNodes[0]?.tab.panelId || "main",
        parentId: -1,
        lvl: 0,
        title: rule.name,
        url: groupTabUrl,
        folded: true,
        isGroup: true,
        customColor: rule.color,
      };

      // Wrap matched nodes as children with depth + 1
      const children = matchedNodes.map((childNode) => {
        return {
          ...childNode,
          depth: 1,
          tab: {
            ...childNode.tab,
            parentId: groupId,
            lvl: 1,
          },
        };
      });

      resultNodes.push({
        id: groupId,
        tab: groupTab,
        children,
        depth: 0,
        isGroup: true,
        categoryName: rule.name,
      });
    } else {
      // Threshold not met, keep nodes unassigned
      unassignedNodes.push(...matchedNodes);
    }
  }

  // Append remaining unassigned nodes
  resultNodes.push(...unassignedNodes);

  return {
    newNodes: resultNodes,
    matchedCount,
    groupsCreated,
  };
}

export function deduplicateTreeNodes(nodes: TabTreeNode[]): {
  newNodes: TabTreeNode[];
  removedCount: number;
} {
  const seenUrls = new Set<string>();
  let removedCount = 0;

  function processList(list: TabTreeNode[]): TabTreeNode[] {
    const filtered: TabTreeNode[] = [];

    for (const node of list) {
      if (node.isGroup) {
        const cleanedChildren = processList(node.children);
        filtered.push({
          ...node,
          children: cleanedChildren,
        });
        continue;
      }

      const normalized = (node.tab.url || "").replace(/#.*$/, "").trim();
      if (!normalized || isExemptUrl(normalized, node.tab.pinned)) {
        filtered.push(node);
        continue;
      }

      if (seenUrls.has(normalized)) {
        removedCount += 1;
        continue;
      }

      seenUrls.add(normalized);
      const cleanedChildren = processList(node.children);
      filtered.push({
        ...node,
        children: cleanedChildren,
      });
    }

    return filtered;
  }

  return {
    newNodes: processList(nodes),
    removedCount,
  };
}
