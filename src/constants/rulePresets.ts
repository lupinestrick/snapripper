import { CategorizationRule, RulesSettings } from "@/types/sidebery";

/**
 * 契合主流互联网用户与重度浏览器使用习惯的通用分类规则集
 */
export const DEFAULT_RULES: CategorizationRule[] = [
  {
    id: "rule_dev",
    name: "💻 开发与技术",
    enabled: true,
    scope: "all",
    matchMode: "any",
    matchDomain:
      "github.com, gitlab.com, gitee.com, stackoverflow.com, npmjs.com, pypi.org, developer.mozilla.org, rust-lang.org, go.dev, vercel.com",
    matchKeyword:
      "github, git, repo, commit, pull request, issue, docs, api, bug, typescript, python, rust, react, vue",
    action: { type: "group", createGroup: true },
    minThreshold: 2,
    color: "#3b82f6",
  },
  {
    id: "rule_ai",
    name: "🤖 AI 与大模型",
    enabled: true,
    scope: "all",
    matchMode: "any",
    matchDomain:
      "chatgpt.com, openai.com, anthropic.com, claude.ai, perplexity.ai, huggingface.co, deepseek.com, grok.com, ollama.com",
    matchKeyword: "chatgpt, claude, ai, gpt, llm, prompt, model, 提示词, 大模型",
    action: { type: "group", createGroup: true },
    minThreshold: 2,
    color: "#10b981",
  },
  {
    id: "rule_media",
    name: "🎬 影音与流媒体",
    enabled: true,
    scope: "all",
    matchMode: "any",
    matchDomain:
      "youtube.com, bilibili.com, netflix.com, twitch.tv, spotify.com, nicovideo.jp, vimeo.com, soundcloud.com",
    matchKeyword: "youtube, video, watch, 视频, 播放, 直播, live, bgm, 动漫, 影视",
    action: { type: "group", createGroup: true },
    minThreshold: 2,
    color: "#ef4444",
  },
  {
    id: "rule_social",
    name: "💬 社交与社区交流",
    enabled: true,
    scope: "all",
    matchMode: "any",
    matchDomain:
      "twitter.com, x.com, reddit.com, discord.com, t.me, v2ex.com, threads.net, bluesky.social, weibo.com, tieba.baidu.com",
    matchKeyword: "reddit, thread, tweet, discussion, 社区, 帖子, 论坛, 讨论, 动态",
    action: { type: "group", createGroup: true },
    minThreshold: 2,
    color: "#06b6d4",
  },
  {
    id: "rule_research",
    name: "📚 知识库与学术研究",
    enabled: true,
    scope: "all",
    matchMode: "any",
    matchDomain:
      "wikipedia.org, arxiv.org, scholar.google.com, zhihu.com, medium.com, substack.com, juejin.cn, csdn.net",
    matchKeyword: "wiki, paper, research, article, doc, tutorial, 论文, 专栏, 指南, 百科",
    action: { type: "group", createGroup: true },
    minThreshold: 2,
    color: "#8b5cf6",
  },
  {
    id: "rule_productivity",
    name: "💼 办公协作与文档",
    enabled: true,
    scope: "all",
    matchMode: "any",
    matchDomain:
      "notion.so, docs.google.com, drive.google.com, feishu.cn, larksuite.com, trello.com, jira.atlassian.com, linear.app, slack.com",
    matchKeyword: "notion, doc, sheet, slide, board, workspace, 文档, 表格, 协作, 任务",
    action: { type: "group", createGroup: true },
    minThreshold: 2,
    color: "#f59e0b",
  },
  {
    id: "rule_shopping",
    name: "🛒 电商与购物消费",
    enabled: true,
    scope: "all",
    matchMode: "any",
    matchDomain: "amazon.com, taobao.com, jd.com, aliexpress.com, ebay.com, store.steampowered.com",
    matchKeyword: "buy, shop, cart, store, price, deal, 商品, 购买, 订单, 购物车",
    action: { type: "group", createGroup: true },
    minThreshold: 2,
    color: "#ec4899",
  },
  {
    id: "rule_news",
    name: "📰 新闻与科技快讯",
    enabled: true,
    scope: "all",
    matchMode: "any",
    matchDomain: "news.ycombinator.com, techcrunch.com, theverge.com, bbc.com, 36kr.com, sspai.com",
    matchKeyword: "news, daily, feed, report, 资讯, 早报, 科技, 快讯",
    action: { type: "group", createGroup: true },
    minThreshold: 2,
    color: "#64748b",
  },
  {
    id: "rule_design",
    name: "🎨 设计与创意灵感",
    enabled: true,
    scope: "all",
    matchMode: "any",
    matchDomain: "figma.com, dribbble.com, behance.net, pinterest.com, artstation.com, unsplash.com",
    matchKeyword: "design, figma, ui, ux, inspiration, illustration, 设计, 画板, 素材",
    action: { type: "group", createGroup: true },
    minThreshold: 2,
    color: "#f97316",
  },
];

export const RULE_PRESETS: Record<
  string,
  { name: string; description: string; rules: CategorizationRule[] }
> = {
  general: {
    name: "🌐 互联网通用日常习惯",
    description: "涵盖社交、视频、新闻、购物、办公、知识库等主流场景",
    rules: DEFAULT_RULES,
  },
  developer: {
    name: "💻 程序员/开发者专注",
    description: "侧重代码托管、技术规范、API文档、AI 助手、Issue 追踪",
    rules: [
      DEFAULT_RULES[0],
      DEFAULT_RULES[1],
      DEFAULT_RULES[4],
      DEFAULT_RULES[5],
      DEFAULT_RULES[7],
    ],
  },
  student_research: {
    name: "📚 学者与深度研究",
    description: "侧重学术论文、维基百科、文献检索与笔记管理",
    rules: [
      DEFAULT_RULES[4],
      DEFAULT_RULES[1],
      DEFAULT_RULES[5],
      DEFAULT_RULES[7],
    ],
  },
  media_entertainment: {
    name: "🎬 影音生活与娱乐",
    description: "侧重长短视频、流媒体、社交讨论、音乐与社区分享",
    rules: [
      DEFAULT_RULES[2],
      DEFAULT_RULES[3],
      DEFAULT_RULES[6],
      DEFAULT_RULES[8],
    ],
  },
};

export const DEFAULT_RULES_SETTINGS: RulesSettings = {
  treatExistingGroupsAsUnit: true,
  defaultMinThreshold: 2,
  crossPanelMerge: true,
  createGroupTabs: true,
  rules: DEFAULT_RULES,
};
