import { existsSync, mkdirSync, rmSync } from "node:fs";
import { homedir, hostname } from "node:os";
import { dirname, join, resolve } from "node:path";
import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Effect, Schema } from "effect";
import { ChildProcess } from "effect/process";
import { pollUntil } from "./hostPoll";
import { runProcess } from "./hostProcess";
import { captureRoute, runOnCaptureHost } from "./nativeCaptureHost";
import { argumentsOf, padFile, shippedArguments } from "./windowStripArguments";

const project = resolve(import.meta.dir, "..");
const RUN_SECONDS = 600;
const QUEUE_SECONDS = 2400;

class WindowStripFailure extends Schema.TaggedError<WindowStripFailure, { readonly brand: unique symbol }>()("WindowStripFailure", { problem: Schema.String }) {
  override get message(): string {
    return this.problem;
  }
}

const skillScript = (skill: string, script: string) => runProcess(ChildProcess.make("agents", ["path", skill])).pipe(Effect.map((path) => join(dirname(path), script)));

const frameName = (frame: number) => `f-${String(frame).padStart(4, "0")}.png`;

const main = Effect.gen(function*() {
  const strip = yield* Effect.try({ try: () => argumentsOf(process.argv.slice(2)), catch: (cause) => new WindowStripFailure({ problem: String(cause) }) });
  const { pad, out, rows, after, count, owner, tile, resolution, keep } = strip;
  if (!existsSync(pad)) return yield* new WindowStripFailure({ problem: `no pad script at ${pad}` });
  if (captureRoute(hostname()) === "ship") {
    const graphics = join(process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "wisp/players", `${owner}.graphics.json`);
    yield* runOnCaptureHost({
      project, script: "scripts/windowStrip.ts",
      args: folders => shippedArguments(strip, folders),
      env: folders => (existsSync(graphics) ? { XDG_CONFIG_HOME: folders.config } : {}),
      send: [{ from: pad, to: `in/${padFile(pad)}` }, { from: graphics, to: `config/wisp/players/${owner}.graphics.json` }],
      fetchInto: dirname(out),
    }).pipe(Effect.mapError(cause => new WindowStripFailure({ problem: cause.message })));
    console.log(out);
    return;
  }
  const helper = yield* skillScript("machine-capacity", "scripts/machine-capacity.mjs");
  const desktop = yield* skillScript("private-desktop-development", "scripts/private-desktop.sh");
  const frames = join(dirname(out), `${out.replace(/^.*\//, "").replace(/\.[^.]*$/, "")}-frames`);
  rmSync(frames, { recursive: true, force: true });
  mkdirSync(frames, { recursive: true });
  const play = [process.execPath, "scripts/wisp.ts", "play", "--standalone", "--window", "native", "--script", pad];
  const command = ["bash", desktop, "start", "--resolution", resolution, "--seconds", String(RUN_SECONDS + QUEUE_SECONDS), "--", process.execPath, helper, "run", "--class", "gpu", "--owner", owner, "--timeout-seconds", String(RUN_SECONDS), "--", ...play];
  let runProblem = "";
  const wanted = rows.flat();
  const lastFrame = join(frames, frameName(Math.max(...wanted)));
  const lastSaved = pollUntil(Effect.sync(() => existsSync(lastFrame) ? true : undefined), { every: "1 second", within: `${RUN_SECONDS + QUEUE_SECONDS} seconds`, orElse: () => Effect.succeed(false) }).pipe(Effect.andThen(Effect.sleep("2 seconds")));
  const run = runProcess(ChildProcess.make(command[0] ?? "", command.slice(1), {
    cwd: project,
    env: { WISP_PLAYER: owner, WISP_WINDOW_CAPTURE: join(frames, "f.png"), WISP_WINDOW_CAPTURE_AFTER: String(after), WISP_WINDOW_CAPTURE_FRAMES: String(count) },
    extendEnv: true,
  })).pipe(Effect.catchTag("ProcessFailure", (cause) => Effect.sync(() => { runProblem = cause.message; })));
  yield* Effect.raceFirst(run, lastSaved);
  const missing = wanted.filter((frame) => !existsSync(join(frames, frameName(frame))));
  if (missing.length > 0) return yield* new WindowStripFailure({ problem: `the window saved no frames ${missing.join(",")} in ${frames}; the pad ended before them or --after is past the scene${runProblem === "" ? "" : `; the run failed: ${runProblem}`}` });
  const rowFiles: string[] = [];
  for (const [index, row] of rows.entries()) {
    const file = join(frames, `row-${index}.jpg`);
    yield* runProcess(ChildProcess.make("montage", [...row.map((frame) => join(frames, frameName(frame))), "-tile", `${row.length}x1`, "-geometry", `${tile}+2+2`, file]));
    rowFiles.push(file);
  }
  yield* runProcess(ChildProcess.make("montage", [...rowFiles, "-tile", `1x${rowFiles.length}`, "-geometry", "+0+0", out]));
  if (!keep) rmSync(frames, { recursive: true, force: true });
  console.log(out);
});

BunRuntime.runMain(main.pipe(Effect.provide(BunServices.layer)));
