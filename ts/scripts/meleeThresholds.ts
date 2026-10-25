import { join } from "node:path";
import { addFloat32, multiplyFloat32, roundToFloat32, subtractFloat32 } from "wisp/src/sim/binary32";
import { readCharacterAttributes } from "../../references/melee-frame-data/character-attributes";
import {
  FIGHTCORE_THRESHOLDS_FILE, type PhaseHitbox, THRESHOLD_KNOCKBACKS, type Threshold, type ThresholdKnockback, type ThresholdPercent,
  readFightCorePhases, readFightCoreThresholds,
} from "../../references/melee-frame-data/fightcore-thresholds";
import { ORDINARY_HIT_CONTEXT_SCALE, contactKnockback, damageLevelForKnockback, fixedHitKnockback, hitContextKnockback, ordinaryHitKnockback } from "../src/game/sim/knockback";

const ROOT = join(import.meta.dir, "../..");

export const MELEE_PERCENT_LIMIT = 999;
export const SAKURAI_GROUNDED_KNOCKBACK = 32;
export const WEIGHT_INDEPENDENT_WEIGHT = 100;

export const SAKURAI_SOURCE = "https://www.ssbwiki.com/Sakurai_angle";
export const STALING_SOURCE = "https://www.ssbwiki.com/Stale-move_negation";
export const TIE_LEDGER_ROW = "knockback-threshold-ties";
export const ABOVE_LIMIT_LEDGER_ROW = "knockback-threshold-percent-limit";
export const ZERO_GROWTH_LEDGER_ROW = "knockback-zero-growth";

export interface ThresholdHit {
  readonly damage: number;
  readonly base: number;
  readonly growth: number;
  readonly set: number;
  readonly weight: number;
}

const tumbles = (knockback: number): boolean => damageLevelForKnockback(knockback) === 3;
const crouchCancelled = (knockback: number): number => hitContextKnockback(knockback, true, false);

export type ThresholdRules = Readonly<Record<ThresholdKnockback, (knockback: number) => boolean>>;

export const SHIPPED_THRESHOLD_RULES: ThresholdRules = {
  80: tumbles,
  120: (knockback) => tumbles(crouchCancelled(knockback)),
  32: (knockback) => knockback >= SAKURAI_GROUNDED_KNOCKBACK,
  48: (knockback) => crouchCancelled(knockback) >= SAKURAI_GROUNDED_KNOCKBACK,
};

function lowestPercent(rules: ThresholdRules, threshold: ThresholdKnockback, knockbackAt: (preHitPercent: number) => number): ThresholdPercent {
  const reaches = (percent: number): boolean => rules[threshold](knockbackAt(percent));
  if (!reaches(MELEE_PERCENT_LIMIT)) return "never";
  let [low, high] = [-1, MELEE_PERCENT_LIMIT];
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (reaches(middle)) high = middle;
    else low = middle;
  }
  return high;
}

function shippedKnockback(hit: ThresholdHit, preHitPercent: number): number {
  if (hit.set > 0) return fixedHitKnockback(hit.set, hit.weight, hit.growth, hit.base, ORDINARY_HIT_CONTEXT_SCALE);
  return ordinaryHitKnockback(preHitPercent, hit.damage, hit.weight, hit.growth, hit.base, ORDINARY_HIT_CONTEXT_SCALE);
}

// Melee-only: a stale non-projectile hit adds its staled damage to the percent but keeps its fresh damage in the knockback term.
export function meleeStaledKnockback(hit: ThresholdHit, preHitPercent: number, staleness: number): number {
  if (hit.set > 0) return shippedKnockback(hit, preHitPercent);
  const staledDamage = multiplyFloat32(roundToFloat32(hit.damage), subtractFloat32(1.0, roundToFloat32(staleness)));
  const postHitPercent = addFloat32(roundToFloat32(preHitPercent), staledDamage);
  return contactKnockback(postHitPercent, hit.damage, hit.weight, hit.growth, hit.base, ORDINARY_HIT_CONTEXT_SCALE);
}

export const shippedThresholdPercent = (hit: ThresholdHit, threshold: ThresholdKnockback, rules = SHIPPED_THRESHOLD_RULES): ThresholdPercent =>
  lowestPercent(rules, threshold, (percent) => shippedKnockback(hit, percent));

