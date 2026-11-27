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

  const v5Input = JSON.stringify({
    ver: "5.2.0",
    panels: { main: { id: "main", name: "Main" } },
    sidebar: { nav: ["main"] },
    tabs: [[[{ url: "https://old.example.com", title: "Old Tab", panelId: "main" }]]],
  });
  const parsedV5 = parseSnapshot(v5Input).snapshot;
  const editedV5 = {
    ...parsedV5,
    windows: {
      "1": {
        tabs: [{ id: "1", url: "https://edited.example.com", title: "Edited Tab", panelId: "main", parentId: -1, lvl: 0 }],
      },
    },
  };
  const exportedV5 = JSON.parse(serializeSnapshot(editedV5, true));
  assert(
    Array.isArray(exportedV5.tabs) &&
      exportedV5.tabs[0]?.[0]?.[0]?.url === "https://edited.example.com" &&
      !exportedV5.windows &&
      !exportedV5.rawTabsFormat,
    "serializeSnapshot exports edited v5 tabs and strips internal windows/rawTabsFormat"
  );

  console.log(`Snapshot Parser Tests Completed: ${passed} passed, ${failed} failed.\n`);
  return failed === 0;
}

if (typeof require !== "undefined" && require.main === module) {
  runSnapshotParserTests();
}
