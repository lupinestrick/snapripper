import { parseSnapshot, buildTabTree, flattenTabTree, serializeSnapshot } from "../src/services/snapshotParser";
import { MOCK_SIDEBERY_SNAPSHOT } from "../src/utils/mockSnapshot";

export function runSnapshotParserTests() {
  console.log("▶ Running Snapshot Parser Tests...");
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

  const jsonStr = serializeSnapshot(MOCK_SIDEBERY_SNAPSHOT);
  const result = parseSnapshot(jsonStr);
  assert(result.totalTabs > 0, `Parsed snapshot contains ${result.totalTabs} tabs`);
  assert(result.totalWindows === 1, "Parsed snapshot has 1 window");

  const tabs = result.snapshot.windows["1"].tabs;
  const tree = buildTabTree(tabs);
  assert(tree.length > 0, `Built tab tree with ${tree.length} root nodes`);

  const nodeWithChildren = tree.find((n) => n.children.length > 0);
  assert(!!nodeWithChildren, `Found parent node with ${nodeWithChildren?.children.length} children`);

  const flattened = flattenTabTree(tree);
  assert(flattened.length === tabs.length, `Flattened tree has ${flattened.length} tabs, matching original ${tabs.length}`);

  const originalPinned = tabs.filter((t) => t.pinned).length;
  const flattenedPinned = flattened.filter((t) => t.pinned).length;
  assert(originalPinned === flattenedPinned, `Pinned tabs count preserved (${flattenedPinned})`);

  console.log(`Snapshot Parser Tests Completed: ${passed} passed, ${failed} failed.\n`);
  return failed === 0;
}

if (typeof require !== "undefined" && require.main === module) {
  runSnapshotParserTests();
}
