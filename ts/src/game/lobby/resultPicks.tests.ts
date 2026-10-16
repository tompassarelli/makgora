import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { RANDOM_STAGE } from "../menu/stageCatalog";
import { Phase, type ResultPick, ResultPick as Pick, confirmRematch, createMatchState, requestStageSelect, requestStart, selectStage, setParticipants } from "./lobbyState";

function finishedMatch(humans: number, computers: number) {
  const game = createMatchState();
  setParticipants(game, humans, computers);
  for (const slot of [0, 1]) game.characterReadiness[slot] = true;
  assertTrue(requestStageSelect(game, 0));
  selectStage(game, 0, 3);
  assertTrue(requestStart(game, 0));
  game.matchFrame = 600;
  game.phase = Phase.result;
  return game;
}

test("after a versus result the players' picks start a rematch on the same stage, open stage select or return to character select, and disagreement falls back to character select [k1 scenario]", () => {
  const single = (pick: ResultPick) => {
    const game = finishedMatch(1, 2);
    const characters = [...game.characterChoices];
    assertTrue(confirmRematch(game, 0, pick));
    return { game, characters };
  };
  const rematch = single(Pick.rematch);
  assertEquals(rematch.game.phase, Phase.match);
  assertEquals(rematch.game.stageChoice, 3);
  assertEquals(rematch.game.characterChoices.join(","), rematch.characters.join(","));
  const stage = single(Pick.newStage);
  assertEquals(stage.game.phase, Phase.stageMenu);
  assertEquals(stage.game.stageChoice, RANDOM_STAGE);
  assertEquals(single(Pick.characters).game.phase, Phase.characterMenu);

  const split = finishedMatch(3, 0);
  assertEquals(confirmRematch(split, 0, Pick.rematch), false);
  assertEquals(split.phase, Phase.result);
  assertTrue(confirmRematch(split, 1, Pick.newStage));
  assertEquals(split.phase, Phase.characterMenu);

  const agreed = finishedMatch(3, 0);
  assertEquals(confirmRematch(agreed, 1, Pick.newStage), false);
  assertTrue(confirmRematch(agreed, 0, Pick.newStage));
  assertEquals(agreed.phase, Phase.stageMenu);
});
