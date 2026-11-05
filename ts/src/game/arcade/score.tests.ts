import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { beatsScore, scoreRun, type ClearedFight, type RunStats } from "./score";

const fights = (...entries: readonly [ClearedFight["kind"], number][]): ClearedFight[] => entries.map(([kind, seconds]) => ({ kind, seconds }));

const RUN: RunStats = {
  tier: "grunt",
  fights: fights(["hallway", 60], ["hallway", 90], ["stamina", 200], ["hallway", 45], ["hallway", 80], ["team", 150], ["rival", 100]),
  damageTaken: 120,
  bonusDamage: 85,
  bonusCombo: 7,
  continues: 1,
  runSeconds: 760,
};

test("a fixed run scores the design formula term by term: 1,000 a fight, 10 a second under par never below 0, 3,000 less 10 a percent taken, the bonus stage and 2,000 a continue [k3 measure docs/design/arcade-mode.md]", () => {
  const terms = scoreRun(RUN);
  assertEquals(terms.clears, 7000);
  assertEquals(terms.speed, 300 + 0 + 0 + 450 + 100 + 300 + 500);
  assertEquals(terms.damage, 1800);
  assertEquals(terms.bonus, 850 + 700);
  assertEquals(terms.continues, -2000);
  assertEquals(terms.total, 7000 + 1650 + 1800 + 1550 - 2000);
  assertEquals(terms.total, 10000);
});

test("damage points stop at 0 however much damage the run took, and a run with no continues pays no penalty [k3 measure docs/design/arcade-mode.md]", () => {
  const terms = scoreRun({ ...RUN, damageTaken: 301, continues: 0 });
  assertEquals(terms.damage, 0);
  assertEquals(terms.continues, 0);
  assertEquals(scoreRun({ ...RUN, damageTaken: 300 }).damage, 0);
  assertEquals(scoreRun({ ...RUN, damageTaken: 299 }).damage, 10);
});

test("a perfect run stays far below 2^31, the Warcraft build's integer limit [k3 measure docs/design/arcade-mode.md]", () => {
  const perfect: RunStats = { ...RUN, fights: fights(["hallway", 0], ["hallway", 0], ["stamina", 0], ["hallway", 0], ["hallway", 0], ["team", 0], ["rival", 0]), damageTaken: 0, continues: 0, bonusDamage: 300, bonusCombo: 30 };
  assertTrue(scoreRun(perfect).total < 100000);
});

test("equal scores break on the shorter run, a higher score always wins and a first score always counts [k3 measure docs/design/arcade-mode.md]", () => {
  assertTrue(beatsScore({ total: 9000, runSeconds: 600 }, { total: 9000, runSeconds: 601 }));
  assertFalse(beatsScore({ total: 9000, runSeconds: 601 }, { total: 9000, runSeconds: 600 }));
  assertFalse(beatsScore({ total: 9000, runSeconds: 600 }, { total: 9000, runSeconds: 600 }));
  assertTrue(beatsScore({ total: 9001, runSeconds: 900 }, { total: 9000, runSeconds: 300 }));
  assertFalse(beatsScore({ total: 8999, runSeconds: 300 }, { total: 9000, runSeconds: 900 }));
  assertTrue(beatsScore({ total: 0, runSeconds: 0 }, undefined));
});
