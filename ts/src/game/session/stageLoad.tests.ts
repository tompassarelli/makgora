import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { Phase, createMatchState, setParticipants } from "../lobby/lobbyState";
import { STAGE_CARD_DELAY_FRAMES, STAGE_SETTLE_FRAMES, StageLoadStep, beginStageLoad, stageCardDue, stageReported, tickStageLoad } from "./stageLoad";

test("a stage load asks for its loading card only after a second, and only once, so a local start that finishes in half a second never shows one [k2 property]", () => {
  const game = createMatchState();
  game.phase = Phase.stageMenu;
  setParticipants(game, 1, 0);
  const load = beginStageLoad(game, 0);
  assertTrue(STAGE_CARD_DELAY_FRAMES > STAGE_SETTLE_FRAMES);
  let carded = 0;
  let reportedAt = -1;
  for (let frame = 1; frame <= STAGE_CARD_DELAY_FRAMES + 40; frame++) {
    const step = tickStageLoad(load);
    if (step === StageLoadStep.report) reportedAt = frame;
    const due = stageCardDue(load);
    if (due) {
      carded++;
      assertEquals(frame, STAGE_CARD_DELAY_FRAMES);
    }
    assertFalse(due && frame < STAGE_CARD_DELAY_FRAMES);
  }
  assertEquals(carded, 1);
  assertEquals(reportedAt, STAGE_SETTLE_FRAMES);
});

test("a load whose players have all reported before the card's delay is over never asks for the card [k2 property]", () => {
  const game = createMatchState();
  game.phase = Phase.stageMenu;
  setParticipants(game, 1, 0);
  const load = beginStageLoad(game, 0);
  for (let frame = 1; frame <= STAGE_SETTLE_FRAMES; frame++) {
    tickStageLoad(load);
    assertFalse(stageCardDue(load));
  }
  assertTrue(stageReported(load, 0, `${load.stage}`));
  assertFalse(load.carded);
});
