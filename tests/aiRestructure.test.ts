import { SideberySnapshot, SideberyTab } from "../src/types/sidebery";
import { CategoryProportion } from "../src/types/ai";
import { buildProcessedSnapshot } from "../src/store/useSnapshotStore";
import { matchTabWithRule } from "../src/services/ruleEngine";

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

  console.log(`AI Restructure Tests Completed: ${passed} passed, ${failed} failed.`);
  return { passed, failed };
}

if (process.argv[1]?.endsWith("aiRestructure.test.ts")) {
  const result = runAIRestructureTests();
  if (result.failed > 0) process.exit(1);
}
