import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, Character } from "../../sim/codes";
import { type Capsule, placeCapsule } from "../../sim/geometry/contactGeometry";
import { authoredHitRegion, authoredHitRegionCount, emptyHitRegion } from "../../sim/hitRegions";
import { WARDEN_MOVES } from "./moves";

const ACTIVE_FRAMES = [7, 9, 11, 13];
const COS_TILT = f32(0.866025404);
const SIN_TILT = 0.5;
const ON_LINE = f32(0.01);
const ORIGIN_X = 300.0;
const ORIGIN_Z = 200.0;

test("Maiev's down air drills feet first: every hit's strikes sit on her body's axis tilted 30 degrees off vertical toward her facing, at her feet, for either facing [k3 measure #507]", () => {
  const body = WARDEN_MOVES.hurtboxes?.stand[0];
  assertTrue(body !== undefined);
  if (body === undefined) return;
  const pivotZ = f32(f32(body.z1 + body.z2) * 0.5);
  const foot = f32(f32(f32(body.z2 - body.z1) * 0.5) + body.radius);
  const region = emptyHitRegion();
  const placed: Capsule = { x1: 0.0, z1: 0.0, x2: 0.0, z2: 0.0, radius: 0.0 };
  for (const facing of [1, -1]) {
    const axisX = f32(SIN_TILT * facing);
    for (const frame of ACTIVE_FRAMES) {
      let strikes = 0;
      for (let index = 0; index < authoredHitRegionCount(AttackStyle.downAir, WARDEN_MOVES); index++) {
        authoredHitRegion(region, Character.warden, AttackStyle.downAir, frame - 1, 0, index, WARDEN_MOVES);
        if (region.strike === undefined) continue;
        strikes++;
        placeCapsule(placed, region.strike, ORIGIN_X, ORIGIN_Z, facing);
        const dx = f32(f32(f32(placed.x1 + placed.x2) * 0.5) - ORIGIN_X);
        const dz = f32(f32(f32(placed.z1 + placed.z2) * 0.5) - f32(ORIGIN_Z + pivotZ));
        const along = f32(f32(dx * axisX) - f32(dz * COS_TILT));
        const across = f32(f32(dx * COS_TILT) + f32(dz * axisX));
        assertTrue(Math.abs(across) <= ON_LINE);
        assertTrue(dz < 0.0 && f32(dx * facing) > 0.0);
        assertTrue(Math.abs(f32(along - foot)) <= placed.radius);
      }
      assertEquals(strikes, 3);
    }
  }
});

const BACK_AIR_FIRST = 4;
const BACK_AIR_LAST = 19;
const DRAWN_HEEL_BACK = 80.0;
const DRAWN_HEEL_Z = 80.5;
const DRAWN_KNEE_BACK = 37.0;
const DRAWN_KNEE_Z = 64.5;

function insideStrike(placed: Readonly<Capsule>, x: number, z: number): boolean {
  const dx = f32(placed.x2 - placed.x1), dz = f32(placed.z2 - placed.z1);
  const t = Math.max(0.0, Math.min(1.0, f32(f32(f32(f32(x - placed.x1) * dx) + f32(f32(z - placed.z1) * dz)) / f32(f32(dx * dx) + f32(dz * dz)))));
  const ox = f32(x - f32(placed.x1 + f32(dx * t))), oz = f32(z - f32(placed.z1 + f32(dz * t)));
  return f32(f32(ox * ox) + f32(oz * oz)) <= f32(placed.radius * placed.radius);
}

test("Maiev's back air is Illidan's held back kick on her drawn leg: every frame from 4 to 19 has one strike behind her covering her drawn heel and knee, and the frames around it none, for either facing [k3 measure docs/design/maiev.md]", () => {
  const region = emptyHitRegion();
  const placed: Capsule = { x1: 0.0, z1: 0.0, x2: 0.0, z2: 0.0, radius: 0.0 };
  for (const facing of [1, -1]) {
    for (let frame = BACK_AIR_FIRST - 1; frame <= BACK_AIR_LAST + 1; frame++) {
      let strikes = 0;
      for (let index = 0; index < authoredHitRegionCount(AttackStyle.backAir, WARDEN_MOVES); index++) {
        authoredHitRegion(region, Character.warden, AttackStyle.backAir, frame - 1, 0, index, WARDEN_MOVES);
        if (region.strike === undefined) continue;
        strikes++;
        placeCapsule(placed, region.strike, ORIGIN_X, ORIGIN_Z, facing);
        assertTrue(insideStrike(placed, f32(ORIGIN_X - f32(DRAWN_HEEL_BACK * facing)), f32(ORIGIN_Z + DRAWN_HEEL_Z)));
        assertTrue(insideStrike(placed, f32(ORIGIN_X - f32(DRAWN_KNEE_BACK * facing)), f32(ORIGIN_Z + DRAWN_KNEE_Z)));
        assertTrue(!insideStrike(placed, f32(ORIGIN_X + f32(DRAWN_KNEE_BACK * facing)), f32(ORIGIN_Z + DRAWN_KNEE_Z)));
      }
      assertEquals(strikes, frame >= BACK_AIR_FIRST && frame <= BACK_AIR_LAST ? 1 : 0);
    }
  }
});
