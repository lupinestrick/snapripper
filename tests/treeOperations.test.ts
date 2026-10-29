import { buildTabTree } from "../src/services/snapshotParser";
import {
  getDuplicateUrlSet,
  batchDeleteNodes,
  reorganizeTreeIntoCategories,
} from "../src/services/treeOperations";
import { MOCK_SIDEBERY_SNAPSHOT } from "../src/utils/mockSnapshot";

export function runTreeOperationsTests() {
  console.log("▶ Running Tree Operations Tests...");
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, desc: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${desc}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${desc}`);
      failed++;
    }
  }

  const tabs = MOCK_SIDEBERY_SNAPSHOT.windows["1"].tabs;
  const tree = buildTabTree(tabs);

  const duplicates = getDuplicateUrlSet(tabs);
  assert(duplicates.size >= 2, `Detected ${duplicates.size} duplicate URLs`);

  const rootToDelete = tree.find((n) => n.children.length > 0);
  if (rootToDelete) {
    const childrenCount = rootToDelete.children.length;
    const initialRootCount = tree.length;
    const deleteSet = new Set([rootToDelete.id]);
    const afterDelete = batchDeleteNodes(tree, deleteSet, false);

    assert(
      afterDelete.length === initialRootCount - 1 + childrenCount,
      "Deleted root node promoted its children to root level"
    );
  }

  const classificationMap = new Map<string, string>();
  classificationMap.set("201", "前端开发");
  classificationMap.set("204", "前端开发");
  classificationMap.set("301", "AI研究");

  const categories = ["前端开发", "AI研究"];
  const categorizedTree = reorganizeTreeIntoCategories(tree, classificationMap, categories);

  const devHeader = categorizedTree.find((n) => n.categoryName === "前端开发");
  assert(!!devHeader, "Found '前端开发' category header node");

  if (devHeader) {
    const node201 = devHeader.children.find((c) => String(c.tab.id) === "201");
    assert(!!node201, "Node 201 placed inside '前端开发' category");
    assert(
      (node201?.children.length ?? 0) >= 2,
      `Subtree intact! Node 201 retained its ${node201?.children.length} children under category header`
    );
  }

  console.log(`Tree Operations Tests Completed: ${passed} passed, ${failed} failed.\n`);
  return failed === 0;
}

if (typeof require !== "undefined" && require.main === module) {
  runTreeOperationsTests();
}
