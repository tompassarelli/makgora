import { expect, test } from "bun:test";
import { Phase } from "../src/game/lobby/lobbyState";
import { shell } from "../src/host/loop/state";
import { NEUTRAL_INPUT, createStandaloneSession, standaloneArguments } from "../scripts/wisp/standalone";

test("--start training opens the standalone in a training match [k1 scenario]", async () => {
  expect(standaloneArguments(["--start", "training"]).start).toBe("training");
  const session = await createStandaloneSession({ start: "training" });
  try {
    session.step(NEUTRAL_INPUT);
    let phase: number | undefined, training: boolean | undefined;
    session.client.run(() => { phase = shell().game.phase; training = shell().game.training; });
    expect(phase).toBe(Phase.match);
    expect(training).toBe(true);
  } finally {
    session.close();
  }
});
