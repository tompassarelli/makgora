import { parseArgs } from "node:util";
import { type BranchPolicy, DEFAULT_POLICY, type StringMeasure, measureCombos } from "./agencyBranch";
import { DEFAULT_RULE, TICKS_PER_SECOND, flagString } from "./agencyCore";
import { DEFAULT_CONFIG, planMatches } from "./playtestCore";
import { ROSTER, observeReal } from "./playtest";

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: { first: { type: "string" }, count: { type: "string" }, repro: { type: "string" }, "min-hits": { type: "string" }, "max-strings": { type: "string" }, slack: { type: "string" }, horizon: { type: "string" }, out: { type: "string" } },
  strict: true,
});
const policy: BranchPolicy = { ...DEFAULT_POLICY, slack: Number(values.slack ?? DEFAULT_POLICY.slack), maxHorizon: Number(values.horizon ?? DEFAULT_POLICY.maxHorizon) };
const specs = values.repro === undefined ? planMatches(ROSTER, Number(values.first ?? 0), Number(values.count ?? 1)) : planMatches(ROSTER, Number(values.repro), 1);
const minHits = Number(values["min-hits"] ?? 2);
let budget = Number(values["max-strings"] ?? 20);
const measured: StringMeasure[] = [];
for (const spec of specs) {
  const observed = observeReal(spec, DEFAULT_CONFIG.frameCap);
  const chosen = observed.combos.filter((combo) => combo.hitFrames.length >= minHits).slice(0, Math.max(0, budget));
  budget -= chosen.length;
  measured.push(...measureCombos(spec, chosen, DEFAULT_CONFIG.frameCap, policy));
}
const text = JSON.stringify(measured, null, 1);
if (values.out === undefined) console.log(text);
else await Bun.write(values.out, `${text}\n`);
const flagged = measured.filter((string) => flagString(string, DEFAULT_RULE).length > 0).length;
console.error(`${measured.length} strings, ${measured.reduce((sum, string) => sum + string.links.length, 0)} links, ${flagged} flagged under E ${(100 * DEFAULT_RULE.escapeFloor).toFixed(0)}%, T ${DEFAULT_RULE.controlFrames / TICKS_PER_SECOND} s`);
