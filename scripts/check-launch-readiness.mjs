// Fails while anything recorded in code still blocks a public launch or store submission.
// The operational and legal gates are listed in docs/PILOT_SCOPE.md and must be checked there.
const { launchBlockers } = await import('../packages/domain/src/pilot.ts');

const blockers = launchBlockers();
if (blockers.length) {
  console.log('NOT READY TO LAUNCH:');
  for (const item of blockers) console.log(`- ${item}`);
  console.log('Also confirm the remaining gates in docs/PILOT_SCOPE.md.');
  process.exit(1);
}
console.log('No blockers recorded in code. Confirm the remaining gates in docs/PILOT_SCOPE.md.');
