import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { canonicalState } from "../../replay/canonical";
import { copyReplayState, createReplaySnapshot } from "../../replay/snapshot";
import { Character } from "../../sim/codes";
import { floorBelow, mainDeckRight, mainDeckZ } from "../../sim/stage";
import { type Duel, type Press, type Stick, stickDuel, step } from "../stickDuel";

const PRESS_TICK = 12;
const FAR = 3000.0;
const DIAGONAL = f32(0.7);
const NEUTRAL: Stick = { x: 0, z: 0 };

type Script = (offset: number, facing: number) => Stick;
type Segment = readonly [x: number, z: number, frames: number];

const held = (x: number, z: number): Script => (_offset, facing) => ({ x: x * facing, z });

function ending(segments: readonly Segment[], after: Stick = NEUTRAL): Script {
  return (offset, facing) => {
    if (offset > 0) return { x: after.x * facing, z: after.z };
    let cursor = 0;
    for (let index = segments.length - 1; index >= 0; index--) {
      const [x, z, frames] = segments[index] ?? [0, 0, 0];
      if (offset > cursor - frames) return { x: x * facing, z };
      cursor -= frames;
    }
    return NEUTRAL;
  };
}

const quarterCircle = (stepFrames: number, holdFrames: number): Script => ending([[0, -1, stepFrames], [1, -1, stepFrames], [1, 0, holdFrames]]);
const pressAt = (tick: number): Press => (tick === PRESS_TICK ? "down" : "none");

function thrallDuel(foeAhead = FAR, facing = 1, casterX = 0.0, foe: Character = Character.peon): Duel {
  return stickDuel(Character.thrall, foe, foeAhead, facing, casterX);
}

const FORMS: readonly (readonly [string, Script])[] = [
  ["spirit wolf", held(0, -1)], ["timber wolves", held(DIAGONAL, -DIAGONAL)], ["dire wolf", quarterCircle(3, 3)],
];

test("A rollback replays every wolf form from before the cast, mid-run and mid-fall to the same state [k1 scenario]", () => {
  for (const [, script] of FORMS) {
    for (const saveTick of [PRESS_TICK - 2, PRESS_TICK + 20, PRESS_TICK + 45]) {
      const run = thrallDuel(500.0, 1, f32(mainDeckRight(0) - 300.0));
      const snapshot = createReplaySnapshot();
      const end = PRESS_TICK + 90;
      for (let tick = 1; tick <= end; tick++) {
        if (tick === saveTick) copyReplayState(snapshot, run.state);
        step(run, pressAt(tick), script(tick - PRESS_TICK, 1));
      }
      const expected = canonicalState(run.state);
      copyReplayState(run.state, snapshot);
      run.tick = saveTick - 1;
      for (let tick = saveTick; tick <= end; tick++) step(run, pressAt(tick), script(tick - PRESS_TICK, 1));
      assertEquals(canonicalState(run.state), expected, `saved at tick ${saveTick}`);
    }
  }
  assertTrue(floorBelow(0, 0, 0.0, f32(mainDeckZ(0) + 1.0)) !== undefined);
});
