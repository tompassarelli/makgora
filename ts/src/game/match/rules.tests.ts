import { assertEquals, test } from "wisp/src/runtime/testing";
import { createFighter } from "../sim/fighter";
import { createRoster } from "../sim/roster";
import { Phase, advanceClock, createMatchState } from "./rules";

const PHASES = [Phase.characterMenu, Phase.stageMenu, Phase.match, Phase.result];

test("the clock ticks only in a timed match past the start hold: every phase, time limit 0-10, mode and hold [k2 property]", () => {
  const world = createRoster(3, [createFighter(1, 0, 1), createFighter(1, 0, -1)]);
  for (const phase of PHASES) {
    for (let minutes = 0; minutes <= 10; minutes++) {
      for (let mode = 0; mode < 8; mode++) {
        for (const hold of [0, 1, 180]) {
          const game = createMatchState();
          game.phase = phase;
          game.timeLimitMinutes = minutes;
          game.practice = (mode & 1) !== 0;
          game.endless = (mode & 2) !== 0;
          game.training = (mode & 4) !== 0;
          game.startHold = hold;
          game.matchFrame = 1;
          game.remainingFrames = 600;
          advanceClock(game, world);
          const runs = phase === Phase.match && minutes > 0 && mode === 0 && hold === 0;
          assertEquals(game.remainingFrames, runs ? 599 : 600, `phase ${phase} minutes ${minutes} mode ${mode} hold ${hold}`);
          assertEquals(game.phase, phase);
          assertEquals(game.timedOut, false);
        }
      }
    }
  }
});
