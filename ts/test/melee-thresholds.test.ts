import { expect, test } from "bun:test";
import { hitContextKnockback, TUMBLE_KNOCKBACK } from "../src/game/sim/knockback";
import { SHIPPED_THRESHOLD_RULES, type ThresholdOptions, type ThresholdRules, compareThresholds } from "../scripts/meleeThresholds";
import { sweep } from "./sweep";

const MOVED_TUMBLE_KNOCKBACK = TUMBLE_KNOCKBACK - 2;
const tumblesMoved = (knockback: number): boolean => knockback >= MOVED_TUMBLE_KNOCKBACK;
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

test("every threshold disagreement is a named problem when the tumble knockback moves [k2 property]", () => {
  expectEveryDisagreementNamed({ attacker: "falco" });
});

sweep("every FightCore threshold disagreement is a named problem when the tumble knockback moves [k2 property]", () => {
  expectEveryDisagreementNamed({});
}, 120_000);
