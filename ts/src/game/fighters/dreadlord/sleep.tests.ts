import { assertEquals, assertGreaterThan, assertLessThan, test } from "wisp/src/runtime/testing";
import { Action } from "../../input/actions";
import { fighter, frame, scene } from "../../match/padScene";
import { Character, HeroStatusKind } from "../../sim/codes";

const SLEEP_ORB = [Action.special, Action.moveDown];
const ORB_GAP = 250.0;
const AIR_HEIGHT = 40.0;
const WATCHED_FRAMES = 400;
const SLEEP_FRAMES = 160;

function sleepFrames(airborne: boolean): number {
  const s = scene(0, [{ character: Character.dreadlord, x: 0.0, facing: 1 }, { character: Character.rifleman, x: ORB_GAP, facing: -1 }]);
  const victim = fighter(s, 1);
  const hover = (): void => {
    if (!airborne || victim.status.condition === HeroStatusKind.sleep) return;
    victim.motion.grounded = false;
    victim.motion.surface = undefined;
    victim.motion.z = AIR_HEIGHT;
    victim.motion.vz = 0.0;
  };
  hover();
  frame(s, [], []);
  frame(s, SLEEP_ORB, []);
  let asleep = 0;
  let airborneAtHit = false;
  for (let tick = 1; tick <= WATCHED_FRAMES; tick++) {
    frame(s, [], []);
    if (victim.status.condition === HeroStatusKind.sleep) {
      if (asleep === 0) airborneAtHit = !victim.motion.grounded;
      asleep++;
    }
    hover();
  }
  assertEquals(airborneAtHit, airborne);
  return asleep;
}

test("Sleep keeps a grounded fighter and an airborne one asleep for the same 160 frames, one second longer than the old grounded 100 [k3 measure docs/design/kit-review-2.md]", () => {
  const ground = sleepFrames(false);
  const air = sleepFrames(true);
  assertGreaterThan(ground, SLEEP_FRAMES - 3);
  assertLessThan(ground, SLEEP_FRAMES + 1);
  assertEquals(air, ground);
});
