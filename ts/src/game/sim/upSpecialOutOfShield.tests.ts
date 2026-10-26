import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { Character, SpecialAction } from "./codes";
import { createFighter } from "./fighter";
import { type Controls } from "./roster";
import { controls } from "./testWorld";
import { duelPair, stepDuel } from "./testDuel";

const shield = (fields: Partial<Controls> = {}): Controls => controls({ shield: true, shieldTriggerActive: true, shieldStrength: 1.0, ...fields });

test("Up special out of shield: a jump out of shield, then up special on jump-squat frame 1, cancels the 5-frame jump squat and starts Rifleman's recovery that frame, on frame 1 and still grounded [k3 measure #534]", () => {
  const { world, owner } = duelPair(createFighter(Character.rifleman, 0.0, 1), createFighter(Character.rifleman, -500.0, 1));
  for (let n = 0; n < 10; n++) stepDuel(world, shield());
  assertTrue(owner.shield.raised);
  stepDuel(world, shield({ jumpPressed: true, jumpHeld: true }));
  assertEquals(owner.jump.squat, 5, "the jump out of shield enters Rifleman's 5-frame jump squat");
  stepDuel(world, controls({ jumpHeld: true, specialPressed: true, specialZ: 1, verticalDirection: 1 }));
  assertEquals(owner.special.action, SpecialAction.riflemanRecovery, "the up special starts on jump-squat frame 1");
  assertEquals(owner.special.frame, 1, "the up special is on its first frame");
  assertEquals(owner.jump.squat, 0, "the up special cancels the jump squat");
  assertTrue(owner.motion.grounded);
});
