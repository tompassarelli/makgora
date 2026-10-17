import { expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect, Exit } from "effect";
import { type HeadlessSession, type NativeSession, type PadOptions, headlessScript, nativeScript } from "../scripts/wisp/commands/pad";
import { parsePadScript } from "../scripts/integrity/padScript";

const SCRIPT = "120 a stick 1 0\n133 a stick 0 0\n240 a press VIEW\n310 a release VIEW\n";
const EARLIER_ATTEMPT = ["trace-a.txt", "trace-b.txt", "scene-a.txt", "result.json", "smashcraft-repro-p0-f277-2.txt"];
const SESSION_FILES = ["helper-0.log", "typed-0.txt", "reload.json"];

const stopped = () => { throw new Error("stub session stops the run"); };
const options = (out: string, scriptPath: string): PadOptions => ({ scriptPath, steps: parsePadScript(SCRIPT), helper: "", build: "typescript-integrity", out, chat: undefined });

test("a retried pad run starts without the earlier attempt's traces, result or moments, on the headless session and on native clients (wisp#11) [k1 scenario]", async () => {
  const runners = [
    ["headless", (out: string, scriptPath: string) => headlessScript({ logs: stopped } as unknown as HeadlessSession, options(out, scriptPath))],
    ["native", (out: string, scriptPath: string) => nativeScript({ logs: stopped } as unknown as NativeSession, options(out, scriptPath))],
  ] as const;
  for (const [side, run] of runners) {
    const here = mkdtempSync(join(tmpdir(), `pad-attempt-${side}-`));
    const scriptPath = join(here, "kick-right.pad");
    writeFileSync(scriptPath, SCRIPT);
    const out = join(here, "session");
    mkdirSync(join(out, "client-0"), { recursive: true });
    for (const name of [...EARLIER_ATTEMPT, ...SESSION_FILES]) writeFileSync(join(out, name), "earlier attempt\n");
    const exit = await Effect.runPromiseExit(run(out, scriptPath));
    expect(Exit.isFailure(exit)).toBe(true);
    expect({ side, left: readdirSync(out).sort() }).toEqual({ side, left: ["client-0", ...SESSION_FILES].sort() });
    expect(existsSync(join(out, "smashcraft-repro-p0-f277-2.txt"))).toBe(false);
  }
});
