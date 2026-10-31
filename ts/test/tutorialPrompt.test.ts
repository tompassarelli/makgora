import { expect, test } from "bun:test";
import { copyFileSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deliverKey } from "../scripts/wisp/deliverKey";
import { NEUTRAL_INPUT, createStandaloneSession } from "../scripts/wisp/standalone";
import { tutorialSeen } from "../src/game/ui/tutorialMenu";

const PROMPT = "Start tutorial";
const SETTLE_STEPS = 45;
const ESCAPE = 0x1b;
const WRITTEN_BY_NATIVE_WINDOW = join(import.meta.dir, "fixtures/tutorial-seen/SmashcraftTutorial.pld");

async function selectSession(savedFiles: string) {
  const session = await createStandaloneSession({ start: "select", savedFiles });
  for (let step = 0; step < SETTLE_STEPS; step++) session.step(NEUTRAL_INPUT);
  return session;
}

const prompted = (session: Awaited<ReturnType<typeof selectSession>>) => session.client.frames.shownText().includes(PROMPT);

test("the first-run tutorial prompt closes on the back key and stays closed in the next session [k1 scenario]", async () => {
  const savedFiles = mkdtempSync(join(tmpdir(), "tutorial-prompt-"));
  try {
    const first = await selectSession(savedFiles);
    try {
      expect(prompted(first)).toBe(true);
      first.step({ buttons: ["special"], axisX: 0, axisY: 0 });
      first.step(NEUTRAL_INPUT);
      expect(prompted(first)).toBe(false);
      expect(readdirSync(savedFiles).length).toBeGreaterThan(0);
    } finally {
      first.close();
    }
    const second = await selectSession(savedFiles);
    try {
      expect(prompted(second)).toBe(false);
    } finally {
      second.close();
    }
  } finally {
    rmSync(savedFiles, { recursive: true });
  }
}, 120_000);

test("Esc closes the first-run tutorial prompt [k1 scenario]", async () => {
  const savedFiles = mkdtempSync(join(tmpdir(), "tutorial-prompt-"));
  try {
    const session = await selectSession(savedFiles);
    try {
      expect(prompted(session)).toBe(true);
      deliverKey(session.client, 0, ESCAPE, 0, true);
      deliverKey(session.client, 0, ESCAPE, 0, false);
      session.step(NEUTRAL_INPUT);
      expect(prompted(session)).toBe(false);
    } finally {
      session.close();
    }
  } finally {
    rmSync(savedFiles, { recursive: true });
  }
}, 120_000);

test("a seen file the native window wrote keeps the tutorial prompt closed [k1 scenario]", async () => {
  const savedFiles = mkdtempSync(join(tmpdir(), "tutorial-prompt-"));
  try {
    copyFileSync(WRITTEN_BY_NATIVE_WINDOW, join(savedFiles, "SmashcraftTutorial.pld"));
    const session = await selectSession(savedFiles);
    try {
      let seen = false;
      session.client.run(() => { seen = tutorialSeen(); });
      expect(seen).toBe(true);
      expect(prompted(session)).toBe(false);
    } finally {
      session.close();
    }
  } finally {
    rmSync(savedFiles, { recursive: true });
  }
}, 120_000);
