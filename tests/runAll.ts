import { runSnapshotParserTests } from "./snapshotParser.test";
import { runTreeOperationsTests } from "./treeOperations.test";
import { runDomainMergeTests } from "./domainMergeEngine.test";
import { runAIRestructureTests } from "./aiRestructure.test";

console.log("==========================================");
console.log("   SnapRipper Automated Test Suite");
console.log("==========================================\n");

const p1 = runSnapshotParserTests();
const p2 = runTreeOperationsTests();
const p3 = runDomainMergeTests();
const p4 = runAIRestructureTests();

if (p1 && p2 && p3 && p4.failed === 0) {
  console.log("\n🎉 ALL TESTS PASSED SUCCESSFULLY!");
  process.exit(0);
} else {
  console.error("\n❌ SOME TESTS FAILED!");
  process.exit(1);
}
