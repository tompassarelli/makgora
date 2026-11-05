import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { hostname } from "node:os";
import { join } from "node:path";
import { Effect, Fiber, Schema } from "effect";
import { resolveTools } from "./wisp/nativeTools";
import { pairDefaults } from "./captureQueuePair";
import { rowStamp } from "./nativeCaptureChunks";
import { nativeCaptureBatch } from "./nativeCaptureBatch";
import { frameStamp } from "./nativeCaptureVerdict";

export class RealtimeFailure extends Schema.TaggedError<RealtimeFailure, { readonly brand: unique symbol }>()("RealtimeFailure", { problem: Schema.String }) {
  override get message(): string { return this.problem; }
}

export interface VideoStamp { readonly video: number; readonly index: number; readonly script: number; readonly frame: number }

export const MAX_ROWS = 63;
const STRIP = 80;
const STILL_SLACK = 2;
const RECORDER_STOP_SECONDS = 10;

export const stampRow = (rows: readonly string[], script: number): string | undefined => rows.find((_, index) => rowStamp(index) === script);

export function stillFrame(stamps: readonly VideoStamp[], rows: readonly string[], row: string, frame: number): VideoStamp | undefined {
  const own = stamps.filter(stamp => stampRow(rows, stamp.script) === row);
  return own.find(stamp => stamp.frame === frame) ?? own.find(stamp => stamp.frame > frame && stamp.frame <= frame + STILL_SLACK);
}

const option = (args: readonly string[], name: string) => {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
};
const VALUED = new Set(["--out", "--frames", "--crop", "--minutes", "--pair", "--tile"]);
const positional = (args: readonly string[]) => args.filter((value, index) => !value.startsWith("--") && !VALUED.has(args[index - 1] ?? ""));
const attempt = <A>(operation: string, run: () => A) => Effect.try({ try: run, catch: cause => new RealtimeFailure({ problem: `${operation}: ${String(cause)}` }) });

const tsDirectory = join(import.meta.dir, "..");
const exec = (command: readonly string[], what: string) => Effect.tryPromise({
  try: async () => {
    const child = Bun.spawn([...command], { cwd: tsDirectory, stdin: "ignore", stdout: "pipe", stderr: "inherit" });
    const text = await new Response(child.stdout).text();
    const code = await child.exited;
    if (code !== 0) throw new Error(`exited ${code}`);
    return text;
  },
  catch: cause => new RealtimeFailure({ problem: `${what}: ${cause instanceof Error ? cause.message : String(cause)}` }),
});

export const leaseOwner = (pid = process.pid) => `realtime-${pid}`;

/** The capture batch's arguments: a pair this run leased is started by a pool under the lease's owner name, because the pool refuses a pair leased to another owner and a run outside a fleet session has no session id to match instead. */
export const batchArguments = (out: string, pair: number, own: ReturnType<typeof pairDefaults>, minutes: string, leasedTo: string | undefined) => [
  "--plan", join(out, "maps", "capture-batch.json"), "--out", join(out, "out"), "--pair", String(pair), "--desktop", own.desktop, "--capacity-bin", own.capacity, "--clients-file", own.clientsFile, "--client", own.client, "--install", own.install, "--minutes", minutes,
  ...(leasedTo === undefined ? [] : ["--owner", leasedTo]),
];

const leasePair = (owner: string) => Effect.acquireRelease(
  exec([process.execPath, "scripts/wisp.ts", "lan", "lease", "take", "--owner", owner, "--pid", String(process.pid), "--wait", "1800"], "lease a pair").pipe(Effect.flatMap(text => {
    const pair = Number(/"pair":\s*(\d+)/.exec(text)?.[1] ?? NaN);
    return Number.isInteger(pair) ? Effect.succeed(pair) : Effect.fail(new RealtimeFailure({ problem: `no pair from the lease queue: ${text.trim()}` }));
  })),
  pair => exec([process.execPath, "scripts/wisp.ts", "lan", "lease", "release", "--host", hostname(), "--pair", String(pair)], "release the pair").pipe(Effect.ignore),
);

const clientRun = (runtimeClients: string, client: string) => {
  if (!existsSync(runtimeClients)) return undefined;
  const parsed = JSON.parse(readFileSync(runtimeClients, "utf8")) as { clients?: { name?: string; run?: string }[] };
  const run = parsed.clients?.find(row => row.name === client)?.run;
  return run !== undefined && existsSync(join(run, "wayland-display")) ? run : undefined;
};

