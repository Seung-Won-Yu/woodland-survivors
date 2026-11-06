// Planning calculation only. No runtime imports, play simulation, or measured success rates.
import {readFileSync} from 'node:fs';
const {quality} = JSON.parse(readFileSync(new URL('./reboot-rules.json', import.meta.url), 'utf8'));
const value = quality.toyUtility;
const distributions = {normal:quality.normal, raidSuccess:quality.raidSuccess, lightRaidSuccess:quality.lightRaidSuccess};
const round = n => Math.round(n * 10000) / 10000;
for (const [name, probabilities] of Object.entries(distributions)) {
  const sum = Object.values(probabilities).reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 1) > 1e-10) throw new Error(`${name}: probabilities must sum to 1`);
  if (Object.keys(value).some(tier => probabilities[tier] < 0)) throw new Error(`${name}: negative probability`);
}
const expected = probabilities => Object.entries(value).reduce((sum, [tier, utility]) => sum + probabilities[tier] * utility, 0);
const normal = expected(distributions.normal), raid = expected(distributions.raidSuccess);
const output = {
  status: 'unimplemented design assumptions, not DPS or observed play data',
  model: 'ordinal reward utility; failure loses only the offered crate; ignores damage, time, compatibility and score',
  value, distributions,
  normalUnseenCrateExpected: round(normal),
  raidSuccessContract: 'armored',
  successfulRaidConditionalExpected: round(raid),
  lightRaidConditionalExpected: round(expected(distributions.lightRaidSuccess)),
  successNeededToBeatUnseenCrate: round(normal / raid),
  revealedPrizeBreakEven: Object.fromEntries(Object.entries(value).map(([tier, utility]) => [tier, {
    successNeeded: round(utility / raid),
    canBeatPrizeInThisToyModel: utility / raid < 1
  }])),
  assumedSuccessCases: [0.4, 0.6, 0.7, 0.8].map(p => ({
    assumedSuccess: p,
    expectedRewardAfterFailureRisk: round(p * raid),
    deltaVsRevealedCommon: round(p * raid - value.common),
    deltaVsRevealedRare: round(p * raid - value.rare)
  })),
  decision: 'In this toy model, gambling can beat a revealed common prize at high success confidence, while a revealed rare prize favors keeping it. Actual utility must be tested with builds and health.'
};
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
