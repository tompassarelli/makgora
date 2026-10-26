import { expect, test } from "bun:test";
import { Effect, Exit } from "effect";
import { DesktopFailure, ToplevelMissing } from "wisp/scripts/warcraft/desktop";
import { IntegrityFailure } from "../scripts/integrity/evidence";
import { PadReplayFailure } from "../scripts/wisp/commands/pad";
import { rerun, runOutcome } from "../scripts/wisp/padBatch";

test("a pad run whose client's compositor lists no Warcraft toplevel is INVALID and rerun under --retries, while other integrity failures stay broken and are not [k2 property]", () => {
  const missing = new ToplevelMissing({ title: "Warcraft III" });
  const runs = {
    focus: Exit.fail(new IntegrityFailure({ operation: "focus Warcraft", path: "b", cause: missing })),
    preflight: Exit.fail(new IntegrityFailure({ operation: "input preflight", path: "clients.json", cause: new DesktopFailure({ operation: "input preflight", client: "b", cause: missing }) })),
    unreachable: Exit.fail(new IntegrityFailure({ operation: "focus Warcraft", path: "b", cause: "wlrctl exited 1: Foreign Toplevel Management interface not found!" })),
    process: Exit.fail(new IntegrityFailure({ operation: "find game process", path: "b", cause: "window process 7 is wine" })),
    offFrame: Exit.fail(new PadReplayFailure({ operation: "replay pad script", path: "out", cause: "1 edges off their frame, 0 helpers stopped", offFrame: 1, helpersStopped: 0 })),
    valid: Exit.succeed("valid" as const),
  };
  const outcomes = Object.fromEntries(Object.entries(runs).map(([name, ran]) => [name, runOutcome(ran)]));
  expect(outcomes).toEqual({ focus: "invalid", preflight: "invalid", unreachable: "broken", process: "broken", offFrame: "failed", valid: "valid" });
  const reruns = Object.fromEntries(Object.entries(outcomes).map(([name, outcome]) => [name, Effect.runSync(rerun(outcome, 0, 2, Effect.succeed(false)))]));
  expect(reruns).toEqual({ focus: true, preflight: true, unreachable: false, process: false, offFrame: false, valid: false });
  expect(Effect.runSync(rerun("failed", 0, 2, Effect.succeed(true)))).toBe(true);
  expect(Effect.runSync(rerun("failed", 2, 2, Effect.succeed(true)))).toBe(false);
});