/** wf-recorder never exits once its private desktop closes, so every stop ends in SIGKILL after a grace period. */
const stopRecorder = (child: Bun.Subprocess) => Effect.gen(function*() {
  if (child.exitCode !== null) return;
  child.kill("SIGINT");
  const stopped = yield* Effect.promise(() => child.exited).pipe(Effect.timeoutOption(`${RECORDER_STOP_SECONDS} seconds`));
  if (stopped._tag === "Some") return;
  child.kill("SIGKILL");
  yield* Effect.promise(() => child.exited);
});

const recorder = (wfRecorder: string, out: string, runtimeClients: string, client: string) => {
  const state: { child: Bun.Subprocess | undefined; run: string | undefined; videos: number } = { child: undefined, run: undefined, videos: 0 };
  const stop = Effect.suspend(() => state.child === undefined ? Effect.void : stopRecorder(state.child));
  const follow = Effect.gen(function*() {
    while (true) {
      const run = clientRun(runtimeClients, client);
      if (run !== undefined && run !== state.run) {
        yield* stop;
        state.run = run;
        state.videos++;
        const video = join(out, `video-${state.videos}.mkv`);
        state.child = Bun.spawn([wfRecorder, "-y", "-r", "60", "-c", "libx264", "-p", "preset=ultrafast", "-p", "crf=16", "-x", "yuv420p", "-f", video], {
          env: { ...process.env, XDG_RUNTIME_DIR: join(run, "runtime"), WAYLAND_DISPLAY: readFileSync(join(run, "wayland-display"), "utf8").trim() },
          stdin: "ignore", stdout: "ignore", stderr: Bun.file(join(out, `video-${state.videos}.log`)),
        });
        console.log(`recording ${video} from ${run}`);
      }
      yield* Effect.sleep("1 second");
    }
  });
  return { follow, stop };
};

const videoStamps = (ffmpeg: string, ffprobe: string, video: number, path: string) => Effect.gen(function*() {
  const size = yield* exec([ffprobe, "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width", "-of", "csv=p=0", path], `probe ${path}`);
  const width = Number(size.trim());
  return yield* Effect.tryPromise({
    try: async () => {
      const child = Bun.spawn([ffmpeg, "-v", "error", "-i", path, "-filter_complex", `[0:v]split[a][b];[a]crop=iw:${STRIP}:0:0[t];[b]crop=iw:${STRIP}:0:ih-${STRIP}[u];[t][u]vstack`, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], { stdin: "ignore", stdout: "pipe", stderr: "inherit" });
      const bytes = width * STRIP * 2 * 3;
      const stamps: VideoStamp[] = [];
      let pending = new Uint8Array(0);
      let index = 0;
      for await (const chunk of child.stdout) {
        const joined = new Uint8Array(pending.length + chunk.length);
        joined.set(pending);
        joined.set(chunk, pending.length);
        let offset = 0;
        for (; offset + bytes <= joined.length; offset += bytes, index++) {
          const stamp = frameStamp({ width, height: STRIP * 2, rgb: joined.subarray(offset, offset + bytes) });
          if (stamp !== undefined) stamps.push({ video, index, script: stamp.script, frame: stamp.frame });
        }
        pending = joined.slice(offset);
      }
      await child.exited;
      return stamps;
    },
    catch: cause => new RealtimeFailure({ problem: `read stamps from ${path}: ${String(cause)}` }),
  });
});

