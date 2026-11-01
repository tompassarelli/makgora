import { assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { Phase, createMatchState, setHumanMask } from "../lobby/lobbyState";
import { acceptsClick, cardRowShown } from "./selectionCards";

test("the chat box and the cards stay up from character select through stage select for a player in the lobby, and a panel takes only its own player's clicks, only on character select [k2 property]", () => {
  const game = createMatchState();
  setHumanMask(game, 0b01);
  game.phase = Phase.stageMenu;
  assertTrue(cardRowShown(game, 0, false));
  assertFalse(cardRowShown(game, 1, false));
  assertFalse(acceptsClick(game, 0, 0));
  game.phase = Phase.characterMenu;
  assertTrue(acceptsClick(game, 0, 0));
  assertFalse(acceptsClick(game, 1, 0));
  assertTrue(cardRowShown(game, 0, true));
  assertFalse(cardRowShown(game, 0, false));
  game.phase = Phase.match;
  assertFalse(cardRowShown(game, 0, false) || acceptsClick(game, 0, 0));
});
