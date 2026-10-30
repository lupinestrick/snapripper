import { runSnapshotParserTests } from "./snapshotParser.test";
import { runTreeOperationsTests } from "./treeOperations.test";

console.log("==========================================");
console.log("   SnapRipper Automated Test Suite");
console.log("==========================================\n");

const p1 = runSnapshotParserTests();
const p2 = runTreeOperationsTests();

if (p1 && p2) {
  console.log("🎉 ALL TESTS PASSED SUCCESSFULLY!");
  process.exit(0);
} else {
  console.error("❌ SOME TESTS FAILED!");
  process.exit(1);
}
