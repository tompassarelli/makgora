import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NEUTRAL_INPUT, createStandaloneSession, standaloneArguments } from "../scripts/wisp/standalone";
import { Phase } from "../src/game/lobby/lobbyState";

const PROMPT = "Start tutorial";
const SETTLE_STEPS = 45;

async function openedScreen(tutorialOffer: boolean) {
  const savedFiles = mkdtempSync(join(tmpdir(), "open-select-"));
  try {
    const session = await createStandaloneSession({ start: "select", savedFiles, tutorialOffer });
    try {
      for (let step = 0; step < SETTLE_STEPS; step++) session.step(NEUTRAL_INPUT);
      const { shell } = await import("../src/host/loop/state");
      const { views } = await import("../src/host/loop/ui");
      let screen: { phase: number; panelsOpen: boolean } | undefined;
      session.client.run(() => { screen = { phase: shell().game.phase, panelsOpen: views(shell()).settings.some(panel => panel.isOpen()) }; });
      return { ...screen!, prompted: session.client.frames.shownText().includes(PROMPT) };
    } finally {
      session.close();
    }
  } finally {
    rmSync(savedFiles, { recursive: true });
  }
}

test("--start select --no-tutorial-offer opens a first-run live window on character select with no tutorial prompt or controls panel in front [k1 scenario]", async () => {
  expect(standaloneArguments(["--start", "select", "--no-tutorial-offer"], "native")).toMatchObject({ start: "select", noTutorialOffer: true });
  expect(standaloneArguments(["--start", "select"], "native").noTutorialOffer).toBeUndefined();
  expect(await openedScreen(true)).toEqual({ phase: Phase.characterMenu, panelsOpen: false, prompted: true });
  expect(await openedScreen(false)).toEqual({ phase: Phase.characterMenu, panelsOpen: false, prompted: false });
}, 120_000);
