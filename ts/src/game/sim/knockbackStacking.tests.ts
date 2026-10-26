import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { Character } from "./codes";
import { createFighter } from "./fighter";
import { ageKnockback, installDamageLaunch } from "./knockback";

const SECOND_HIT_FRAMES = 12;

function secondHitLaunch(grounded: boolean): { readonly x: number; readonly z: number; readonly grounded: boolean } {
  const f = createFighter(Character.rifleman, 0.0, 1);
  installDamageLaunch(f, 50.0, 1.0, 0.0, grounded);
  for (let n = 0; n < SECOND_HIT_FRAMES; n++) ageKnockback(f);
  installDamageLaunch(f, 30.0, -1.0, 0.0, grounded);
  return { x: f.launch.knockbackX, z: f.launch.knockbackZ, grounded: f.motion.grounded };
}

test("A second hit 12 frames after the first replaces the launch of a victim it leaves grounded and merges with the launch of an airborne victim, as Melee does (smashcraft#536) [k4 reference melee]", () => {
  const grounded = secondHitLaunch(true);
  assertTrue(grounded.grounded);
  assertEquals(grounded.x, -5.399999618530273);
  assertEquals(grounded.z, 0.0);
  const airborne = secondHitLaunch(false);
  assertFalse(airborne.grounded);
  assertEquals(airborne.x, 3.6000003814697266);
  assertEquals(airborne.z, 0.0);
});
