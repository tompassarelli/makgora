import { existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Effect, Schema } from "effect";
import { ChildProcess } from "effect/process";
import { pollUntil } from "./hostPoll";
import { runProcess } from "./hostProcess";

const USAGE = "usage: bun scripts/windowStrip.ts PAD.pad --out STRIP.jpg --row N,N,... [--row N,N,...]... [--after N] [--count N] [--owner NAME] [--tile WxH] [--resolution WxH] [--keep-frames]";
const project = resolve(import.meta.dir, "..");
const RUN_SECONDS = 600;
const QUEUE_SECONDS = 2400;

class WindowStripFailure extends Schema.TaggedError<WindowStripFailure, { readonly brand: unique symbol }>()("WindowStripFailure", { problem: Schema.String }) {
  override get message(): string {
    return this.problem;
  }
}

function argumentsOf(args: readonly string[]) {
  const [pad, ...rest] = args;
  const rows: number[][] = [];
  let out: string | undefined, after = 580, count = 1000, owner = "window-strip", tile = "480x270", resolution = "1600x900", keep = false;
  if (pad === undefined || pad.startsWith("--")) throw new Error(USAGE);
  for (let index = 0; index < rest.length; index++) {
    const flag = rest[index];
    if (flag === "--keep-frames") { keep = true; continue; }
    const value = rest[++index];
    if (value === undefined) throw new Error(`${flag} needs a value\n${USAGE}`);
    if (flag === "--out") out = resolve(value);
    else if (flag === "--row" && /^\d+(,\d+)*$/.test(value)) rows.push(value.split(",").map(Number));
    else if (flag === "--after" && /^\d+$/.test(value)) after = Number(value);
    else if (flag === "--count" && /^[1-9]\d*$/.test(value)) count = Number(value);
    else if (flag === "--owner") owner = value;
    else if (flag === "--tile" && /^\d+x\d+$/.test(value)) tile = value;
    else if (flag === "--resolution" && /^\d+x\d+$/.test(value)) resolution = value;
    else throw new Error(USAGE);
  }
  if (out === undefined || rows.length === 0) throw new Error(USAGE);
  const last = Math.max(...rows.flat());
  if (last >= count) throw new Error(`--row names frame ${last} but --count ${count} saves frames 0 to ${count - 1}`);
  return { pad: resolve(pad), out, rows, after, count, owner, tile, resolution, keep };
}

const skillScript = (skill: string, script: string) => runProcess(ChildProcess.make("agents", ["path", skill])).pipe(Effect.map((path) => join(dirname(path), script)));

const frameName = (frame: number) => `f-${String(frame).padStart(4, "0")}.png`;

const main = Effect.gen(function*() {
  const { pad, out, rows, after, count, owner, tile, resolution, keep } = yield* Effect.try({ try: () => argumentsOf(process.argv.slice(2)), catch: (cause) => new WindowStripFailure({ problem: String(cause) }) });
  if (!existsSync(pad)) return yield* new WindowStripFailure({ problem: `no pad script at ${pad}` });
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
