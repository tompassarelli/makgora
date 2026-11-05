import { expect, test } from "bun:test";
import { copyFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NEUTRAL_INPUT, createStandaloneSession } from "../scripts/wisp/standalone";
import { tutorialSeen } from "../src/game/ui/tutorialMenu";

const PROMPT = "Start tutorial";
const SETTLE_STEPS = 45;
const WRITTEN_BY_NATIVE_WINDOW = join(import.meta.dir, "fixtures/tutorial-seen/MakgoraTutorial.pld");

async function selectSession(savedFiles: string) {
  const session = await createStandaloneSession({ start: "select", savedFiles });
  for (let step = 0; step < SETTLE_STEPS; step++) session.step(NEUTRAL_INPUT);
  return session;
}

const prompted = (session: Awaited<ReturnType<typeof selectSession>>) => session.client.frames.shownText().includes(PROMPT);

test("a seen file the native window wrote keeps the tutorial prompt closed [k1 scenario]", async () => {
  const savedFiles = mkdtempSync(join(tmpdir(), "tutorial-prompt-"));
  try {
    copyFileSync(WRITTEN_BY_NATIVE_WINDOW, join(savedFiles, "MakgoraTutorial.pld"));
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
