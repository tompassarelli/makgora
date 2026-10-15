import { assertEquals, test } from "wisp/src/runtime/testing";
import { createFighter } from "../sim/fighter";
import { createRoster } from "../sim/roster";
import { Phase, advanceClock, copyMatchState, createMatchState, initializeComputerChoices, selectCpuCharacter, setParticipants } from "./lobbyState";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { PLAYABLE_CHARACTERS } from "../sim/heroes/registry";

const PHASES = [Phase.characterMenu, Phase.stageMenu, Phase.match, Phase.result];

test("CPU defaults agree by seed, vary across seeds and preserve human and editable choices for every slot mask [k2 property]", () => {
  for (let humans = 1; humans < 16; humans++) {
    const computers = 15 ^ humans;
    const seen = PARTICIPANT_SLOTS.map(() => new Set<number>());
    for (let seed = 0; seed < 128; seed++) {
      const first = createMatchState();
      const second = createMatchState();
      const original = [...first.characterChoices];
      for (const game of [first, second]) {
        setParticipants(game, humans, computers);
        initializeComputerChoices(game, seed);
      }
      for (const slot of PARTICIPANT_SLOTS) {
        assertEquals(first.characterChoices[slot], second.characterChoices[slot]);
        if ((computers & (1 << slot)) === 0) {
          assertEquals(first.characterChoices[slot], original[slot]);
          continue;
        }
        assertEquals(PLAYABLE_CHARACTERS.includes(first.characterChoices[slot]), true);
        seen[slot]?.add(first.characterChoices[slot]);
        const choice = PLAYABLE_CHARACTERS.find(character => character !== first.characterChoices[slot]);
        if (choice === undefined) throw new Error("the roster needs two fighters");
        selectCpuCharacter(first, PARTICIPANT_SLOTS.find(actor => (humans & (1 << actor)) !== 0) ?? 0, slot, choice);
        assertEquals(first.characterChoices[slot], choice);
        copyMatchState(second, first);
        assertEquals(second.characterChoices[slot], choice);
      }
    }
    for (const slot of PARTICIPANT_SLOTS) {
      if ((computers & (1 << slot)) !== 0) assertEquals((seen[slot]?.size ?? 0) > 1, true);
    }
  }
});

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
