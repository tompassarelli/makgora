import { assertEquals, test } from "wisp/src/runtime/testing";
import { canonicalState } from "../../replay/canonical";
import { copyReplayState, createReplaySnapshot } from "../../replay/snapshot";
import { type Duel, type Stick, duel, lift, step } from "./testDuel";
const HIGH_FOE = 90.0;
const UP: Stick = { x: 0, z: 1 };

const surfStep = (d: Duel, tick: number, stick: Stick): void => step(d, tick === 1 ? "down" : "hold", stick, UP);

const ROLLBACK_END = 60;
function replayFrom(saveTick: number): { readonly expected: string; readonly replayed: string } {
  const run = duel(40.0);
  lift(run.foe, HIGH_FOE);
  const snapshot = createReplaySnapshot();
  const stick = (tick: number): Stick => ({ x: tick < 30 ? 1 : -1, z: 1 });
  const play = (from: number): void => {
    for (let tick = from; tick <= ROLLBACK_END; tick++) surfStep(run, tick, stick(tick));
  };
  for (let tick = 1; tick <= ROLLBACK_END; tick++) {
    if (tick === saveTick) copyReplayState(snapshot, run.state);
    surfStep(run, tick, stick(tick));
  }
  const expected = canonicalState(run.state);
  copyReplayState(run.state, snapshot);
  run.tick = saveTick - 1;
  play(saveTick);
  return { expected, replayed: canonicalState(run.state) };
}

test("A rollback replays Lava Surf from mid-ride and from the hits to the same state [k1 scenario]", () => {
  for (const saveTick of [8, 15, 26]) {
    const { expected, replayed } = replayFrom(saveTick);
    assertEquals(replayed, expected, `saved at tick ${saveTick}`);
  }
});
