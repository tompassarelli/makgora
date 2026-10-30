import { assertEquals, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { AttackStyle } from "../../sim/codes";
import { CHEN_MOVES } from "./moves";

test("His dash attack hits for 7.76% and launches with growth 55.4 and his forward tilt for 7.59%, after the 2026-10-30 field retune that took damage and growth to ×0.72 and the dash attack a further ×0.92 [k3 measure docs/design/chen.md]", () => {
  const dash = CHEN_MOVES.normals[AttackStyle.dashAttack]?.regions[0]?.hit.effect;
  assertEquals(dash?.damage, f32(f32(f32(9.370200157165527 * f32(0.92)) * 1.25) * f32(0.72)));
  assertEquals(dash?.growth, f32(f32(83.63581085205078 * f32(0.92)) * f32(0.72)));
  const tilt = CHEN_MOVES.normals[AttackStyle.forwardTilt]?.regions[0]?.hit.effect;
  assertEquals(tilt?.damage, f32(f32(8.43317985534668 * 1.25) * f32(0.72)));
});