export const meleeStaledThresholdPercent = (hit: ThresholdHit, threshold: ThresholdKnockback, staleness: number, rules = SHIPPED_THRESHOLD_RULES): ThresholdPercent =>
  lowestPercent(rules, threshold, (percent) => meleeStaledKnockback(hit, percent, staleness));

const exact = (value: number): bigint => {
  if (!Number.isInteger(value)) throw new Error(`exact knockback needs integer hit data, got ${value}`);
  return BigInt(value);
};

export function knockbackEqualsExactly(hit: ThresholdHit, preHitPercent: number, staleness: number, knockback: number): boolean {
  if (hit.set > 0) return false;
  const [damage, base, growth, weight, stale] = [hit.damage, hit.base, hit.growth, hit.weight, Math.round(staleness * 100)].map(exact) as [bigint, bigint, bigint, bigint, bigint];
  const postHitPercentHundredths = 100n * exact(preHitPercent) + damage * (100n - stale);
  const scaledGrowth = (14n * postHitPercentHundredths * (damage + 2n) + 1800n * (weight + 100n)) * growth;
  return scaledGrowth === 10000n * (exact(knockback) - base) * (weight + 100n);
}

export type Agreement = "agree" | "tie" | "above limit" | "zero growth" | "disagree";

export interface ThresholdComparison {
  readonly record: Threshold;
  readonly threshold: ThresholdKnockback;
  readonly staleness: number;
  readonly fightCore: ThresholdPercent;
  readonly ours: ThresholdPercent;
  readonly agreement: Agreement;
}

export interface ThresholdReport {
  readonly comparisons: readonly ThresholdComparison[];
  readonly problems: readonly string[];
}

function agreement(hit: ThresholdHit, threshold: ThresholdKnockback, staleness: number, fightCore: ThresholdPercent, ours: ThresholdPercent): Agreement {
  if (fightCore === ours) return "agree";
  if (typeof fightCore === "number" && fightCore > MELEE_PERCENT_LIMIT && ours === "never") return "above limit";
  if (fightCore === "never" && hit.growth === 0 && hit.set === 0 && ours === 0) return "zero growth";
  if (fightCore === "never" || ours === "never" || Math.abs(fightCore - ours) !== 1) return "disagree";
  return knockbackEqualsExactly(hit, Math.min(fightCore, ours), staleness, threshold) ? "tie" : "disagree";
}

const nameKey = (name: string): string => name.toLowerCase().replace(/[^a-z]/g, "").replace(/^mr(?=gamewatch$)/, "");

const sameHit = (left: PhaseHitbox, right: PhaseHitbox): boolean =>
  left.damage === right.damage && left.base_knockback === right.base_knockback && left.knockback_growth === right.knockback_growth
  && left.set_knockback === right.set_knockback && left.weight_independent === right.weight_independent;

const recordName = (record: Threshold): string => `${record.character} ${record.move} phase ${record.phase} ${record.hitboxes.join("+")} against ${record.target}`;

const describe = ({ record, threshold, staleness, fightCore, ours }: ThresholdComparison): string =>
  `${recordName(record)}, knockback ${threshold}, staleness ${staleness}: FightCore ${fightCore}%, ours ${ours}%`;

export interface ThresholdOptions {
  readonly root?: string;
  readonly rules?: ThresholdRules;
  readonly attacker?: string;
}

