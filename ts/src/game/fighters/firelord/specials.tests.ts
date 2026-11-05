import { assertEquals, test } from "wisp/src/runtime/testing";
import { canonicalState } from "../../replay/canonical";
import { copyReplayState, createReplaySnapshot } from "../../replay/snapshot";
import { RAZE_READ_FRAME, RAZE_REACH } from "./specials";
import { type Press, type Stick, duel, step } from "./testDuel";

const PRESS_TICK = 16;
const PLACE_TICK = PRESS_TICK + RAZE_READ_FRAME - 1;
const NEUTRAL: Stick = { x: 0, z: 0 };

type Script = (offset: number, facing: number) => Stick;
type Segment = readonly [x: number, z: number, frames: number];

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

const pressAt = (tick: number, release = Infinity): Press => tick === PRESS_TICK ? "down" : tick > PRESS_TICK && tick < release ? "hold" : "none";

const SLOW_QUARTER_CIRCLE = ending([[0, -1, 1], [1, -1, 4], [1, 0, 5]]);
const ROLLBACK_END = PRESS_TICK + 54;
const RELEASE_TICK = PRESS_TICK + 37;

function replayFrom(saveTick: number): { readonly expected: string; readonly replayed: string } {
  const run = duel(RAZE_REACH.far);
  const script = SLOW_QUARTER_CIRCLE;
  const snapshot = createReplaySnapshot();
  const play = (from: number): void => {
    for (let tick = from; tick <= ROLLBACK_END; tick++) step(run, pressAt(tick, RELEASE_TICK), script(tick - PRESS_TICK, 1));
  };
  for (let tick = 1; tick <= ROLLBACK_END; tick++) {
    if (tick === saveTick) copyReplayState(snapshot, run.state);
    step(run, pressAt(tick, RELEASE_TICK), script(tick - PRESS_TICK, 1));
  }
  const expected = canonicalState(run.state);
  copyReplayState(run.state, snapshot);
  run.tick = saveTick - 1;
  play(saveTick);
  return { expected, replayed: canonicalState(run.state) };
}

test("A rollback replays Lava Raze from mid-motion, across the press, mid-cast and mid-eruption to the same state, and the stick history is in that state [k1 scenario]", () => {
  const canonicalAfter = (script: Script): string => {
    const run = duel(RAZE_REACH.far);
    for (let tick = 1; tick < PRESS_TICK; tick++) step(run, "none", script(tick - PRESS_TICK, 1));
    return canonicalState(run.state);
  };
  assertEquals(canonicalAfter(SLOW_QUARTER_CIRCLE) === canonicalAfter(() => NEUTRAL), false, "a quarter-circle before the press is in the canonical state");
  for (const saveTick of [PRESS_TICK - 7, PRESS_TICK - 2, PRESS_TICK, PRESS_TICK + 6, PLACE_TICK + 3, PLACE_TICK + 10]) {
    const { expected, replayed } = replayFrom(saveTick);
    assertEquals(replayed, expected, `saved at tick ${saveTick}`);
  }
});
