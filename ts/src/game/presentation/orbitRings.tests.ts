import { f32 } from "wisp/src/sim/f32";
import { assertEquals, assertGreaterThan, assertLessThan, test } from "wisp/src/runtime/testing";
import { AttackStyle, Character } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { authoredHitRegion, authoredHitRegionCount, emptyHitRegion } from "../sim/hitRegions";
import "../roster/kits";
import { FROST_HALO_RADIUS, ORBIT_RINGS, orbitRingStep } from "./orbitRings";

test("Lich's frost halo ring sits within a tenth of the hit radius on every active frame of his neutral air and is drawn nowhere else [k2 property]", () => {
  const lich = createFighter(Character.lich, 0.0, 1);
  const moves = lich.tuning.moves;
  const scratch = emptyHitRegion();
  const count = authoredHitRegionCount(AttackStyle.neutralAir, moves);
  let active = 0;
  lich.attack.style = AttackStyle.neutralAir;
  for (let frame = 1; frame <= 40; frame++) {
    lich.attack.frame = frame;
    const step = orbitRingStep(lich);
    for (let index = 0; index < count; index++) {
      if (authoredHitRegion(scratch, Character.lich, AttackStyle.neutralAir, frame, 0, index, moves).effect.damage <= 0.0) continue;
      active++;
      assertEquals(step !== undefined, true);
      assertLessThan(Math.abs((step?.radius ?? 0.0) - FROST_HALO_RADIUS), f32(FROST_HALO_RADIUS * f32(0.1)));
      break;
    }
  }
  assertGreaterThan(active, 8);
  assertEquals(ORBIT_RINGS[Character.lich]?.steps[40], undefined);
  lich.attack.frame = 9;
  lich.attack.style = AttackStyle.forwardAir;
  assertEquals(orbitRingStep(lich), undefined);
});
