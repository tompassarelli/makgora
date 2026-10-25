import { expect, test } from "bun:test";
import { damageLevelForKnockback, hitContextKnockback, HITSTUN_FRAMES_PER_KNOCKBACK } from "../src/game/sim/knockback";
import { SHIPPED_THRESHOLD_RULES, type ThresholdOptions, type ThresholdRules, compareThresholds } from "../scripts/meleeThresholds";
import { sweep } from "./sweep";

const MOVED_HITSTUN_FRAMES_PER_KNOCKBACK = HITSTUN_FRAMES_PER_KNOCKBACK + 0.01;
const tumblesMoved = (knockback: number): boolean => damageLevelForKnockback((knockback * MOVED_HITSTUN_FRAMES_PER_KNOCKBACK) / HITSTUN_FRAMES_PER_KNOCKBACK) === 3;
const MOVED_RULES: ThresholdRules = {
  ...SHIPPED_THRESHOLD_RULES,
  80: tumblesMoved,
  120: (knockback) => tumblesMoved(hitContextKnockback(knockback, true, false)),
};

function expectEveryDisagreementNamed(options: ThresholdOptions): void {
  const { comparisons, problems } = compareThresholds({ ...options, rules: MOVED_RULES });
  const disagreements = comparisons.filter((row) => row.agreement === "disagree").length;
  expect(disagreements).toBeGreaterThan(0);
  expect(problems.filter((problem) => problem.startsWith("threshold disagreement: ")).length).toBe(disagreements);
}

test("every threshold disagreement is a named problem when the hitstun factor moves [k2 property]", () => {
  expectEveryDisagreementNamed({ attacker: "falco" });
});

sweep("every FightCore threshold disagreement is a named problem when the hitstun factor moves [k2 property]", () => {
  expectEveryDisagreementNamed({});
}, 120_000);
