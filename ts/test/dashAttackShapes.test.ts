import { expect, test } from "bun:test";
import { judgeDashAttack } from "../scripts/dashAttackShapes";
import { dashAttacks } from "../scripts/meleeDashAttacks";

test("a Melee dash attack meets the rule, and one that stops dead fails only on travel [k2 property]", () => {
  const fox = dashAttacks.find((d) => d.name === "Fox");
  if (fox === undefined) throw new Error("no Fox dash attack");
  expect(judgeDashAttack(fox).measures.filter((m) => !m.pass)).toEqual([]);
  const stopped = judgeDashAttack({ ...fox, travel: fox.travel?.map(() => 0) });
  expect(stopped.measures.filter((m) => !m.pass).map((m) => m.measure.label)).toEqual(["Travel to the last hitbox", "Travel to actionable", "Travel to actionable ÷ run speed"]);
});
