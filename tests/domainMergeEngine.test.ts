import {
  extractDomainByMode,
  applyDomainMergeToTreeNodes,
  DomainMergeConfig,
} from "../src/services/domainMergeEngine";
import { TabTreeNode, SideberyTab } from "../src/types/sidebery";

export function runDomainMergeTests(): boolean {
  let passed = 0;
  let failed = 0;

  console.log("▶ Running Domain Merge Engine Tests...");

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${msg}`);
      failed++;
    }
  }

  // 1. extractDomainByMode
  const fullDomain = extractDomainByMode("https://api.github.com/v1/user", "full");
  assert(fullDomain === "api.github.com", "Full domain extracted correctly");

  const suffixDomain = extractDomainByMode("https://api.github.com/v1/user", "suffix");
  assert(suffixDomain === "github.com", "Suffix domain extracted correctly");

  const multiPartTld = extractDomainByMode("https://blog.yahoo.co.jp/article", "suffix");
  assert(multiPartTld === "yahoo.co.jp", "Multi-part TLD suffix extracted correctly");

  const keywordDomain = extractDomainByMode("https://api.github.com/v1/user", "keyword");
  assert(keywordDomain === "Github", "Keyword domain extracted correctly");

  const customDomain = extractDomainByMode(
    "https://developer.mozilla.org/zh-CN/docs",
    "custom",
    "https?:\\/\\/([a-z]+)\\.mozilla\\.org"
  );
  assert(customDomain === "developer", "Custom pattern extracted capture group correctly");

  // 2. applyDomainMergeToTreeNodes
  const mockTabs: TabTreeNode[] = [
    {
      id: "t1",
      tab: { id: "t1", panelId: "main", parentId: -1, url: "https://github.com/owner/repo1", title: "Repo 1" },
      depth: 0,
      children: [],
    },
    {
      id: "t2",
      tab: { id: "t2", panelId: "main", parentId: -1, url: "https://bilibili.com/video/1", title: "Bili 1" },
      depth: 0,
      children: [],
    },
    {
      id: "t3",
      tab: { id: "t3", panelId: "main", parentId: -1, url: "https://docs.github.com/actions", title: "GitHub Docs" },
      depth: 0,
      children: [],
    },
    {
      id: "t4",
      tab: { id: "t4", panelId: "main", parentId: -1, url: "https://google.com/search?q=test", title: "Google 1" },
      depth: 0,
      children: [],
    },
  ];

  const config: DomainMergeConfig = {
    matchMode: "suffix",
    customPattern: "",
    minThreshold: 2,
  };

  const mergeResult = applyDomainMergeToTreeNodes(mockTabs, config, {
    exemptPinned: true,
    exemptInternalPages: true,
    preserveSubtrees: true,
  });

  assert(mergeResult.groupsCreated === 1, "Created 1 domain group (github.com)");
  assert(mergeResult.mergedTabsCount === 2, "Merged 2 tabs into github.com group");
  assert(mergeResult.newNodes.length === 3, "New root list has 3 items (1 group + 2 ungrouped tabs)");

  const groupNode = mergeResult.newNodes.find((n) => n.isGroup);
  assert(!!groupNode, "Group node exists in result");
  assert(groupNode?.tab.title === "github.com", "Group node title is github.com");
  assert(groupNode?.children.length === 2, "Group node contains 2 child tabs");

  console.log(`Domain Merge Tests Completed: ${passed} passed, ${failed} failed.\n`);
  return failed === 0;
}
