import { assertEquals, test } from "wisp/src/runtime/testing";
import { copyMatchState, costumeFor, createMatchState, cycleCostume, selectCharacter } from "../lobby/lobbyState";
import { Character } from "../sim/codes";
import { costumesFor } from "./costumes";

test("cycling costumes wraps, stays with its own card, and resets with a new fighter [k2 property]", () => {
  const game = createMatchState();
  game.humanMask = 3;
  game.humanFighterMask = 3;
  game.computerMask = 0;
  selectCharacter(game, 0, Character.grom);
  selectCharacter(game, 1, Character.grom);
  cycleCostume(game, 0, 0, 1);
  cycleCostume(game, 0, 0, 1);
  assertEquals(costumeFor(game, 0), 2);
  assertEquals(costumeFor(game, 1), 0);
  cycleCostume(game, 1, 0, 1);
  assertEquals(costumeFor(game, 0), 2);
  for (let step = 0; step < 3; step++) cycleCostume(game, 0, 0, -1);
  assertEquals(costumeFor(game, 0), costumesFor(Character.grom).length - 1);
  const copy = createMatchState();
  copyMatchState(copy, game);
  assertEquals(copy.costumeChoices[0], game.costumeChoices[0]);
  selectCharacter(game, 0, Character.rifleman);
  assertEquals(costumeFor(game, 0), 0);
});
