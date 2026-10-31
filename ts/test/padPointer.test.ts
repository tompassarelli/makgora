import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NEUTRAL_INPUT, createStandaloneSession } from "../scripts/wisp/standalone";
import { NOT_NOW_X, NOT_NOW_Y } from "../scripts/wisp/startControls";
import { NOT_NOW_LABEL } from "../src/game/ui/tutorialMenu";

const CLICK_STEP = 60;
const CARD_STEP = 70;
const CARD = "0.35 0.21";

async function shownAfter(script: string, steps: number, withPrompt: boolean): Promise<readonly string[]> {
  const savedFiles = withPrompt ? mkdtempSync(join(tmpdir(), "pad-pointer-")) : undefined;
  try {
    const session = await createStandaloneSession({ script, start: "select", ...(savedFiles === undefined ? {} : { savedFiles }) });
    try {
      for (let step = 0; step < steps; step++) session.step(NEUTRAL_INPUT);
      return session.client.frames.shownText();
    } finally {
      session.close();
    }
  } finally {
    if (savedFiles !== undefined) rmSync(savedFiles, { recursive: true });
  }
}

test("a select pad's click step presses the Not now button under its pointer on the step it names and a move step alone leaves the prompt open [k1 scenario]", async () => {
  const click = `#! select\n${CLICK_STEP} click ${NOT_NOW_X} ${NOT_NOW_Y}\n`;
  expect(await shownAfter(click, CLICK_STEP - 1, true)).toContain(NOT_NOW_LABEL);
  expect(await shownAfter(click, CLICK_STEP + 4, true)).not.toContain(NOT_NOW_LABEL);
  expect(await shownAfter(click.replace("click", "pointer"), CLICK_STEP + 4, true)).toContain(NOT_NOW_LABEL);
}, 120_000);

test("a select pad's click step picks the fighter card under its pointer and a move step leaves the choice open [k1 scenario]", async () => {
  const click = `#! select\n${CARD_STEP} click ${CARD}\n`;
  expect(await shownAfter(click, CARD_STEP + 10, false)).not.toContain("Choose fighter");
  expect(await shownAfter(click.replace("click", "pointer"), CARD_STEP + 10, false)).toContain("Choose fighter");
}, 120_000);
