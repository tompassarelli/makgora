import { assertEquals, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { AttackStyle } from "../../sim/codes";
import { ANUBARAK_MOVES } from "./moves";

test("His dash attack hits for 9.66% with growth 52.6, his authored 14.87% and 80.9 at ×0.65 after the 2026-10-30 field retune, and his down tilt keeps its authored 9.91% [k3 measure docs/design/roster.md]", () => {
  const dash = ANUBARAK_MOVES.normals[AttackStyle.dashAttack]?.regions[0]?.hit.effect;
  assertEquals(dash?.damage, f32(14.865119934082031 * f32(0.65)));
  assertEquals(dash?.growth, f32(80.93789672851562 * f32(0.65)));
  assertEquals(ANUBARAK_MOVES.normals[AttackStyle.downTilt]?.regions[0]?.hit.effect.damage, 9.910080909729004);
});
