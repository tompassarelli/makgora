import { assertEquals, test } from "wisp/src/runtime/testing";
import { createMatchState, setParticipants } from "../lobby/lobbyState";
import { LESSONS, NO_LESSON, leaveFinishedTutorial } from "./tutorial";

test("leaving a finished tutorial returns to Versus, and leaving one partway keeps the lesson in Training [k1 scenario]", () => {
  const game = createMatchState();
  setParticipants(game, 1, 2);
  game.training = true;
  game.trainer.lesson = 2;
  leaveFinishedTutorial(game);
  assertEquals(game.training, true);
  assertEquals(game.trainer.lesson, 2);
  game.trainer.lesson = LESSONS.length;
  leaveFinishedTutorial(game);
  assertEquals(game.training, false);
  assertEquals(game.trainer.lesson, NO_LESSON);
});
