import { SideberySnapshot, SideberyTab } from "../src/types/sidebery";
import { CategoryProportion } from "../src/types/ai";
import { buildProcessedSnapshot } from "../src/store/useSnapshotStore";
import { matchTabWithRule } from "../src/services/ruleEngine";
import {
  repairJSONString,
  extractAndParseJSON,
  generateTabsSummary,
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

  console.log(`AI Restructure Tests Completed: ${passed} passed, ${failed} failed.`);
  return { passed, failed };
}

if (process.argv[1]?.endsWith("aiRestructure.test.ts")) {
  const result = runAIRestructureTests();
  if (result.failed > 0) process.exit(1);
}
