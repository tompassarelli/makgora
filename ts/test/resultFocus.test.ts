import { expect, test } from "bun:test";
import { PARTICIPANT_SLOTS } from "../src/game/input/participants";
import { ResultPick, resultChoicesOpen, shownResultPick } from "../src/game/lobby/lobbyState";
import { shell } from "../src/host/loop/state";
import { NEUTRAL_INPUT, createStandaloneSession } from "../scripts/wisp/standalone";

const MATCH_FRAME_LIMIT = 20000;

test("the results menu opens with Rematch focused for every player [k1 scenario]", async () => {
  const session = await createStandaloneSession({ start: "results" });
  try {
    let frames = 0;
    while (!session.finished() && frames++ < MATCH_FRAME_LIMIT) session.step(NEUTRAL_INPUT);
    let open = false;
    let focus: ResultPick[] = [];
    session.client.run(() => {
      open = resultChoicesOpen(shell().game);
      focus = PARTICIPANT_SLOTS.map(slot => shownResultPick(shell().resultFocus, slot));
    });
    expect(open).toBe(true);
    expect(focus).toEqual(PARTICIPANT_SLOTS.map(() => ResultPick.rematch));
  } finally {
    session.close();
  }
}, 120_000);