export function compareThresholds({ root = ROOT, rules = SHIPPED_THRESHOLD_RULES, attacker }: ThresholdOptions = {}): ThresholdReport {
  const weights = new Map(readCharacterAttributes(root).map((row) => [nameKey(row.character), row.weight[0]]));
  const phases = new Map(readFightCorePhases(root).map((phase) => [`${phase.character} ${phase.move} ${phase.phase}`, phase]));
  const comparisons: ThresholdComparison[] = [];
  const problems: string[] = [];
  for (const record of readFightCoreThresholds(root).filter((entry) => attacker === undefined || entry.character === attacker)) {
    const hitboxes = record.hitboxes.map((id) => phases.get(`${record.character} ${record.move} ${record.phase}`)?.hitboxes.find((hitbox) => hitbox.name === id));
    const [first] = hitboxes;
    if (first === undefined || hitboxes.some((hitbox) => hitbox === undefined || !sameHit(hitbox, first))) {
      problems.push(`${recordName(record)}: its hitboxes are missing from the phase records or differ in damage, base, growth or set knockback`);
      continue;
    }
    const weight = weights.get(nameKey(record.target));
    if (weight === undefined || weight !== record.target_weight) {
      problems.push(`${recordName(record)}: weight ${weight ?? "missing"} in character-attributes.csv, FightCore ${record.target_weight}`);
      continue;
    }
    const hit: ThresholdHit = {
      damage: first.damage, base: first.base_knockback, growth: first.knockback_growth, set: first.set_knockback,
      weight: first.weight_independent ? WEIGHT_INDEPENDENT_WEIGHT : weight,
    };
    for (const threshold of THRESHOLD_KNOCKBACKS) {
      const percents = record.percent[threshold];
      if (percents === undefined) continue;
      if (percents.length !== record.staleness.length) problems.push(`${recordName(record)}: ${percents.length} percents for ${record.staleness.length} staleness levels at knockback ${threshold}`);
      percents.forEach((fightCore, index) => {
        const staleness = record.staleness[index] ?? 0;
        const ours = staleness === 0 ? shippedThresholdPercent(hit, threshold, rules) : meleeStaledThresholdPercent(hit, threshold, staleness, rules);
        comparisons.push({ record, threshold, staleness, fightCore, ours, agreement: agreement(hit, threshold, staleness, fightCore, ours) });
      });
    }
  }
  const disagreements = comparisons.filter((row) => row.agreement === "disagree").map((row) => `threshold disagreement: ${describe(row)}`);
  return { comparisons, problems: [...problems, ...disagreements] };
}

function namedRows(comparisons: readonly ThresholdComparison[], kind: Agreement, title: string): string[] {
  const rows = comparisons.filter((row) => row.agreement === kind);
  const moves = [...new Set(rows.map(({ record }) => `${record.character} ${record.move} phase ${record.phase} ${record.hitboxes.join("+")}`))];
  return rows.length === 0 ? [] : ["", `${rows.length} ${title}, in ${moves.length} hitbox groups:`, ...moves.map((move) => `  ${move}`)];
}

export function formatThresholds({ comparisons, problems }: ThresholdReport): string {
  const line = (label: string, rows: readonly ThresholdComparison[]): string => {
    const count = (kind: Agreement): number => rows.filter((row) => row.agreement === kind).length;
    return `    ${label.padEnd(28)} ${String(rows.length).padStart(6)} percents: ${count("agree")} agree, ${count("tie")} exact ties, ${count("above limit")} above 999%, ${count("zero growth")} zero growth, ${count("disagree")} disagree`;
  };
  const ties = comparisons.filter((row) => row.agreement === "tie");
  return [
    "",
    `knockdown thresholds: FightCore's lowest pre-hit percents in ${FIGHTCORE_THRESHOLDS_FILE}`,
    `    fresh through ts/src/game/sim/knockback.ts; stale through the Melee-only staling path meleeStaledKnockback (${STALING_SOURCE}); 32 and 48 are the Sakurai-angle edges (${SAKURAI_SOURCE})`,
    line("fresh (shipped knockback)", comparisons.filter((row) => row.staleness === 0)),
    line("stale (Melee staling path)", comparisons.filter((row) => row.staleness !== 0)),
    ...THRESHOLD_KNOCKBACKS.map((threshold) => line(`knockback ${threshold}`, comparisons.filter((row) => row.threshold === threshold))),
    line("all", comparisons),
    ...(ties.length === 0 ? [] : ["", `exact ties (knockback equals the threshold in exact arithmetic; ledger row ${TIE_LEDGER_ROW}):`, ...ties.map((row) => `  ${describe(row)}`)]),
    ...namedRows(comparisons, "above limit", `FightCore percents above Melee's ${MELEE_PERCENT_LIMIT}% limit, never in ours (ledger row ${ABOVE_LIMIT_LEDGER_ROW})`),
    ...namedRows(comparisons, "zero growth", `zero-growth hitboxes whose base knockback reaches the threshold at 0%, which FightCore shows as never (ledger row ${ZERO_GROWTH_LEDGER_ROW})`),
    ...(problems.length === 0 ? [] : ["", "threshold problems:", ...problems.map((problem) => `  ${problem}`)]),
  ].join("\n");
}
