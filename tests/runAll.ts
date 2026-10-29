import { runSnapshotParserTests } from "./snapshotParser.test";
import { runTreeOperationsTests } from "./treeOperations.test";
import { runDomainMergeTests } from "./domainMergeEngine.test";

console.log("==========================================");
console.log("   SnapRipper Automated Test Suite");
console.log("==========================================\n");

const p1 = runSnapshotParserTests();
const p2 = runTreeOperationsTests();
const p3 = runDomainMergeTests();

if (p1 && p2 && p3) {
  console.log("🎉 ALL TESTS PASSED SUCCESSFULLY!");
  process.exit(0);
} else {
  console.error("❌ SOME TESTS FAILED!");
  process.exit(1);
}
