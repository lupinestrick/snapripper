import fs from "fs";
import { parseSnapshot, buildTabTree, serializeSnapshot } from "../src/services/snapshotParser";
import { DEFAULT_RULES_SETTINGS } from "../src/services/ruleEngine";
import { computeSnapshotDiff } from "../src/services/diffEngine";

const raw = fs.readFileSync("sidebery-snapshot-2026.10.22-00.48.27.json", "utf8");
const res = parseSnapshot(raw);
console.log("Total tabs parsed:", res.totalTabs);
console.log("Panels count:", Object.keys(res.snapshot.panels || {}).length);

// Test diff engine with dedup and rules
const diffResult = computeSnapshotDiff(
  res.snapshot,
  {
    enableDedup: true,
    enableRules: true,
    enableAICategorize: false,
  },
  DEFAULT_RULES_SETTINGS
);

console.log("Diff computed successfully!");
console.log("Total Deduped:", diffResult.totalDeduped);
console.log("Total Groups Created:", diffResult.totalGroupsCreated);
console.log("Panel diffs count:", diffResult.panelDiffs.length);
for (const p of diffResult.panelDiffs) {
  console.log(`  - Panel [${p.panelName}]: Before=${p.beforeTabs.length}, After=${p.afterTabs.length}, Groups=${p.addedGroupsCount}, Deduped=${p.dedupedCount}`);
}
