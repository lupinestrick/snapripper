import { SideberySnapshot, SideberyTab } from "../src/types/sidebery";
import { CategoryProportion, AIConfig } from "../src/types/ai";
import { buildProcessedSnapshot, useSnapshotStore } from "../src/store/useSnapshotStore";
import {
  matchTabWithRule,
  DEFAULT_RULES_SETTINGS,
  normalizeRuleToDSL,
  previewRulesOnTabs,
  applyRulesToTreeNodes,
  parseAIRulesFromResponse,
  buildUnmatchedSnapshotContext,
} from "../src/services/ruleEngine";
import { buildAIMergeReport } from "../src/services/aiArchitectEngine";
import { buildTabTree } from "../src/services/snapshotParser";
import { determineTargetPanelForCategory } from "../src/services/treeOperations";
import { isGroupTab, getGroupTitle } from "../src/services/snapshotParser";
import { computeSnapshotDiff } from "../src/services/diffEngine";
import {
  generateSnapshotDiagnosticSummary,
  applySchemeToSnapshot,
  getFallbackSchemes,
  computeSchemeCoverage,
  extractDiagnosisChipsFromResponse,
  extractSchemesFromAIResponse,
  buildSchemeStateDigest,
} from "../src/services/aiArchitectEngine";
import {
  clusterSnapshotTabs,
  tokenizeTabText,
  formatClusterReportForPrompt,
} from "../src/services/tabClusterEngine";
import { INITIAL_ARCHITECT_ANALYSIS_PROMPT, DEFAULT_AI_ARCHITECT_PROMPT } from "../src/constants/aiPrompts";
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
  resolveCallSettings,
  checkAICallLimits,
  truncateChatTurns,
  extractAndParseJSON,
  generateTabsSummary,
  normalizeAnthropicMessagesUrl,
  normalizeAnthropicModelsUrl,
  normalizeOpenAIChatUrl,
  normalizeOpenAIModelsUrl,
  normalizeGeminiEndpoint,
  getAPIKeySlot,
  resolveAPIKey,
  resolveBaseURL,
  resolveModel,
  getProviderMeta,
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

  // 9.3 Domain Merge with crossPanelMerge
  const domainDiffSnapshot: SideberySnapshot = {
    id: "domain_diff_snap",
    time: Date.now(),
    windows: {
      "1": {
        tabs: [
          { id: 301, panelId: "main", parentId: -1, lvl: 0, title: "ZodGame 1", url: "https://zodgame.xyz/thread-1" },
          { id: 302, panelId: "panel_game", parentId: -1, lvl: 0, title: "ZodGame 2", url: "https://zodgame.xyz/thread-2" },
          { id: 303, panelId: "panel_game", parentId: -1, lvl: 0, title: "ZodGame 3", url: "https://zodgame.xyz/thread-3" },
        ],
      },
    },
    panels: {
      main: { id: "main", name: "主面板" },
      panel_game: { id: "panel_game", name: "游戏面板" },
    },
    extensionBaseUrl: "moz-extension://test",
  };

  const domainDiffResult = computeSnapshotDiff(
    domainDiffSnapshot,
    {
      enableDedup: false,
      enableRules: false,
      enableDomainMerge: true,
      domainMergeConfig: { matchMode: "suffix", customPattern: "", minThreshold: 2 },
      enableAICategorize: false,
      scope: "all",
      crossPanelMerge: true,
    },
    DEFAULT_RULES_SETTINGS
  );

  const domainMigratedTab = domainDiffResult.newSnapshot.windows["1"].tabs.find((t) => t.id === 301);
  assert(
    domainMigratedTab?.panelId === "panel_game",
    "diffEngine with crossPanelMerge: true merges same-domain tabs into majority panel_game"
  );

  // 9.3 Local Cluster Pipeline & Current-Panel Scope
  const clusterPipelineSnapshot: SideberySnapshot = {
    id: "snap_clu_pipe",
    time: Date.now(),
    windows: {
      "1": {
        tabs: [
          { id: 401, panelId: "main", parentId: -1, lvl: 0, title: "OpenWrt Router Setup", url: "https://forum.example.org/openwrt" },
          { id: 402, panelId: "main", parentId: -1, lvl: 0, title: "OpenWrt Firmware Releases", url: "https://downloads.example.net/openwrt" },
          { id: 403, panelId: "panel_other", parentId: -1, lvl: 0, title: "Other A", url: "https://other-a.com/1" },
          { id: 404, panelId: "panel_other", parentId: -1, lvl: 0, title: "Other A Duplicate", url: "https://other-a.com/1" },
        ],
      },
    },
    panels: {
      main: { id: "main", name: "主面板" },
      panel_other: { id: "panel_other", name: "其他面板" },
    },
    extensionBaseUrl: "moz-extension://test",
  };

  const scopedClusterResult = computeSnapshotDiff(
    clusterPipelineSnapshot,
    {
      enableDedup: true,
      enableRules: false,
      enableDomainMerge: false,
      enableLocalCluster: true,
      clusterGranularity: "balanced",
      enableAICategorize: false,
      scope: "current",
      currentActivePanelId: "main",
      crossPanelMerge: false,
      createGroupTabs: true,
    },
    DEFAULT_RULES_SETTINGS
  );

  assert(
    scopedClusterResult.totalDeduped === 0,
    "computeSnapshotDiff with scope: current skips dedup in non-active panels"
  );
  assert(
    scopedClusterResult.totalGroupsCreated >= 1,
    "computeSnapshotDiff with enableLocalCluster creates Sidebery group for cross-domain topic tabs"
  );
  const mainPanelDiff = scopedClusterResult.panelDiffs.find((p) => p.panelId === "main");
  assert(
    Boolean(mainPanelDiff?.afterTree.some((n) => n.isGroup && String(n.id).startsWith("group_clu_"))),
    "Local cluster node carries group_clu_ native Sidebery group ID"
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

  // --- Test Set 11: Option B Local Pre-Clustering & AI Architect Engine ---
  const sampleArchitectTabs: SideberyTab[] = [
    { id: "t1", url: "https://github.com/openwrt/openwrt", title: "OpenWrt GitHub Source", panelId: "p_dev", parentId: -1 },
    { id: "t2", url: "https://forum.example.org/openwrt-guide", title: "OpenWrt 刷机固件教程", panelId: "p_main", parentId: -1 },
    { id: "t3", url: "https://docs.python.org/3/library/asyncio", title: "Python Asyncio Docs", panelId: "p_dev", parentId: -1 },
    { id: "t4", url: "https://docs.python.org/3/library/typing", title: "Python Typing Docs", panelId: "p_dev", parentId: -1 },
    { id: "t5", url: "https://shop.example.com/item/99", title: "3D Model Asset", panelId: "p_main", parentId: -1 },
    { id: "t6", url: "about:config", title: "Firefox Config", pinned: true, panelId: "p_main", parentId: -1 },
    // Native group subtree
    { id: "grp_1", url: "moz-extension://test/sidebery/group.html#ProjectGroup", title: "ProjectGroup", isGroup: true, panelId: "p_main", parentId: -1, lvl: 0 },
    { id: "t7", url: "https://linear.app/issue/101", title: "Linear Issue 101", panelId: "p_main", parentId: "grp_1", lvl: 1 },
    { id: "t8", url: "https://figma.com/file/abc", title: "UI Mockup", panelId: "p_main", parentId: "grp_1", lvl: 1 },
  ];
  const samplePanels = {
    p_dev: { id: "p_dev", name: "开发面板" },
    p_main: { id: "p_main", name: "主面板" },
    p_empty: { id: "p_empty", name: "闲置空面板" },
  };

  // 11.1 Tokenizer & Local Unsupervised Clustering Engine
  const tokens = tokenizeTabText("OpenWrt 刷机固件教程 Router Setup");
  assert(tokens.includes("openwrt") && tokens.includes("刷机"), "tokenizeTabText extracts both ASCII and CJK tokens");

  const clusterReport = clusterSnapshotTabs(sampleArchitectTabs, samplePanels as any, "balanced");
  assert(clusterReport.totalTabs === 9, "clusterSnapshotTabs counts total tabs accurately");
  assert(clusterReport.nonExemptCount === 8, "clusterSnapshotTabs preserves native group subtree and filters exempt pinned tab");
  assert(clusterReport.exemptProtectedCount === 1, "clusterSnapshotTabs counts exempt pinned tab");
  assert(clusterReport.emptyPanelNames[0] === "闲置空面板", "clusterSnapshotTabs identifies empty panels");

  const assignedTabIds = new Set(clusterReport.clusters.flatMap((c) => c.tabIds));
  assert(assignedTabIds.size === 8, "clusterSnapshotTabs achieves 100% coverage of all non-exempt tabs (zero blind spots)");

  const groupSubtreeCluster = clusterReport.clusters.find((c) => c.cohesionReason === "group_subtree");
  assert(
    Boolean(groupSubtreeCluster && groupSubtreeCluster.tabIds.includes("grp_1") && groupSubtreeCluster.tabIds.includes("t7") && groupSubtreeCluster.tabIds.includes("t8")),
    "clusterSnapshotTabs keeps native Sidebery group subtree intact inside a single micro-cluster"
  );

  // Semantic cross-domain merge (t1 github openwrt + t2 forum openwrt)
  const openwrtCluster = clusterReport.clusters.find(
    (c) => c.tabIds.includes("t1") && c.tabIds.includes("t2")
  );
  assert(
    Boolean(openwrtCluster && openwrtCluster.cohesionReason === "semantic_topic"),
    "clusterSnapshotTabs merges cross-domain tabs sharing topic tokens into semantic_topic cluster"
  );

  // 11.2 Diagnostic summary JSON format
  const diagSummaryJson = generateSnapshotDiagnosticSummary(sampleArchitectTabs, samplePanels as any);
  const diag = JSON.parse(diagSummaryJson);
  assert(diag.overview?.totalTabs === 9, "generateSnapshotDiagnosticSummary outputs Option B overview");
  assert(Array.isArray(diag.microClusters) && diag.microClusters.length === clusterReport.clusters.length, "generateSnapshotDiagnosticSummary embeds full microClusters digest");

  // 11.3 Dynamic Option B fallback schemes & prompt checks
  const fallbackSchemes = getFallbackSchemes(sampleArchitectTabs, clusterReport, "balanced");
  assert(fallbackSchemes.length === 3, "getFallbackSchemes returns 3 dynamic Option B architectures");
  assert(fallbackSchemes[0].categories.some((c) => (c.clusterIds?.length || 0) > 0), "Dynamic fallback schemes populate clusterIds directly");
  assert(INITIAL_ARCHITECT_ANALYSIS_PROMPT.includes("microClusters"), "INITIAL_ARCHITECT_ANALYSIS_PROMPT references microClusters");
  assert(DEFAULT_AI_ARCHITECT_PROMPT.includes("clusterIds"), "DEFAULT_AI_ARCHITECT_PROMPT instructs clusterIds mapping");

  const cov = computeSchemeCoverage(fallbackSchemes[0], clusterReport);
  assert(cov.coveragePct === 100, `Scheme A dynamic cluster mapping achieves 100% coverage (got ${cov.coveragePct}%)`);

  // 11.4 Apply Option B scheme & verify cluster exclusion + legacy fallback
  const rawTestSnapshot: SideberySnapshot = {
    id: "snap_arch_test",
    time: Date.now(),
    windows: {
      "1": { tabs: sampleArchitectTabs },
    },
    panels: samplePanels as any,
  };

  const schemeWithExclusion = {
    ...fallbackSchemes[0],
    excludedClusterIds: groupSubtreeCluster ? [groupSubtreeCluster.id] : [],
  };

  const appliedCache = applySchemeToSnapshot(rawTestSnapshot, schemeWithExclusion, {
    crossPanelMerge: true,
    createGroupTabs: true,
    targetMode: "tree",
    clusterReport,
  });

  assert(appliedCache !== null, "applySchemeToSnapshot returns valid AIProcessedCache");
  assert(appliedCache.summary.total === 9, "applySchemeToSnapshot preserves total tab count");
  assert(!appliedCache.classificationMap["t7"], "excludedClusterIds prevents excluded cluster tabs from being recategorized");
  assert(Boolean(appliedCache.classificationMap["t3"]), "Included domain cluster tabs are classified accurately via clusterIds");

  // Backward-compatible rule-only scheme (without clusterIds) still works
  const legacyRuleScheme = {
    id: "legacy_rule",
    name: "Legacy Rule Scheme",
    strategy: "Domain fallback check",
    categories: [
      {
        name: "🐍 Python Docs",
        matchDomains: ["docs.python.org"],
        createGroup: true,
      },
    ],
  };
  const legacyCache = applySchemeToSnapshot(rawTestSnapshot, legacyRuleScheme, {
    crossPanelMerge: true,
    createGroupTabs: true,
    targetMode: "tree",
  });
  assert(
    legacyCache.classificationMap["t3"] === "🐍 Python Docs" && legacyCache.classificationMap["t4"] === "🐍 Python Docs",
    "applySchemeToSnapshot retains backward compatibility for matchDomains rule schemes"
  );

  // 11.5 Chat & 0-token Scheme update in useSnapshotStore
  useSnapshotStore.getState().clearAiChatMessages();
  assert(useSnapshotStore.getState().aiChatMessages.length === 0, "clearAiChatMessages resets chat history");
  useSnapshotStore.getState().addAiChatMessage({
    id: "msg_1",
    sender: "assistant",
    timestamp: Date.now(),
    text: "AI 架构师已就绪",
    schemes: fallbackSchemes,
    clusterReport,
  });
  useSnapshotStore.getState().updateSchemeInChat("msg_1", schemeWithExclusion);
  const updatedMsg = useSnapshotStore.getState().aiChatMessages[0];
  assert(
    (updatedMsg?.schemes?.[0].excludedClusterIds?.length || 0) === (groupSubtreeCluster ? 1 : 0),
    "updateSchemeInChat persists 0-token micro-cluster edits in store"
  );

  // --- Test Set 12: Option B Condition-Action Rule DSL Engine ---
  const dslTabs: SideberyTab[] = [
    { id: "r1", panelId: "main", parentId: -1, lvl: 0, title: "Fix auth bug #42", url: "https://github.com/myorg/app/issues/42" },
    { id: "r2", panelId: "main", parentId: -1, lvl: 0, title: "Closed old issue", url: "https://github.com/myorg/app/issues/10" },
    { id: "r3", panelId: "main", parentId: -1, lvl: 0, title: "React Hooks API", url: "https://github.com/myorg/app/blob/main/README.md" },
    { id: "r4", panelId: "main", parentId: -1, lvl: 0, title: "Open Issue #99", url: "https://github.com/myorg/app/issues/99" },
  ];

  const andRule = {
    id: "dsl_open_issues",
    name: "🐛 Open GitHub Issues",
    enabled: true,
    scope: "all" as const,
    matchMode: "all" as const,
    conditions: [
      { id: "c1", field: "domain" as const, operator: "equals" as const, value: "github.com" },
      { id: "c2", field: "urlPath" as const, operator: "contains" as const, value: "/issues" },
      { id: "c3", field: "title" as const, operator: "notContains" as const, value: "closed" },
    ],
    action: { type: "groupAndMove" as const, targetPanelId: "panel_dev", createGroup: true },
    minThreshold: 2,
    color: "#3b82f6",
  };

  assert(matchTabWithRule(dslTabs[0], andRule), "DSL AND rule matches open GitHub issue");
  assert(!matchTabWithRule(dslTabs[1], andRule), "DSL notContains excludes closed issue");
  assert(!matchTabWithRule(dslTabs[2], andRule), "DSL urlPath excludes non-issue README page");

  const normalizedLegacy = normalizeRuleToDSL({
    id: "leg_1",
    name: "Legacy",
    enabled: true,
    scope: "all",
    matchDomain: "github.com",
    minThreshold: 2,
  });
  assert(
    normalizedLegacy.conditions?.[0]?.field === "domain" && normalizedLegacy.action?.type === "group",
    "normalizeRuleToDSL migrates legacy matchDomain rule seamlessly"
  );

  const shadowRule = { ...andRule, id: "dsl_shadow", name: "Shadowed Rule" };
  const previewMap = previewRulesOnTabs(dslTabs, [andRule, shadowRule]);
  assert(
    previewMap.get("dsl_open_issues")?.effectiveHits === 2 &&
      previewMap.get("dsl_shadow")?.shadowedHits === 2,
    "previewRulesOnTabs computes effectiveHits and shadowedHits conflicts accurately"
  );

  const exemptRule = {
    id: "dsl_exempt_closed",
    name: "Protect Closed",
    enabled: true,
    scope: "all" as const,
    matchMode: "all" as const,
    conditions: [{ id: "cx", field: "title" as const, operator: "regex" as const, value: "^closed" }],
    action: { type: "exempt" as const },
    minThreshold: 1,
  };

  const dslTree = buildTabTree(dslTabs);
  const appliedDsl = applyRulesToTreeNodes(dslTree, {
    treatExistingGroupsAsUnit: true,
    defaultMinThreshold: 2,
    createGroupTabs: true,
    rules: [exemptRule, andRule],
  });
  assert(appliedDsl.groupsCreated === 1, "applyRulesToTreeNodes creates 1 group for open issues");
  const createdGroupNode = appliedDsl.newNodes.find((n) => n.isGroup && n.categoryName === "🐛 Open GitHub Issues");
  assert(
    Boolean(createdGroupNode && createdGroupNode.tab.panelId === "panel_dev" && createdGroupNode.children.length === 2),
    "groupAndMove action places group header and 2 children into target panel_dev"
  );

  // --- Test Set 13: AI Multi-Session Chat History ---
  const store = useSnapshotStore.getState();
  store.clearAllCache();
  store.addAiChatMessage({
    id: "h1",
    sender: "user",
    timestamp: Date.now(),
    text: "分析第一份快照",
  });
  const firstSessionId = useSnapshotStore.getState().activeChatSessionId;
  assert(Boolean(firstSessionId), "addAiChatMessage auto-creates active chat session");
  assert(
    useSnapshotStore.getState().aiChatSessions.length === 1,
    "aiChatSessions stores created session"
  );

  useSnapshotStore.getState().renameAiChatSession(firstSessionId!, "工作区重构会话");
  assert(
    useSnapshotStore.getState().aiChatSessions[0].title === "工作区重构会话",
    "renameAiChatSession updates session title"
  );

  useSnapshotStore.getState().startNewAiChat();
  assert(
    useSnapshotStore.getState().aiChatMessages.length === 0 &&
      useSnapshotStore.getState().activeChatSessionId === null,
    "startNewAiChat clears active messages while preserving previous session"
  );

  useSnapshotStore.getState().selectAiChatSession(firstSessionId!);
  assert(
    useSnapshotStore.getState().aiChatMessages.length === 1 &&
      useSnapshotStore.getState().activeChatSessionId === firstSessionId,
    "selectAiChatSession restores saved messages"
  );

  useSnapshotStore.getState().deleteAiChatSession(firstSessionId!);
  assert(
    useSnapshotStore.getState().aiChatSessions.length === 0 &&
      useSnapshotStore.getState().aiChatMessages.length === 0,
    "deleteAiChatSession removes session and clears active view"
  );

  // --- Test Set 14: Chinese AI Provider URL Normalization & Custom Provider Meta ---
  assert(
    normalizeOpenAIChatUrl("https://ark.cn-beijing.volces.com/api/v3") ===
      "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
    "normalizeOpenAIChatUrl preserves Volcengine Ark /api/v3 without double /v1"
  );
  assert(
    normalizeOpenAIChatUrl("https://open.bigmodel.cn/api/paas/v4") ===
      "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    "normalizeOpenAIChatUrl preserves Zhipu GLM /api/paas/v4 without double /v1"
  );
  assert(
    normalizeOpenAIModelsUrl("https://qianfan.baidubce.com/v2") ===
      "https://qianfan.baidubce.com/v2/models",
    "normalizeOpenAIModelsUrl preserves Baidu Qianfan /v2"
  );
  assert(
    normalizeGeminiEndpoint("https://proxy.example.com/v1beta", "gemini-2.5-flash", "generateContent", "k123") ===
      "https://proxy.example.com/v1beta/models/gemini-2.5-flash:generateContent?key=k123",
    "normalizeGeminiEndpoint supports custom Gemini relay base URL"
  );
  const customMeta = getProviderMeta(
    {
      provider: "custom_1",
      baseURL: "https://api.siliconflow.cn/v1",
      apiKey: "sk-1",
      model: "Qwen/Qwen2.5-72B-Instruct",
      customProviders: [
        {
          id: "custom_1",
          name: "硅基流动",
          type: "openai",
          baseUrl: "https://api.siliconflow.cn/v1",
          model: "Qwen/Qwen2.5-72B-Instruct",
        },
      ],
    },
    "custom_1"
  );
  assert(
    customMeta.name === "硅基流动" && customMeta.isCustom,
    "getProviderMeta resolves custom provider metadata accurately"
  );

  // --- AI Call Presets, Limits & Context Truncation Tests ---
  const resolvedCall = resolveCallSettings({
    provider: "deepseek",
    baseURL: "https://api.deepseek.com/v1",
    apiKey: "k",
    model: "deepseek-flash",
    callSettings: {
      preset: "eco",
      temperature: 0.1,
      maxTokens: 2048,
      timeoutSeconds: 60,
      maxHistoryTurns: 2,
      minIntervalSeconds: 3,
      dailyCallLimit: 50,
    },
  });
  assert(
    resolvedCall.preset === "eco" && resolvedCall.maxTokens === 2048 && resolvedCall.timeoutSeconds === 60,
    "resolveCallSettings preserves eco preset parameters"
  );

  const nowMs = Date.now();
  const cooldownCheck = checkAICallLimits(
    resolvedCall,
    {
      date: "2026-11-26",
      callsToday: 1,
      totalCalls: 1,
      promptTokensToday: 0,
      completionTokensToday: 0,
      lastCallAt: nowMs - 1000,
    },
    nowMs
  );
  assert(!cooldownCheck.ok, "checkAICallLimits blocks request within cooldown interval");

  const todayDate = `${new Date(nowMs).getFullYear()}-${String(new Date(nowMs).getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(new Date(nowMs).getDate()).padStart(2, "0")}`;
  const quotaCheck = checkAICallLimits(
    { ...resolvedCall, minIntervalSeconds: 0, dailyCallLimit: 5 },
    {
      date: todayDate,
      callsToday: 5,
      totalCalls: 5,
      promptTokensToday: 0,
      completionTokensToday: 0,
      lastCallAt: nowMs - 10000,
    },
    nowMs
  );
  assert(!quotaCheck.ok, "checkAICallLimits blocks request when dailyCallLimit is reached");

  const truncated = truncateChatTurns(
    [
      { role: "user", content: "q1" },
      { role: "assistant", content: "a1" },
      { role: "user", content: "q2" },
      { role: "assistant", content: "a2" },
      { role: "user", content: "q3" },
    ],
    1
  );
  assert(
    truncated.length === 3 && truncated[0].content === "q2" && truncated[2].content === "q3",
    "truncateChatTurns keeps latest maxHistoryTurns plus current user turn"
  );

  const diagParsed = extractDiagnosisChipsFromResponse(
    `<think>internal reasoning</think>\n诊断要点：开发类标签占比过高。\n\`\`\`json\n[{"id":"d1","label":"合并开发库","description":"聚合 GitHub 与文档","prompt":"按开发聚合"}]\n\`\`\``
  );
  assert(
    diagParsed.chips.length === 1 &&
      diagParsed.chips[0].label === "合并开发库" &&
      !diagParsed.cleanedText.includes("<think>"),
    "extractDiagnosisChipsFromResponse strips think block and parses direction chips"
  );

  const diagFallback = extractDiagnosisChipsFromResponse("当前结构较为分散，建议进一步分类。");
  assert(
    diagFallback.chips.length === 4,
    "extractDiagnosisChipsFromResponse falls back to default direction chips when JSON is absent"
  );

  const parsedDslRules = parseAIRulesFromResponse(
    `<think>thinking</think>\n推荐规则：\n\`\`\`json\n[{"name":"GitHub PR","matchMode":"all","conditions":[{"field":"domain","operator":"contains","value":"github.com"},{"field":"urlPath","operator":"contains","value":"/pull"}],"action":{"type":"group","createGroup":true},"minThreshold":2}]\n\`\`\``
  );
  assert(
    parsedDslRules.rules?.length === 1 &&
      parsedDslRules.rules[0].conditions?.length === 2 &&
      parsedDslRules.rules[0].matchMode === "all",
    "parseAIRulesFromResponse parses Rule DSL conditions and strips think block"
  );

  const parsedLegacyRules = parseAIRulesFromResponse(
    `\`\`\`json\n[{"name":"Old Style","matchDomain":"github.com","matchKeyword":"issue","minThreshold":2}]\n\`\`\``
  );
  assert(
    parsedLegacyRules.rules?.length === 1 &&
      (parsedLegacyRules.rules[0].conditions?.length || 0) >= 2,
    "parseAIRulesFromResponse normalizes legacy matchDomain/matchKeyword rules to DSL"
  );

  const unmatchedCtx = buildUnmatchedSnapshotContext(
    [
      { id: 1, title: "Open Issue", url: "https://github.com/org/repo/issues/1", panelId: "p1", lvl: 0 } as any,
      { id: 2, title: "Unmatched News", url: "https://news.ycombinator.com/", panelId: "p1", lvl: 0 } as any,
    ],
    [
      {
        id: "r1",
        name: "GH",
        enabled: true,
        matchMode: "all",
        conditions: [{ id: "c1", field: "domain", operator: "contains", value: "github.com" }],
        action: { type: "group" },
        scope: "all",
        minThreshold: 1,
        color: "#3b82f6",
      },
    ],
    { p1: { id: "p1", name: "Main" } }
  );
  assert(
    unmatchedCtx.eligibleCount === 2 &&
      unmatchedCtx.unmatchedCount === 1 &&
      unmatchedCtx.topUnmatchedDomains[0]?.domain === "news.ycombinator.com",
    "buildUnmatchedSnapshotContext identifies unmatched domains accurately"
  );

  const mergeReport = buildAIMergeReport({
    originalSnapshot: {
      windows: {
        "1": {
          id: "1",
          tabs: [
            { id: 10, title: "Repo", url: "https://github.com/a/b", panelId: "p1", lvl: 0 } as any,
          ],
        },
      },
      panels: {
        p1: { id: "p1", name: "收件箱" } as any,
        p2: { id: "p2", name: "开发" } as any,
      },
    } as any,
    processedSnapshot: {
      windows: {
        "1": {
          id: "1",
          tabs: [
            { id: "group_1", title: "开发组", url: "about:blank", isGroup: true, panelId: "p2", lvl: 0 } as any,
            { id: 10, title: "Repo", url: "https://github.com/a/b", panelId: "p2", parentId: "group_1", lvl: 1 } as any,
          ],
        },
      },
      panels: {
        p1: { id: "p1", name: "收件箱" } as any,
        p2: { id: "p2", name: "开发" } as any,
      },
    } as any,
    timestamp: Date.now(),
    categoryNames: ["开发组"],
    classificationMap: { "10": "开发组" },
    summary: { total: 1, categorizedCount: 1, uncategorizedCount: 0, categoryCounts: { 开发组: 1 } },
    targetMode: "panel",
  });
  assert(
    mergeReport.totalTabs === 1 &&
      mergeReport.categorizedCount === 1 &&
      mergeReport.movedAcrossPanelsCount === 1 &&
      mergeReport.items[0].fromPanelName === "收件箱" &&
      mergeReport.items[0].toPanelName === "开发" &&
      mergeReport.items[0].toCategoryName === "开发组",
    "buildAIMergeReport tracks before/after panels and category destination accurately"
  );

  // --- Test Set 15: Option D Prompt Signals, Robust JSON Extraction & Refinement State Digest ---
  const promptDigestRaw = formatClusterReportForPrompt({
    totalTabs: 12,
    nonExemptCount: 12,
    exemptProtectedCount: 0,
    granularity: "balanced",
    compressionRatio: 75,
    emptyPanelNames: ["闲置面板"],
    activePanels: [
      { id: "p1", name: "工作", count: 7, pct: "58.3%" },
      { id: "p2", name: "日常", count: 5, pct: "41.7%" },
    ],
    treeDepthDistribution: { 0: 8, 1: 2, 2: 2 },
    clusters: [
      {
        id: "c1",
        labelHint: "GitHub PR",
        tabIds: ["1", "2", "3"],
        tabCount: 3,
        domains: ["github.com"],
        sampleTitles: ["PR #1"],
        sourcePanelIds: ["p1"],
        sourcePanelNames: ["工作"],
        cohesionReason: "domain_path",
        keywords: ["pr"],
      },
      {
        id: "c2",
        labelHint: "GitHub Issues",
        tabIds: ["4", "5"],
        tabCount: 2,
        domains: ["github.com"],
        sampleTitles: ["Issue #2"],
        sourcePanelIds: ["p2"],
        sourcePanelNames: ["日常"],
        cohesionReason: "domain_path",
        keywords: ["issue"],
      },
      {
        id: "c3",
        labelHint: "长尾零散",
        tabIds: ["6"],
        tabCount: 1,
        domains: ["example.org"],
        sampleTitles: ["Note"],
        sourcePanelIds: ["p2"],
        sourcePanelNames: ["日常"],
        cohesionReason: "tail_misc",
        keywords: [],
      },
    ],
  });
  const promptDigest = JSON.parse(promptDigestRaw);
  assert(
    promptDigest.overview?.maxTreeDepth === 2 &&
      promptDigest.overview?.deepNestedTabs === 2 &&
      promptDigest.crossPanelDomains?.[0]?.domain === "github.com" &&
      promptDigest.crossPanelDomains?.[0]?.clusterIds?.length === 2,
    "formatClusterReportForPrompt precomputes crossPanelDomains and tree depth summary"
  );

  const wrappedSchemesParsed = extractSchemesFromAIResponse(
    `<think>analyzing clusters</think>\n诊断：\`c1\` 与 \`c2\` 跨面板割裂。\n\`\`\`json\n{"schemes":[{"id":"s1","name":"方案 A：合并开发","targetMode":"panel","categories":[{"name":"💻 GitHub 专题","clusterIds":["c1","c2"]}]}]}\n\`\`\``
  );
  assert(
    wrappedSchemesParsed.schemes?.length === 1 &&
      wrappedSchemesParsed.schemes[0].targetMode === "panel" &&
      !wrappedSchemesParsed.cleanedText.includes("<think>") &&
      wrappedSchemesParsed.cleanedText.includes("跨面板割裂"),
    "extractSchemesFromAIResponse strips <think>, unwraps {schemes} object, and cleans markdown"
  );

  const singleSchemeParsed = extractSchemesFromAIResponse(
    `已将 c3 移至归档。\n\`\`\`json\n{"id":"s1","name":"修订方案","targetMode":"tree","categories":[{"name":"归档","clusterIds":["c3"]}]}\n\`\`\``
  );
  assert(
    singleSchemeParsed.schemes?.length === 1 &&
      singleSchemeParsed.schemes[0].categories[0].clusterIds?.[0] === "c3",
    "extractSchemesFromAIResponse wraps single scheme object returned in refinement mode"
  );

  const stateDigest = JSON.parse(
    buildSchemeStateDigest(wrappedSchemesParsed.schemes!, {
      totalTabs: 6,
      nonExemptCount: 6,
      exemptProtectedCount: 0,
      granularity: "balanced",
      compressionRatio: 50,
      emptyPanelNames: [],
      activePanels: [],
      treeDepthDistribution: { 0: 6 },
      clusters: [
        { id: "c1", labelHint: "A", tabIds: ["1"], tabCount: 1, domains: [], sampleTitles: [], sourcePanelIds: ["p1"], sourcePanelNames: ["P1"], cohesionReason: "domain_path", keywords: [] },
        { id: "c2", labelHint: "B", tabIds: ["2"], tabCount: 1, domains: [], sampleTitles: [], sourcePanelIds: ["p1"], sourcePanelNames: ["P1"], cohesionReason: "domain_path", keywords: [] },
        { id: "c3", labelHint: "C", tabIds: ["3"], tabCount: 1, domains: [], sampleTitles: [], sourcePanelIds: ["p1"], sourcePanelNames: ["P1"], cohesionReason: "tail_misc", keywords: [] },
      ],
    })
  );
  assert(
    stateDigest[0]?.unassignedClusterIds?.includes("c3") && stateDigest[0]?.targetMode === "panel",
    "buildSchemeStateDigest tracks current categories and unassignedClusterIds for multi-turn refinement"
  );

  const panelTargetCache = applySchemeToSnapshot(
    {
      id: "snap_panel_name",
      time: Date.now(),
      windows: { "1": { tabs: [{ id: 1, panelId: "main", parentId: -1, lvl: 0, title: "GH", url: "https://github.com/a" }] } },
      panels: { main: { id: "main", name: "主面板", color: "toolbar" } },
    },
    {
      id: "s_panel",
      name: "Panel Scheme",
      strategy: "test",
      targetMode: "panel",
      categories: [
        {
          name: "开发专题",
          targetPanelName: "🔨 独立开发面板",
          clusterIds: [],
          matchDomains: ["github.com"],
        },
      ],
    },
    { targetMode: "panel" }
  );
  const newPanel = Object.values(panelTargetCache.processedSnapshot.panels || {}).find((p) =>
    p.id.startsWith("panel_cat_")
  );
  assert(
    newPanel?.name === "🔨 独立开发面板" &&
      panelTargetCache.processedSnapshot.windows["1"].tabs[0].panelId === newPanel?.id,
    "applySchemeToSnapshot honors targetPanelName while preserving classificationMap category matching"
  );

  console.log(`AI Restructure Tests Completed: ${passed} passed, ${failed} failed.`);
  return { passed, failed };
}

if (process.argv[1]?.endsWith("aiRestructure.test.ts")) {
  const result = runAIRestructureTests();
  if (result.failed > 0) process.exit(1);
}
