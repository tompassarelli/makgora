import { assertEquals, assertGreaterThan, assertLessThan, test } from "wisp/src/runtime/testing";
import { Action } from "../../input/actions";
import { fighter, frame, scene } from "../../match/padScene";
import { Character, HeroStatusKind } from "../../sim/codes";

const SLEEP_ORB = [Action.special, Action.moveDown];
const ORB_GAP = 250.0;
const AIR_HEIGHT = 40.0;
const WATCHED_FRAMES = 400;
const GROUND_SLEEP_FRAMES = 160;
const AIR_SLEEP_FRAMES = 24;

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
  for (let tick = 1; tick <= WATCHED_FRAMES; tick++) {
    frame(s, [], []);
    if (victim.status.condition === HeroStatusKind.sleep) asleep++;
    hover();
  }
  return asleep;
}

test("Sleep keeps a grounded fighter asleep for one second longer than the old 100 frames, 160 at 60 frames a second, and still an airborne one for 24 [k3 measure docs/design/kit-review-2.md]", () => {
  const ground = sleepFrames(false);
  assertGreaterThan(ground, GROUND_SLEEP_FRAMES - 3);
  assertLessThan(ground, GROUND_SLEEP_FRAMES + 1);
  assertEquals(sleepFrames(true), AIR_SLEEP_FRAMES);
});
