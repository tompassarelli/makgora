import { assertEquals, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { hurtCapsule } from "../physics/contactGeometry";
import { createFighter } from "./fighter";
import { SELECTABLE_CHARACTERS } from "./heroes/registry";
import { testWorld } from "./testWorld";
import { travelBeforeBodies } from "./travelStop";

test("body travel against an unshielded target depends on body overlap and is independent of either fighter's shield tuning [k2 property]", () => {
  for (const movingCharacter of SELECTABLE_CHARACTERS) {
    for (const targetCharacter of SELECTABLE_CHARACTERS) {
      const moving = createFighter(movingCharacter, 0.0, 1);
      const target = createFighter(targetCharacter, 0.0, -1);
      const world = testWorld(moving, target);
      const ownBody = hurtCapsule(movingCharacter);
      const body = hurtCapsule(targetCharacter);
      const radii = f32(ownBody.radius + body.radius);
      const ownMidpoint = f32(f32(ownBody.z1 + ownBody.z2) * 0.5);
      const targetMidpoint = f32(f32(body.z1 + body.z2) * 0.5);
      for (const facing of [-1, 1]) {
        moving.facing = facing;
        target.motion.x = f32(facing * radii);
        for (const ownShieldRaised of [false, true]) {
          moving.shield.raised = ownShieldRaised;
          for (const separation of [f32(-radii - 1.0), 0.0, f32(radii + 1.0)]) {
            target.motion.z = f32(f32(ownMidpoint - targetMidpoint) + separation);
            const label = `${movingCharacter}/${targetCharacter} facing ${facing} own shield ${ownShieldRaised} separation ${separation}`;
            const expected = separation === 0.0 ? 0.0 : 32.0;
            assertEquals(travelBeforeBodies(world, 0, 32.0, true), expected, `${label}: body overlap`);
            assertEquals(travelBeforeBodies(world, 0, 32.0, false), 32.0, `${label}: body stop disabled`);
            for (const fighter of [moving, target]) {
              const original = fighter.tuning.shield;
              for (const center of [-1024.0, 1024.0]) {
                for (const radius of [1.0, 2048.0]) {
                  fighter.tuning.shield = { centerX: center, centerZ: center, radius };
                  assertEquals(travelBeforeBodies(world, 0, 32.0, true), expected, `${label}: shield tuning cannot change body travel`);
                  assertEquals(travelBeforeBodies(world, 0, 32.0, false), 32.0, `${label}: shield tuning cannot enable body stopping`);
                }
              }
              fighter.tuning.shield = original;
            }
          }
        }
      }
    }
  }
});
