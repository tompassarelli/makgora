import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Cause, Effect, Exit } from "effect";
import { type HeadlessSession, headlessScript } from "../scripts/wisp/commands/pad";
import { parsePadScript } from "../scripts/integrity/padScript";

const SCRIPT = "120 a stick 1 0\n133 a stick 0 0\n240 a press VIEW\n310 a release VIEW\n";
const REJECTED = "wc3-journal: unknown pad preset \"standard\": melee, z-jump, tom\n";

test("a helper that exits before match start fails the pad run with its own last log line, not the 60 s match-start timeout (smashcraft#92) [k1 scenario]", async () => {
  const here = mkdtempSync(join(tmpdir(), "pad-helper-exit-"));
  const scriptPath = join(here, "kick-right.pad");
  writeFileSync(scriptPath, SCRIPT);
  const session = {
    helpers: [{ exitCode: null, signalCode: null }, { exitCode: 1, signalCode: null }],
    logs: () => ["", REJECTED],
    clients: { clients: [{ errors: [] }, { errors: [] }], chat: () => undefined },
  } as unknown as HeadlessSession;
  const started = Date.now();
  const exit = await Effect.runPromiseExit(headlessScript(session, { scriptPath, steps: parsePadScript(SCRIPT), helper: "", build: "typescript-integrity", out: join(here, "out"), chat: undefined }));
  expect(Exit.isFailure(exit) ? Cause.pretty(exit.cause) : "passed").toContain("helper 1 exited (1): wc3-journal: unknown pad preset \"standard\"");
  expect(Date.now() - started).toBeLessThan(4_000);
});
