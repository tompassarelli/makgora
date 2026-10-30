import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { at } from "wisp/src/runtime/lookup";
import { PLAYABLE_CHARACTERS } from "../roster/kits";
import { RANDOM_FIGHTER, createMatchState, cycleSlotMode, selectCharacter, selectCpuCharacter } from "../lobby/lobbyState";
import { createMenuCues, createMenuObservation, menuFrameCues } from "./matchCues";

const CPU = 1;

function lobbyWithComputer() {
  const game = createMatchState();
  selectCharacter(game, 0, at(PLAYABLE_CHARACTERS, 0));
  assertTrue(cycleSlotMode(game, 0, CPU));
  assertTrue(cycleSlotMode(game, 0, CPU));
  game.characterReadiness[CPU] = false;
  const before = createMenuObservation();
  const cues = createMenuCues();
  menuFrameCues(before, game, undefined, cues);
  return { game, before, cues };
}

test("Choosing Random for a computer plays no fighter voice, only the neutral confirm cue, and a named pick still voices its fighter [k2 property]", () => {
  const { game, before, cues } = lobbyWithComputer();
  selectCpuCharacter(game, 0, CPU, RANDOM_FIGHTER);
  menuFrameCues(before, game, undefined, cues);
  assertEquals(cues.fighters.length, 0);
  assertTrue(cues.confirm);
  menuFrameCues(before, game, undefined, cues);
  assertEquals(cues.fighters.length, 0);
  assertFalse(cues.confirm);
  selectCpuCharacter(game, 0, CPU, at(PLAYABLE_CHARACTERS, 2));
  menuFrameCues(before, game, undefined, cues);
  assertEquals(cues.fighters.join(","), String(CPU));
});

test("A human cannot pick Random, so a Random request voices nothing and changes no cue [k2 property]", () => {
  const { game, before, cues } = lobbyWithComputer();
  game.characterReadiness[0] = false;
  menuFrameCues(before, game, undefined, cues);
  selectCharacter(game, 0, RANDOM_FIGHTER);
  menuFrameCues(before, game, undefined, cues);
  assertEquals(cues.fighters.length, 0);
  assertFalse(cues.confirm);
});

test("Moving a computer from a named fighter back to Random voices nothing, and Random to a named fighter voices it once [k2 property]", () => {
  const { game, before, cues } = lobbyWithComputer();
  selectCpuCharacter(game, 0, CPU, at(PLAYABLE_CHARACTERS, 2));
  menuFrameCues(before, game, undefined, cues);
  assertEquals(cues.fighters.length, 1);
  selectCpuCharacter(game, 0, CPU, RANDOM_FIGHTER);
  menuFrameCues(before, game, undefined, cues);
  assertEquals(cues.fighters.length, 0);
  assertTrue(cues.confirm);
  selectCpuCharacter(game, 0, CPU, at(PLAYABLE_CHARACTERS, 2));
  menuFrameCues(before, game, undefined, cues);
  assertEquals(cues.fighters.length, 1);
});
