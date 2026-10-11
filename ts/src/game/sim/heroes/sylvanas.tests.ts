import { assertNear, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Character } from "../codes";
import { createFighter } from "../fighter";
import { duelPair } from "../testDuel";

function pair(gap = 100.0, facing = 1) {
  const owner = createFighter(Character.sylvanas, f32(-gap * 0.5 * facing), facing);
  owner.mana.points = 100;
  const target = createFighter(Character.rifleman, f32(gap * 0.5 * facing), -facing);
  return duelPair(owner, target);
}

test("Sylvanas has Pit's weight, run and air speed in world units [k4 reference ssbu]", () => {
  const { owner } = pair();
  assertNear(owner.tuning.physics.weight, 96.0, f32(0.00002));
  assertNear(owner.tuning.physics.runSpeed, f32(10.968), f32(0.00002));
  assertNear(owner.tuning.physics.airSpeed, f32(5.61), f32(0.00002));
});
