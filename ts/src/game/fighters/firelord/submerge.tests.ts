import { assertEquals, test } from "wisp/src/runtime/testing";
import { canonicalState } from "../../replay/canonical";
import { copyReplayState, createReplaySnapshot } from "../../replay/snapshot";
import {
  SUBMERGE_SURFACE_FRAME,
} from "./specials";
import { type Duel, type Stick, duel, idle, step } from "./testDuel";

const FAR_AWAY = 2000.0;
const DOWN: Stick = { x: 0, z: -1 };

function submerge(d: Duel): void {
  step(d, "down", { x: d.caster.facing, z: 0 });
}

const ROLLBACK_PRESS = 3;
const SUBMERGE_PRESS = ROLLBACK_PRESS + 53;
const ROLLBACK_END = SUBMERGE_PRESS + 44;

function replayFrom(saveTick: number): { readonly expected: string; readonly replayed: string } {
  const run = duel(FAR_AWAY);
  const snapshot = createReplaySnapshot();
  const play = (from: number): void => {
    for (let tick = from; tick <= ROLLBACK_END; tick++) {
      if (tick === ROLLBACK_PRESS) step(run, "down", DOWN, DOWN);
      else if (tick === SUBMERGE_PRESS) submerge(run);
      else step(run, "none");
    }
  };
  for (let tick = 1; tick <= ROLLBACK_END; tick++) {
    if (tick === saveTick) copyReplayState(snapshot, run.state);
    if (tick === ROLLBACK_PRESS) step(run, "down", DOWN, DOWN);
    else if (tick === SUBMERGE_PRESS) submerge(run);
    else step(run, "none");
  }
  const expected = canonicalState(run.state);
  copyReplayState(run.state, snapshot);
  run.tick = saveTick - 1;
  play(saveTick);
  return { expected, replayed: canonicalState(run.state) };
}

test("A rollback replays a Lava Raze crater and a Submerge from before, during and after the dive to the same state [k1 scenario]", () => {
  const withCrater = duel(FAR_AWAY);
  const without = duel(FAR_AWAY);
  step(withCrater, "down", DOWN, DOWN);
  step(without, "none");
  idle(withCrater, 60);
  idle(without, 60);
  assertEquals(canonicalState(withCrater.state) === canonicalState(without.state), false, "a live crater is in the canonical state");
  for (const saveTick of [ROLLBACK_PRESS + 5, ROLLBACK_PRESS + 46, SUBMERGE_PRESS, SUBMERGE_PRESS + 4, SUBMERGE_PRESS + SUBMERGE_SURFACE_FRAME, SUBMERGE_PRESS + 20]) {
    const { expected, replayed } = replayFrom(saveTick);
    assertEquals(replayed, expected, `saved at tick ${saveTick}`);
  }
});
