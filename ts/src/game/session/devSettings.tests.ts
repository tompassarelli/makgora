import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { Phase, createMatchState, selectCharacter } from "../lobby/lobbyState";
import { Character } from "../sim/codes";
import { prepareQuickMatch } from "./devSettings";

test("a dev quick match starts with coming-soon fighters, alone against a computer and as a pair, while the character grid still refuses them [k2 property]", () => {
  const grid = createMatchState();
  grid.humanMask = 1;
  grid.humanFighterMask = 1;
  grid.computerMask = 0;
  const before = grid.characterChoices[0];
  selectCharacter(grid, 0, Character.valeera);
  assertEquals(grid.characterChoices[0], before);

  const alone = createMatchState();
  alone.humanMask = 1;
  alone.humanFighterMask = 1;
  alone.computerMask = 0;
  assertTrue(prepareQuickMatch(alone, 0, Character.valeera));
  assertEquals(alone.phase, Phase.match);
  assertEquals(alone.characterChoices[0], Character.valeera);
  assertEquals(alone.characterChoices[1], Character.valeera);

  const pair = createMatchState();
  pair.humanMask = 1;
  pair.humanFighterMask = 1;
  pair.computerMask = 0;
  assertTrue(prepareQuickMatch(pair, 0, [Character.whitemane, Character.valeera]));
  assertEquals(pair.characterChoices[0], Character.whitemane);
  assertEquals(pair.characterChoices[1], Character.valeera);
});
