import { SideberySnapshot, SideberyTab } from "../src/types/sidebery";
import { CategoryProportion, AIConfig } from "../src/types/ai";
import { buildProcessedSnapshot, useSnapshotStore } from "../src/store/useSnapshotStore";
import { matchTabWithRule, DEFAULT_RULES_SETTINGS } from "../src/services/ruleEngine";
import { determineTargetPanelForCategory } from "../src/services/treeOperations";
import { isGroupTab, getGroupTitle } from "../src/services/snapshotParser";
import { computeSnapshotDiff } from "../src/services/diffEngine";
import {
  generateSnapshotDiagnosticSummary,
  applySchemeToSnapshot,
  getFallbackSchemes,
} from "../src/services/aiArchitectEngine";
import {
  setCookie,
  getCookie,
  deleteCookie,
  syncSnapshotCookie,
  getSnapshotCookieInfo,
  clearSnapshotCookies,
} from "../src/utils/cookieHelper";
import {
  repairJSONString,
  extractAndParseJSON,
  generateTabsSummary,
  normalizeAnthropicMessagesUrl,
  normalizeAnthropicModelsUrl,
  normalizeOpenAIChatUrl,
  normalizeOpenAIModelsUrl,
  getAPIKeySlot,
  resolveAPIKey,
  resolveBaseURL,
  resolveModel,
} from "../src/services/aiService";

