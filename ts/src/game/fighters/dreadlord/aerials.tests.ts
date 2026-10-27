import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, Character } from "../../sim/codes";
import { type Capsule, placeCapsule } from "../../sim/geometry/contactGeometry";
import { authoredHitRegion, authoredHitRegionCount, emptyHitRegion } from "../../sim/hitRegions";
import { attackStartupFrames } from "../../sim/moves";
import { DREADLORD_MOVES } from "./moves";

const ORIGIN_X = 300.0;
const ORIGIN_Z = 200.0;
const ACTIVE = 4;
const STEEPEST_DROP = f32(0.7);

interface Reach { readonly nearX: number; readonly nearZ: number; readonly farX: number; readonly farZ: number }

function reaches(style: AttackStyle, facing: number): Reach[] {
  const region = emptyHitRegion();
  const placed: Capsule = { x1: 0.0, z1: 0.0, x2: 0.0, z2: 0.0, radius: 0.0 };
  const first = attackStartupFrames(style, DREADLORD_MOVES);
  const out: Reach[] = [];
  for (let frame = first; frame < first + ACTIVE; frame++) {
    for (let index = 0; index < authoredHitRegionCount(style, DREADLORD_MOVES); index++) {
      authoredHitRegion(region, Character.dreadlord, style, frame, 0, index, DREADLORD_MOVES);
      if (region.strike === undefined) continue;
      placeCapsule(placed, region.strike, ORIGIN_X, ORIGIN_Z, facing);
      const a = { x: f32(f32(placed.x1 - ORIGIN_X) * facing), z: f32(placed.z1 - ORIGIN_Z) };
      const b = { x: f32(f32(placed.x2 - ORIGIN_X) * facing), z: f32(placed.z2 - ORIGIN_Z) };
      const [near, far] = Math.abs(a.x) <= Math.abs(b.x) ? [a, b] : [b, a];
      out.push({ nearX: near.x, nearZ: near.z, farX: far.x, farZ: far.z });
    }
  }
  return out;
}

test("Mal'Ganis's back air kicks level behind him: on every active frame, in either facing, the hoof strike runs from his hip back, never rising and never dropping more than 35 degrees toward its far end [k2 property]", () => {
  for (const facing of [1, -1]) {
    const strikes = reaches(AttackStyle.backAir, facing);
    assertEquals(strikes.length, ACTIVE);
    for (const strike of strikes) {
      assertTrue(strike.farX < -60.0 && strike.nearX < 0.0);
      assertTrue(strike.farZ <= strike.nearZ);
      assertTrue(f32(strike.nearZ - strike.farZ) < f32(f32(strike.nearX - strike.farX) * STEEPEST_DROP));
      assertTrue(strike.farZ > 30.0 && strike.nearZ < 90.0);
    }
  }
});

test("Mal'Ganis's forward air rakes down in front of him: every active frame's claw strike reaches forward, and its tip falls frame by frame, in either facing [k2 property]", () => {
  for (const facing of [1, -1]) {
    const strikes = reaches(AttackStyle.forwardAir, facing);
    assertEquals(strikes.length, ACTIVE);
    let previous = Infinity;
    for (const strike of strikes) {
      assertTrue(strike.farX > 80.0 && strike.nearX > 40.0);
      assertTrue(strike.farZ < previous);
      previous = strike.farZ;
    }
  }
});