const stillsAndSheet = (out: string, rows: readonly string[], frames: readonly number[], crop: string, tile: string) => Effect.gen(function*() {
  const tools = yield* resolveTools(["ffmpeg", "ffprobe"]).pipe(Effect.mapError(cause => new RealtimeFailure({ problem: String(cause) })));
  const ffmpeg = tools["ffmpeg"] ?? "ffmpeg";
  const videos = readdirSync(out).map(file => /^video-(\d+)\.mkv$/.exec(file)?.[1]).filter(value => value !== undefined).map(Number).sort((a, b) => a - b);
  const stamps = (yield* Effect.forEach(videos, video => videoStamps(ffmpeg, tools["ffprobe"] ?? "ffprobe", video, join(out, `video-${video}.mkv`)))).flat();
  for (const row of rows) console.log(`${row}: ${stamps.filter(stamp => stampRow(rows, stamp.script) === row).length} stamped video frames`);
  const stills = join(out, "stills");
  yield* attempt("create stills folder", () => mkdirSync(stills, { recursive: true }));
  const font = (yield* exec(["fc-match", "-f", "%{file}", "DejaVuSans"], "find a font")).trim();
  const cells: string[][] = [];
  for (const row of rows) {
    const line: string[] = [];
    for (const frame of frames) {
      const picked = stillFrame(stamps, rows, row, frame);
      const still = join(stills, `${row}-f${frame}.png`);
      const cell = join(stills, `.cell-${row}-${frame}.png`);
      if (picked === undefined) {
        console.log(`${row}: no video frame for game frame ${frame}`);
        yield* exec(["magick", "-size", tile, "xc:black", "-font", font, "-fill", "white", "-pointsize", "16", "-annotate", "+6+20", `${row} f${frame} missing`, cell], "draw a missing cell");
      } else {
        yield* exec([ffmpeg, "-v", "error", "-y", "-i", join(out, `video-${picked.video}.mkv`), "-vf", `select=eq(n\\,${picked.index})`, "-frames:v", "1", still], `extract ${row} frame ${frame}`);
        yield* exec(["magick", still, "-crop", crop, "+repage", "-resize", `${tile.split("x")[0]}x`, "-gravity", "NorthWest", "-font", font, "-fill", "yellow", "-pointsize", "16", "-annotate", "+6+4", `${row} f${frame}${picked.frame === frame ? "" : ` (f${picked.frame})`}`, cell], "draw a cell");
      }
      line.push(cell);
    }
    cells.push(line);
  }
  const rowFiles = cells.map((line, index) => join(stills, `.row-${index}.png`));
  for (const [index, line] of cells.entries()) yield* exec(["magick", ...line, "+append", rowFiles[index] ?? ""], "join a sheet row");
  const sheet = join(out, "sheet.png");
  yield* exec(["magick", ...rowFiles, "-append", sheet], "join the sheet");
  yield* attempt("remove sheet cells", () => { for (const file of [...cells.flat(), ...rowFiles]) rmSync(file, { force: true }); });
  console.log(`sheet ${sheet}`);
});

export const nativeCaptureRealtime = <E, R>(args: readonly string[], chunks: (args: readonly string[]) => Effect.Effect<void, E, R>) => Effect.scoped(Effect.gen(function*() {
  const out = option(args, "--out");
  const frames = (option(args, "--frames") ?? "").split(",").filter(value => value !== "").map(Number);
  const pads = positional(args);
  const minutes = option(args, "--minutes") ?? "14";
  const crop = option(args, "--crop") ?? "1320x560+0+60";
  const tile = option(args, "--tile") ?? "440x187";
  if (out === undefined || pads.length === 0 || frames.length === 0 || frames.some(frame => !Number.isInteger(frame) || frame < 0)) return yield* new RealtimeFailure({ problem: "usage: realtime --out DIR --frames F,F... [--crop WxH+X+Y] [--tile WxH] [--minutes N] [--pair K] PAD..." });
  yield* chunks(["--out", join(out, "maps"), ...pads]);
  const plan = JSON.parse(readFileSync(join(out, "maps", "capture-batch.json"), "utf8")) as { rows: { name: string }[] };
  const rows = plan.rows.map(row => row.name);
  if (rows.length > MAX_ROWS) return yield* new RealtimeFailure({ problem: `a real-time run stamps at most ${MAX_ROWS} rows apart; split the pads` });
  const leased = option(args, "--pair") === undefined ? leaseOwner() : undefined;
  const pair = leased === undefined ? Number(option(args, "--pair")) : yield* leasePair(leased);
  const own = pairDefaults(pair);
  const tools = yield* resolveTools(["wf-recorder"]).pipe(Effect.mapError(cause => new RealtimeFailure({ problem: String(cause) })));
  const batchOut = join(out, "out");
  const video = recorder(tools["wf-recorder"] ?? "wf-recorder", out, join(batchOut, "runtime-clients.json"), own.client);
  const following = yield* Effect.forkScoped(video.follow);
  yield* Effect.addFinalizer(() => Fiber.interrupt(following).pipe(Effect.andThen(video.stop)));
  const stopVideo = Fiber.interrupt(following).pipe(Effect.andThen(video.stop));
  yield* nativeCaptureBatch(batchArguments(out, pair, own, minutes, leased), stopVideo).pipe(Effect.mapError(failure => new RealtimeFailure({ problem: failure.message })));
  yield* stopVideo;
  yield* stillsAndSheet(out, rows, frames, crop, tile);
}));