export function runAIRestructureTests(): { passed: number; failed: number } {
  console.log("\n▶ Running AI Restructure & Caching Tests...");
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${msg}`);
      failed++;
    }
  }

  // --- Test Set 1: JSON Parsing & Repair Engine ---
  // 1.1 Trailing commas and comments
  const sloppyJSON = `
  {
    // Category config
    "categories": [
      { "name": "💻 开发", "ratio": 60, },
      { "name": "🎬 影音", "ratio": 40, },
    ],
    /* Action note */
    "suggestedAction": "整理分组",
  }
  `;
  const repairedObj = JSON.parse(repairJSONString(sloppyJSON));
  assert(repairedObj.categories.length === 2, "repairJSONString fixes trailing commas and comments");
  assert(repairedObj.categories[0].ratio === 60, "Repaired object preserves numbers");

  // 1.2 DeepSeek-R1 style response with <think> tag containing curly braces
  const deepseekR1Output = `
<think>
User asked to categorize tabs.
Looking at tab 1: { "id": "1", "title": "github" }.
This belongs to Development.
Let's assemble the JSON:
{ "incomplete": true
</think>
\`\`\`json
{
  "categories": [
    { "name": "💻 开发与技术", "ratio": 70, "description": "代码与开源项目" },
    { "name": "🤖 AI 工具", "ratio": 30, "description": "对话与大模型" }
  ],
  "suggestedAction": "分类并折叠"
}
\`\`\`
`;
  const parsedDeepseek = extractAndParseJSON<{ categories: any[]; suggestedAction: string }>(deepseekR1Output);
  assert(parsedDeepseek.categories?.length === 2, "extractAndParseJSON strips <think> block and parses code fence");
  assert(parsedDeepseek.categories[0].name === "💻 开发与技术", "extractAndParseJSON extracts correct category from reasoning model");

  // 1.3 Direct array response without wrapping object
  const directArrayOutput = `
Here is the category analysis:
[
  { "name": "💻 开发", "ratio": 50 },
  { "name": "💬 社交", "ratio": 50 }
]
`;
  const parsedArray = extractAndParseJSON<any[]>(directArrayOutput);
  assert(Array.isArray(parsedArray) && parsedArray.length === 2, "extractAndParseJSON parses direct array JSON");

  // 1.4 Fallback extraction for bullet point text format
  const bulletTextOutput = `
Based on your tabs, here is the distribution:
1. 💻 开发与技术 (55%)
2. 🎬 影音娱乐 (25%)
3. 💼 办公协作 (20%)
`;
  const parsedBullet = extractAndParseJSON<{ categories: any[] }>(bulletTextOutput);
  assert(parsedBullet.categories?.length === 3, "extractAndParseJSON fallback extracts bullet list ratios");
  assert(parsedBullet.categories[0].ratio === 55, "Bullet fallback parses numeric percentage correctly");

  // --- Test Set 2: generateTabsSummary Token Compression ---
  const smallTabList: SideberyTab[] = [
    { id: 1, panelId: "main", parentId: -1, lvl: 0, title: "React", url: "https://react.dev/" },
    { id: 2, panelId: "main", parentId: -1, lvl: 0, title: "Vue", url: "https://vuejs.org/" },
  ];
  const smallSummary = generateTabsSummary(smallTabList);
  const parsedSmall = JSON.parse(smallSummary);
  assert(Array.isArray(parsedSmall) && parsedSmall.length === 2, "generateTabsSummary outputs individual tabs for <= 100 tabs");

  // Large tab list (> 100 tabs)
  const largeTabList: SideberyTab[] = [];
  for (let i = 1; i <= 150; i++) {
    const domain = i <= 90 ? "github.com" : i <= 130 ? "bilibili.com" : "chatgpt.com";
    largeTabList.push({
      id: i,
      panelId: "main",
      parentId: -1,
      lvl: 0,
      title: `Tab ${i}`,
      url: `https://${domain}/page/${i}`,
    });
  }
  const largeSummary = generateTabsSummary(largeTabList);
  const parsedLarge = JSON.parse(largeSummary);
  assert(parsedLarge.totalTabs === 150, "generateTabsSummary includes totalTabs count for large snapshot");
  assert(parsedLarge.domainDistribution?.length === 3, "generateTabsSummary groups 150 tabs into 3 domain clusters");
  assert(parsedLarge.domainDistribution[0].domain === "github.com", "generateTabsSummary orders top domain first");
  assert(parsedLarge.domainDistribution[0].tabCount === 90, "generateTabsSummary counts tabs accurately per domain");

  // Test large snapshot with 70 domains (> 50 limit) to verify tail domain aggregation
  const hugeTabList: SideberyTab[] = [];
  for (let i = 0; i < 70; i++) {
    const domain = `site-${i}.com`;
    const count = i === 0 ? 100 : 10;
    for (let j = 0; j < count; j++) {
      hugeTabList.push({
        id: i * 1000 + j,
        panelId: "main",
        parentId: -1,
        lvl: 0,
        title: `Site ${i} Page ${j}`,
        url: `https://${domain}/page/${j}`,
      });
    }
  }
  const hugeSummary = generateTabsSummary(hugeTabList);
  const parsedHuge = JSON.parse(hugeSummary);
  assert(parsedHuge.totalTabs === 790, "generateTabsSummary counts totalTabs accurately for 790 tabs");
  assert(parsedHuge.domainDistribution?.length === 51, "generateTabsSummary caps at 50 domains + 1 aggregated tail domain");
  assert(parsedHuge.domainDistribution[50].domain.includes("其他长尾零散站点"), "generateTabsSummary aggregates tail domains into a single entry");
  assert(parsedHuge.domainDistribution[50].tabCount === 200, "generateTabsSummary tail entry sums remaining 20 domains correctly (20 * 10 = 200)");

  // --- Test Set 3: Snapshot Restructure & Filtering ---

  const sampleTabs: SideberyTab[] = [
    { id: 1, panelId: "main", parentId: -1, lvl: 0, title: "GitHub - Repo", url: "https://github.com/facebook/react" },
    { id: 2, panelId: "main", parentId: -1, lvl: 0, title: "ChatGPT", url: "https://chatgpt.com/" },
    { id: 3, panelId: "main", parentId: -1, lvl: 0, title: "YouTube Video", url: "https://www.youtube.com/watch?v=123" },
    { id: 4, panelId: "main", parentId: -1, lvl: 0, title: "Unmatched Site", url: "https://some-random-site.org/info" },
  ];

  const sampleSnapshot: SideberySnapshot = {
    id: "snap_test",
    time: Date.now(),
    windows: {
      "1": { tabs: sampleTabs },
    },
    panels: {
      main: { id: "main", name: "主面板", color: "toolbar" },
    },
  };

  const categories: CategoryProportion[] = [
    { id: "cat_dev", name: "💻 开发与技术", color: "#3b82f6", ratio: 50, description: "代码与开发", matchCount: 0 },
    { id: "cat_ai", name: "🤖 AI 与大模型", color: "#10b981", ratio: 50, description: "AI工具", matchCount: 0 },
  ];

  const classificationMap = new Map<string, string>([
    ["1", "💻 开发与技术"],
    ["2", "🤖 AI 与大模型"],
    // Tab 3 & 4 remain uncategorized
  ]);

  // Test 1: Tree mode processed snapshot
  const treeResult = buildProcessedSnapshot(
    sampleSnapshot,
    classificationMap,
    categories.map((c) => ({ id: c.id, name: c.name })),
    "tree"
  );

  const processedTabs = treeResult.processedSnapshot.windows["1"].tabs;
  assert(processedTabs.length >= 4, "Processed snapshot contains all original tabs plus category headers");

  const devHeader = treeResult.processedTree.find((n) => n.categoryName === "💻 开发与技术");
  assert(!!devHeader, "Found '💻 开发与技术' category header node");
  assert(devHeader?.children.some((c) => c.tab.url.includes("github.com")), "GitHub tab placed under Dev category");

  const uncatHeader = treeResult.processedTree.find((n) => n.categoryName === "未分类");
  assert(!!uncatHeader, "Found '📁 [未分类]' bucket node for unmatched tabs");
  assert(uncatHeader?.children.length === 2, "Unmatched tabs (YouTube & Unmatched Site) placed in Uncategorized bucket");

  // Test 2: Panel mode processed snapshot
  const panelResult = buildProcessedSnapshot(
    sampleSnapshot,
    classificationMap,
    categories.map((c) => ({ id: c.id, name: c.name })),
    "panel"
  );

  const panelTabs = panelResult.processedSnapshot.windows["1"].tabs;
  const githubTab = panelTabs.find((t) => t.id === 1);
  assert(githubTab?.panelId?.startsWith("panel_cat_"), "GitHub tab moved to corresponding category panel ID");

  const uncatTab = panelTabs.find((t) => t.id === 4);
  assert(uncatTab?.panelId === "main", "Uncategorized tab stayed in original main panel");

  // Test 3: Rule matching
  const devRule = {
    id: "r1",
    name: "💻 开发与技术",
    enabled: true,
    scope: "all" as const,
    matchDomain: "github.com, gitlab.com",
    matchKeyword: "git, repo",
    minThreshold: 2,
    color: "#3b82f6",
  };
  assert(matchTabWithRule(sampleTabs[0], devRule), "matchTabWithRule matches GitHub tab correctly");
  assert(!matchTabWithRule(sampleTabs[1], devRule), "matchTabWithRule rejects non-matching ChatGPT tab");

  // --- Test Set 4: Custom Category Creation & Options ---
  const customCat: CategoryProportion = {
    id: "cat_custom_1",
    name: "🎮 游戏娱乐",
    color: "#10b981",
    ratio: 25,
    description: "游戏平台与资讯",
    matchCount: 1,
    keywords: ["steam", "game", "攻略"],
    associatedRuleId: "rule_game",
  };
  assert(customCat.keywords?.includes("steam") === true, "Custom category preserves user-defined keyword tags");
  assert(customCat.associatedRuleId === "rule_game", "Custom category preserves associated rule ID");

  // --- Test Set 5: Hide 0-Tab Empty Panels Logic ---
  const panelDiffsSample = [
    { panelId: "main", panelName: "主面板", beforeTabs: [sampleTabs[0]], afterTabs: [sampleTabs[0]], beforeTree: [], afterTree: [], addedGroupsCount: 0, dedupedCount: 0 },
    { panelId: "empty_panel", panelName: "空面板", beforeTabs: [], afterTabs: [], beforeTree: [], afterTree: [], addedGroupsCount: 0, dedupedCount: 0 },
    { panelId: "new_panel", panelName: "新增面板", beforeTabs: [], afterTabs: [sampleTabs[1]], beforeTree: [], afterTree: [], addedGroupsCount: 1, dedupedCount: 0 },
  ];

  const filterNonEmpty = (diffs: typeof panelDiffsSample, hideEmpty: boolean) => {
    if (!hideEmpty) return diffs;
    const res = diffs.filter((p) => p.beforeTabs.length > 0 || p.afterTabs.length > 0);
    return res.length > 0 ? res : diffs;
  };

  const filteredPanels = filterNonEmpty(panelDiffsSample, true);
  assert(filteredPanels.length === 2, "hideEmptyPanels filters out 0-tab empty panel");
  assert(!filteredPanels.some((p) => p.panelId === "empty_panel"), "Empty panel excluded from button list");
  assert(filteredPanels.some((p) => p.panelId === "new_panel"), "Panel with tabs after process retained");

  // --- Test Set 6: Custom Provider Protocol Endpoint Normalization ---
  // Anthropic messages endpoint
  assert(
    normalizeAnthropicMessagesUrl("https://api.anthropic.com") === "https://api.anthropic.com/v1/messages",
    "normalizeAnthropicMessagesUrl appends /v1/messages to bare host"
  );
  assert(
    normalizeAnthropicMessagesUrl("https://api.anthropic.com/v1") === "https://api.anthropic.com/v1/messages",
    "normalizeAnthropicMessagesUrl appends /messages to /v1 host"
  );
  assert(
    normalizeAnthropicMessagesUrl("https://proxy.example.com/v1/messages") === "https://proxy.example.com/v1/messages",
    "normalizeAnthropicMessagesUrl preserves already complete /messages endpoint"
  );

  // Anthropic models endpoint
  assert(
    normalizeAnthropicModelsUrl("https://api.anthropic.com") === "https://api.anthropic.com/v1/models",
    "normalizeAnthropicModelsUrl appends /v1/models to bare host"
  );
  assert(
    normalizeAnthropicModelsUrl("https://api.anthropic.com/v1") === "https://api.anthropic.com/v1/models",
    "normalizeAnthropicModelsUrl appends /models to /v1 host"
  );
  assert(
    normalizeAnthropicModelsUrl("https://proxy.example.com/v1/messages") === "https://proxy.example.com/v1/models",
    "normalizeAnthropicModelsUrl converts /v1/messages to /v1/models"
  );

  // OpenAI chat endpoint
  assert(
    normalizeOpenAIChatUrl("https://api.openai.com") === "https://api.openai.com/v1/chat/completions",
    "normalizeOpenAIChatUrl appends /v1/chat/completions to bare host"
  );
  assert(
    normalizeOpenAIChatUrl("https://api.openai.com/v1") === "https://api.openai.com/v1/chat/completions",
    "normalizeOpenAIChatUrl appends /chat/completions to /v1 host"
  );
  assert(
    normalizeOpenAIChatUrl("https://proxy.example.com/v1/chat/completions") === "https://proxy.example.com/v1/chat/completions",
    "normalizeOpenAIChatUrl preserves already complete /chat/completions endpoint"
  );

  // OpenAI models endpoint
  assert(
    normalizeOpenAIModelsUrl("https://api.openai.com") === "https://api.openai.com/v1/models",
    "normalizeOpenAIModelsUrl appends /v1/models to bare host"
  );
  assert(
    normalizeOpenAIModelsUrl("https://api.openai.com/v1") === "https://api.openai.com/v1/models",
    "normalizeOpenAIModelsUrl appends /models to /v1 host"
  );
  assert(
    normalizeOpenAIModelsUrl("https://proxy.example.com/v1/chat/completions") === "https://proxy.example.com/v1/models",
    "normalizeOpenAIModelsUrl converts /v1/chat/completions to /v1/models"
  );

  // --- Test Set 7: Independent API Key Isolation Across Options ---
  assert(getAPIKeySlot("deepseek") === "deepseek", "getAPIKeySlot resolves deepseek");
  assert(getAPIKeySlot("claude") === "claude", "getAPIKeySlot resolves claude");
  assert(getAPIKeySlot("openai") === "openai", "getAPIKeySlot resolves openai");
  assert(getAPIKeySlot("gemini") === "gemini", "getAPIKeySlot resolves gemini");
  assert(getAPIKeySlot("custom", "openai") === "custom_openai", "getAPIKeySlot resolves custom_openai");
  assert(getAPIKeySlot("custom", "anthropic") === "custom_anthropic", "getAPIKeySlot resolves custom_anthropic");
  assert(getAPIKeySlot("custom") === "custom_openai", "getAPIKeySlot defaults custom without type to custom_openai");

  const multiKeyConfig: AIConfig = {
    provider: "deepseek",
    baseURL: "https://api.deepseek.com/v1",
    model: "deepseek-flash",
    apiKey: "legacy-fallback-key",
    apiKeys: {
      deepseek: "sk-deepseek-12345",
      claude: "sk-ant-claude-67890",
      openai: "sk-openai-abcde",
      gemini: "AIza-gemini-fghij",
      custom_openai: "sk-custom-openai-999",
      custom_anthropic: "sk-custom-anthropic-888",
    },
  };

  assert(resolveAPIKey(multiKeyConfig) === "sk-deepseek-12345", "resolveAPIKey returns DeepSeek key when provider is deepseek");

  const claudeConfig: AIConfig = { ...multiKeyConfig, provider: "claude", type: "anthropic" };
  assert(resolveAPIKey(claudeConfig) === "sk-ant-claude-67890", "resolveAPIKey returns Claude key independently");

  const openaiConfig: AIConfig = { ...multiKeyConfig, provider: "openai", type: "openai" };
  assert(resolveAPIKey(openaiConfig) === "sk-openai-abcde", "resolveAPIKey returns OpenAI key independently");

  const geminiConfig: AIConfig = { ...multiKeyConfig, provider: "gemini", type: "gemini" };
  assert(resolveAPIKey(geminiConfig) === "AIza-gemini-fghij", "resolveAPIKey returns Gemini key independently");

  const customOpenAIConfig: AIConfig = { ...multiKeyConfig, provider: "custom", type: "openai" };
  assert(resolveAPIKey(customOpenAIConfig) === "sk-custom-openai-999", "resolveAPIKey returns Custom OpenAI key independently");

  const customAnthropicConfig: AIConfig = { ...multiKeyConfig, provider: "custom", type: "anthropic" };
  assert(resolveAPIKey(customAnthropicConfig) === "sk-custom-anthropic-888", "resolveAPIKey returns Custom Anthropic key independently");

  // Fallback test
  const emptyKeysConfig: AIConfig = {
    provider: "claude",
    baseURL: "https://api.anthropic.com/v1",
    model: "claude-fable-5-1",
    apiKey: "sk-fallback-legacy",
  };
  assert(resolveAPIKey(emptyKeysConfig) === "sk-fallback-legacy", "resolveAPIKey falls back to legacy apiKey when apiKeys map is absent");

  // --- Test Set 8: Base URL & Model Isolation & Custome.ai Sanitization ---
  const customConfigWithStale: AIConfig = {
    provider: "custom",
    baseURL: "https://api.custome.ai/v1",
    model: "deepseek-flash",
    apiKey: "sk-test",
    type: "openai",
  };
  assert(!resolveBaseURL(customConfigWithStale).includes("api.custome.ai"), "resolveBaseURL eliminates stale api.custome.ai URL");
  assert(resolveBaseURL(customConfigWithStale) === "https://api.openai.com/v1", "resolveBaseURL defaults custom openai to standard endpoint");

  const customAnthropicWithStale: AIConfig = {
    ...customConfigWithStale,
    type: "anthropic",
  };
  assert(resolveBaseURL(customAnthropicWithStale) === "https://api.anthropic.com/v1", "resolveBaseURL defaults custom anthropic to standard endpoint");
  assert(resolveModel(customAnthropicWithStale) === "claude-3-7-sonnet-20250219", "resolveModel defaults custom anthropic to claude-3-7-sonnet");

  const customWithUserValues: AIConfig = {
    provider: "custom",
    baseURL: "https://my-proxy.com/v1",
    model: "my-custom-llm",
    apiKey: "sk-my-key",
    type: "openai",
    baseURLs: {
      custom_openai: "https://my-proxy.com/v1",
      custom_anthropic: "https://my-anthropic-proxy.com/v1",
    },
    models: {
      custom_openai: "my-custom-llm",
      custom_anthropic: "claude-custom-proxy",
    },
  };
  assert(resolveBaseURL(customWithUserValues) === "https://my-proxy.com/v1", "resolveBaseURL preserves user custom openai URL");
  assert(resolveModel(customWithUserValues) === "my-custom-llm", "resolveModel preserves user custom openai model");

  const switchedToAnthropic: AIConfig = { ...customWithUserValues, type: "anthropic" };
  assert(resolveBaseURL(switchedToAnthropic) === "https://my-anthropic-proxy.com/v1", "resolveBaseURL switches to user custom anthropic URL");
  assert(resolveModel(switchedToAnthropic) === "claude-custom-proxy", "resolveModel switches to user custom anthropic model");

  // --- Test Set 9: Cross-Panel Category Merge & Group Parsing/Generation ---
  const multiPanelTabs: SideberyTab[] = [
    { id: 101, panelId: "panel_dev", parentId: -1, lvl: 0, title: "React Docs", url: "https://react.dev" },
    { id: 102, panelId: "panel_dev", parentId: -1, lvl: 0, title: "Next.js", url: "https://nextjs.org" },
    { id: 103, panelId: "panel_dev", parentId: -1, lvl: 0, title: "TypeScript", url: "https://www.typescriptlang.org" },
    { id: 104, panelId: "main", parentId: -1, lvl: 0, title: "GitHub Repo", url: "https://github.com/facebook/react" },
    { id: 105, panelId: "panel_work", parentId: -1, lvl: 0, title: "Work Calendar", url: "https://calendar.google.com" },
  ];

  // 1. determineTargetPanelForCategory
  const devCategoryTabs = multiPanelTabs.slice(0, 4); // 3 in panel_dev, 1 in main
  assert(
    determineTargetPanelForCategory(devCategoryTabs, "main") === "panel_dev",
    "determineTargetPanelForCategory selects panel_dev as it has the most tabs (3 vs 1)"
  );

  // 2. buildProcessedSnapshot with crossPanelMerge: true
  const multiPanelSnapshot: SideberySnapshot = {
    id: "snap_multi",
    time: Date.now(),
    windows: { "1": { tabs: multiPanelTabs } },
    panels: {
      main: { id: "main", name: "主面板" },
      panel_dev: { id: "panel_dev", name: "开发" },
      panel_work: { id: "panel_work", name: "工作" },
    },
    extensionBaseUrl: "moz-extension://uuid-1234",
  };

  const multiClassificationMap = new Map<string, string>([
    ["101", "💻 开发与技术"],
    ["102", "💻 开发与技术"],
    ["103", "💻 开发与技术"],
    ["104", "💻 开发与技术"],
    ["105", "💼 办公协作与文档"],
  ]);

  const crossMergedResult = buildProcessedSnapshot(
    multiPanelSnapshot,
    multiClassificationMap,
    [
      { id: "cat_dev", name: "💻 开发与技术" },
      { id: "cat_work", name: "💼 办公协作与文档" },
    ],
    "tree",
    undefined,
    { crossPanelMerge: true, createGroupTab: true }
  );

  const crossTabs = crossMergedResult.processedSnapshot.windows["1"].tabs;
  const mergedGithubTab = crossTabs.find((t) => t.id === 104);
  assert(
    mergedGithubTab?.panelId === "panel_dev",
    "crossPanelMerge: true moves tab 104 from main to panel_dev (majority panel)"
  );

  const devGroupTab = crossTabs.find((t) => t.isGroup && t.title === "💻 开发与技术");
  assert(
    devGroupTab?.panelId === "panel_dev",
    "crossPanelMerge: true places group header tab in panel_dev"
  );
  assert(
    devGroupTab?.url.includes("uuid-1234/sidebery/group.html#"),
    "createGroupTab: true generates native Sidebery group URL with extensionBaseUrl"
  );

  // 3. buildProcessedSnapshot with crossPanelMerge: false
  const unmergedResult = buildProcessedSnapshot(
    multiPanelSnapshot,
    multiClassificationMap,
    [
      { id: "cat_dev", name: "💻 开发与技术" },
      { id: "cat_work", name: "💼 办公协作与文档" },
    ],
    "tree",
    undefined,
    { crossPanelMerge: false, createGroupTab: false }
  );

  const unmergedTabs = unmergedResult.processedSnapshot.windows["1"].tabs;
  const unmergedGithubTab = unmergedTabs.find((t) => t.id === 104);
  assert(
    unmergedGithubTab?.panelId === "main",
    "crossPanelMerge: false keeps tab 104 in its original panel (main)"
  );

  const standardHeader = unmergedTabs.find((t) => t.url?.startsWith("about:blank#category="));
  assert(
    !!standardHeader,
    "createGroupTab: false produces standard about:blank#category= header"
  );

  // 4. Group Tab parsing
  assert(
    isGroupTab({ url: "moz-extension://abc/sidebery/group.html#%E5%BC%80%E5%8F%91" }),
    "isGroupTab recognizes /sidebery/group.html"
  );
  assert(
    isGroupTab({ url: "group:DevTools" }),
    "isGroupTab recognizes group: schema"
  );
  assert(
    isGroupTab({ isGroup: true }),
    "isGroupTab recognizes tab with isGroup: true"
  );
  assert(
    getGroupTitle({ url: "moz-extension://abc/sidebery/group.html#%E5%BC%80%E5%8F%91" }) === "开发",
    "getGroupTitle extracts and decodes group name from URL hash"
  );
  assert(
    getGroupTitle({ customTitle: "我的自定义分组" }) === "我的自定义分组",
    "getGroupTitle prioritizes customTitle"
  );

  // 5. diffEngine cross-panel rule merge
  const diffTestTabs: SideberyTab[] = [
    { id: 201, panelId: "panel_dev", parentId: -1, lvl: 0, title: "GitHub 1", url: "https://github.com/repo1" },
    { id: 202, panelId: "panel_dev", parentId: -1, lvl: 0, title: "GitHub 2", url: "https://github.com/repo2" },
    { id: 203, panelId: "main", parentId: -1, lvl: 0, title: "GitHub 3", url: "https://github.com/repo3" },
  ];
  const diffSnapshot: SideberySnapshot = {
    id: "diff_snap",
    time: Date.now(),
    windows: { "1": { tabs: diffTestTabs } },
    panels: {
      main: { id: "main", name: "主面板" },
      panel_dev: { id: "panel_dev", name: "开发" },
    },
    extensionBaseUrl: "moz-extension://test",
  };

  const diffResult = computeSnapshotDiff(
    diffSnapshot,
    {
      enableDedup: false,
      enableRules: true,
      enableAICategorize: false,
      scope: "all",
      crossPanelMerge: true,
    },
    DEFAULT_RULES_SETTINGS
  );

  const finalDiffTabs = diffResult.newSnapshot.windows["1"].tabs;
  const migratedTab = finalDiffTabs.find((t) => t.id === 203);
  assert(
    migratedTab?.panelId === "panel_dev",
    "diffEngine with crossPanelMerge: true merges tab 203 into panel_dev where most GitHub tabs reside"
  );

  // --- Test Set 10: Cookie Persistence & Cache Clearing ---
  let mockCookieStorage = "";
  (global as any).document = {
    get cookie() {
      return mockCookieStorage;
    },
    set cookie(val: string) {
      const parts = val.split(";")[0].split("=");
      const key = parts[0].trim();
      const value = parts.slice(1).join("=");
      const cookies = mockCookieStorage ? mockCookieStorage.split("; ") : [];
      const filtered = cookies.filter((c) => !c.startsWith(`${key}=`));
      if (val.includes("expires=Thu, 01 Jan 1970")) {
        mockCookieStorage = filtered.join("; ");
      } else {
        filtered.push(`${key}=${value}`);
        mockCookieStorage = filtered.join("; ");
      }
    },
  };

  setCookie("test_key", "test_val");
  assert(getCookie("test_key") === "test_val", "setCookie stores and getCookie retrieves cookie");

  deleteCookie("test_key");
  assert(getCookie("test_key") === null, "deleteCookie removes cookie");

  syncSnapshotCookie("sidebery-backup-2026.json", 1153);
  const cookieInfo = getSnapshotCookieInfo();
  assert(cookieInfo !== null, "getSnapshotCookieInfo returns valid object when cache exists");
  assert(cookieInfo?.fileName === "sidebery-backup-2026.json", "syncSnapshotCookie persists correct file name");
  assert(cookieInfo?.tabCount === 1153, "syncSnapshotCookie persists correct tab count");

  clearSnapshotCookies();
  assert(getSnapshotCookieInfo() === null, "clearSnapshotCookies removes all snapshot cookie credentials");

  // Verify clearAllCache
  syncSnapshotCookie("test-session.json", 50);
  useSnapshotStore.getState().clearAllCache();
  assert(useSnapshotStore.getState().rawSnapshot === null, "clearAllCache resets rawSnapshot to null");
  assert(useSnapshotStore.getState().rootNodes.length === 0, "clearAllCache resets rootNodes to empty array");
  assert(getSnapshotCookieInfo() === null, "clearAllCache clears cookies");

  // --- Test Set 11: AI Architect Engine & Reorganization Schemes ---
  const sampleArchitectTabs: SideberyTab[] = [
    { id: "t1", url: "https://github.com/facebook/react", title: "React GitHub", panelId: "p_dev", parentId: -1 },
    { id: "t2", url: "https://dlsite.com/work/RJ123456", title: "音声作品 | DLsite", panelId: "p_main", parentId: -1 },
    { id: "t3", url: "https://erogamescape.dyndns.org/game/1", title: "批评空间评分", panelId: "p_main", parentId: -1 },
    { id: "t4", url: "https://booth.pm/items/999", title: "3D 模型 | Booth", panelId: "p_main", parentId: -1 },
    { id: "t5", url: "https://reddit.com/r/webdev", title: "Webdev on Reddit", panelId: "p_dev", parentId: -1 },
    { id: "t6", url: "about:config", title: "Firefox Config", pinned: true, panelId: "p_main", parentId: -1 },
  ];
  const samplePanels = {
    p_dev: { id: "p_dev", name: "开发面板" },
    p_main: { id: "p_main", name: "主面板" },
    p_empty: { id: "p_empty", name: "闲置空面板" },
  };

  // 11.1 Diagnostic summary
  const diagSummaryJson = generateSnapshotDiagnosticSummary(sampleArchitectTabs, samplePanels as any);
  const diag = JSON.parse(diagSummaryJson);
  assert(diag.totalTabs === 6, "generateSnapshotDiagnosticSummary counts total tabs correctly");
  assert(diag.nonExemptCount === 5, "generateSnapshotDiagnosticSummary filters exempt pinned tab");
  assert(diag.panels.emptyPanelsCount === 1, "generateSnapshotDiagnosticSummary detects empty panel");
  assert(diag.panels.emptyPanelNames[0] === "闲置空面板", "generateSnapshotDiagnosticSummary identifies correct empty panel name");
  assert(diag.topDomainClusters.length >= 4, "generateSnapshotDiagnosticSummary groups top domain clusters");

  // 11.2 Fallback schemes
  const fallbackSchemes = getFallbackSchemes(sampleArchitectTabs);
  assert(fallbackSchemes.length >= 2, "getFallbackSchemes returns multiple architectures");
  assert(fallbackSchemes[0].categories.length >= 3, "Fallback scheme contains structured categories");
  assert(fallbackSchemes[0].categories[0].matchDomains?.includes("github.com"), "Fallback scheme maps github.com to dev category");

  // 11.3 Apply scheme to snapshot
  const rawTestSnapshot: SideberySnapshot = {
    id: "snap_arch_test",
    time: Date.now(),
    windows: {
      "1": { tabs: sampleArchitectTabs },
    },
    panels: samplePanels as any,
  };

  const schemeToApply = fallbackSchemes[0];
  const appliedCache = applySchemeToSnapshot(rawTestSnapshot, schemeToApply, {
    crossPanelMerge: true,
    createGroupTabs: true,
    targetMode: "tree",
  });

  assert(appliedCache !== null, "applySchemeToSnapshot returns valid AIProcessedCache");
  assert(appliedCache.summary.total === 6, "applySchemeToSnapshot preserves total tab count");
  assert(appliedCache.classificationMap["t1"] === "🔨 活跃工程与开发", "applySchemeToSnapshot matches GitHub tab to '🔨 活跃工程与开发'");
  assert(appliedCache.classificationMap["t2"] === "💾 待下载转存·同人与资源", "applySchemeToSnapshot matches DLsite tab to '💾 待下载转存·同人与资源'");
  assert(appliedCache.classificationMap["t3"] === "📚 常驻参考·游戏与模组", "applySchemeToSnapshot matches ErogameScape tab to '📚 常驻参考·游戏与模组'");
  assert(appliedCache.classificationMap["t4"] === "🥽 虚拟工坊·3D资产与空间", "applySchemeToSnapshot matches Booth tab to '🥽 虚拟工坊·3D资产与空间'");

  // 11.4 Chat state management in useSnapshotStore
  useSnapshotStore.getState().clearAiChatMessages();
  assert(useSnapshotStore.getState().aiChatMessages.length === 0, "clearAiChatMessages resets chat history");
  useSnapshotStore.getState().addAiChatMessage({
    id: "msg_1",
    sender: "assistant",
    timestamp: Date.now(),
    text: "AI 架构师已就绪",
    schemes: fallbackSchemes,
  });
  assert(useSnapshotStore.getState().aiChatMessages.length === 1, "addAiChatMessage stores assistant message with schemes");

  console.log(`AI Restructure Tests Completed: ${passed} passed, ${failed} failed.`);
  return { passed, failed };
}

if (process.argv[1]?.endsWith("aiRestructure.test.ts")) {
  const result = runAIRestructureTests();
  if (result.failed > 0) process.exit(1);
}
