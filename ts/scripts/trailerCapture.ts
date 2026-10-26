import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Duration, Effect, Layer } from "effect";
import { loadClients } from "wisp/scripts/warcraft/desktop";
import { preloadLines } from "wisp/scripts/wisp/preloadRecord";
import { dataDirectory } from "wisp/scripts/wisp/gameFiles";
import { platformLayer } from "wisp/scripts/platform/layer";
import { onlyClient, resolveTools, withRuntimeTools } from "./wisp/nativeTools";
import { CaptureFailure, option, readBinding } from "./nativeCapture";
import { frameStamp } from "./nativeCaptureVerdict";
import { FIELD_STAGES, openFieldMatch } from "./cpuField";
import { TRAILER_LOG_FILE, TRAILER_SCRIPT } from "../src/game/core/gameFiles";
import { TRAILER_SHOTS, type TrailerShot } from "../src/game/session/trailerShots";
import { clearAttackBuffer } from "../src/game/input/attackBuffer";
import { PARTICIPANT_SLOTS } from "../src/game/input/participants";
import { MATCH_TICKS_PER_SECOND, Phase } from "../src/game/lobby/lobbyState";
import { produceComputerInput } from "../src/game/match/botPlay";
import { captureFrame, executeMatchFrame } from "../src/game/match/frameInput";
import { stateChecksum } from "../src/game/replay/canonical";
import { captureReplaySnapshot, createReplaySnapshot } from "../src/game/replay/snapshot";
import { selectableCharacterBySlug } from "../src/game/roster/kits";
import { copyControls, fighterAt, isActive, neutralControls } from "../src/game/sim/roster";

const WIDTH = 1920;
const HEIGHT = 1080;
const STRIP = 24;
const DEFAULT_MINUTES = 25;
const attempt = <A>(operation: string, run: () => A) => Effect.try({ try: run, catch: cause => new CaptureFailure({ problem: `${operation}: ${String(cause)}` }) });

const shell = (command: readonly string[]) => Effect.sync(() => Bun.spawn([...command], { stdin: "ignore", stdout: "pipe", stderr: "pipe" }));

const record = (args: readonly string[]) => Effect.gen(function*() {
  const clientsFile = option(args, "--clients-file");
  const clientName = option(args, "--client");
  const out = option(args, "--out");
  const geometry = option(args, "--geometry");
  const minutes = Number(option(args, "--minutes") ?? `${DEFAULT_MINUTES}`);
  if (clientsFile === undefined || clientName === undefined || out === undefined || geometry === undefined) return yield* new CaptureFailure({ problem: "usage: record --clients-file FILE --client NAME --install DIR --out DIR --geometry 'X,Y 1920x1080' [--minutes M]" });
  const binding = yield* readBinding(args);
  const tools = yield* resolveTools(["grim", "xdotool", "wlrctl", "tesseract", "nsenter", "wf-recorder"]).pipe(Effect.mapError(cause => new CaptureFailure({ problem: String(cause) })));
  const runtimeClients = join(out, "runtime-clients.json");
  yield* attempt("resolve capture client tools", () => {
    mkdirSync(out, { recursive: true });
    writeFileSync(runtimeClients, withRuntimeTools(onlyClient(readFileSync(clientsFile, "utf8"), clientName), tools));
  });
  const client = (yield* loadClients(runtimeClients).pipe(Effect.mapError(failure => new CaptureFailure({ problem: `${failure.operation}: ${failure.cause}` })))).find(row => row.name === clientName);
  if (client === undefined) return yield* new CaptureFailure({ problem: `${clientName} isn't in ${clientsFile}` });
  const logPath = join(dataDirectory(client.documents), TRAILER_LOG_FILE);
  const started = Date.now();
  const read = () => existsSync(logPath) && statSync(logPath).mtimeMs >= started ? preloadLines(readFileSync(logPath, "latin1")) ?? [] : [];
  const video = join(out, "capture.mkv");
  const recorder = Bun.spawn([tools["wf-recorder"] ?? "wf-recorder", "-y", "-g", geometry, "-r", "60", "-c", "libx264", "-p", "preset=ultrafast", "-p", "crf=8", "-x", "yuv420p", "-f", video], {
    env: { ...process.env, ...client.wayland }, stdin: "ignore", stdout: "ignore", stderr: Bun.file(join(out, "wf-recorder.log")),
  });
  let lines: string[] = [];
  while (Date.now() - started < minutes * 60000 && recorder.exitCode === null) {
    lines = read();
    if (lines.some(line => line.startsWith("TRAILER END"))) break;
    yield* Effect.sleep(Duration.seconds(1));
  }
  yield* Effect.sleep(Duration.seconds(1));
  recorder.kill("SIGINT");
  yield* Effect.promise(() => recorder.exited);
  const finished = lines.some(line => line.startsWith("TRAILER END"));
  yield* attempt("write the run record", () => {
    writeFileSync(join(out, "trailer-log.txt"), `${lines.join("\n")}\n`);
    writeFileSync(join(out, "run.json"), `${JSON.stringify({ build: binding, client: client.name, geometry, finished, recorderExit: recorder.exitCode, wallMs: Date.now() - started }, null, 1)}\n`);
  });
  console.log(JSON.stringify({ finished, lines: lines.length, recorderExit: recorder.exitCode, wallSeconds: Math.round((Date.now() - started) / 1000) }));
  if (!finished) return yield* new CaptureFailure({ problem: `the map didn't write TRAILER END to ${TRAILER_LOG_FILE} within ${minutes} minutes` });
});

interface NativeShot {
  readonly checksums: ReadonlyMap<number, string>;
  readonly stocks: readonly string[];
  readonly ended?: number;
}

export function parseTrailerLog(lines: readonly string[]): NativeShot[] {
  const shots: { checksums: Map<number, string>; stocks: string[]; ended?: number }[] = [];
  for (const line of lines) {
    const words = line.split(" ");
    if (words[0] === "SHOT") shots.push({ checksums: new Map(), stocks: [] });
    const shot = shots.at(-1);
    if (shot === undefined) continue;
    if (words[0] === "checksum") shot.checksums.set(Number(words[1]), words[2] ?? "");
    if (words[0] === "stock") shot.stocks.push(line);
    if (words[0] === "ended") shot.ended = Number(words[1]);
  }
  return shots;
}

const NEUTRAL = neutralControls();

export function replayShot(shot: TrailerShot, checksumFrames: ReadonlySet<number>): NativeShot {
  const stageName = Object.entries(FIELD_STAGES).find(([, index]) => index === shot.stage)?.[0];
  const a = selectableCharacterBySlug(shot.fighters[0]);
  const b = selectableCharacterBySlug(shot.fighters[1]);
  if (stageName === undefined || a === undefined || b === undefined) throw new Error(`shot seed ${shot.seed} names no field stage or fighter`);
  const opened = openFieldMatch(a, b, stageName, 0, { bufferedAttacks: true }, shot.seed);
  if (opened === undefined) throw new Error(`seed ${shot.seed}: no spawn`);
  const { match, world, controls, produced, runtime, row } = opened;
  const snapshot = createReplaySnapshot();
  const checksums = new Map<number, string>();
  const stocks: string[] = [];
  const held = PARTICIPANT_SLOTS.map(slot => isActive(world, slot) ? fighterAt(world, slot).status.stocks : 0);
  const last = Math.max(shot.end, ...checksumFrames);
  let frame = 0;
  while (match.phase === Phase.match && frame < last) {
    frame = runtime.simulationFrame + 1;
    for (const slot of PARTICIPANT_SLOTS) {
      copyControls(produced.inputs[slot], NEUTRAL);
      clearAttackBuffer(produced.commands[slot]);
      if (slot === 0 || slot === 1) produceComputerInput(match, world, runtime, slot, frame, produced.inputs[slot], produced.commands[slot], undefined);
    }
    if (!captureFrame(row, frame, world.mask, produced, runtime) || !executeMatchFrame(row, match, world, controls, runtime, frame)) throw new Error(`seed ${shot.seed}: frame ${frame} refused`);
    for (const slot of PARTICIPANT_SLOTS) {
      if (!isActive(world, slot)) continue;
      const now = fighterAt(world, slot).status.stocks;
      if (now !== held[slot]) stocks.push(`stock ${frame} ${slot} ${now}`);
      held[slot] = now;
    }
    const ended = match.phase !== Phase.match;
    if (ended) for (const slot of PARTICIPANT_SLOTS) clearAttackBuffer(controls.commands[slot]);
    if (checksumFrames.has(frame)) {
      captureReplaySnapshot(snapshot, world, match, controls, runtime);
      checksums.set(frame, stateChecksum(snapshot));
    }
    if (ended) return { checksums, stocks: stocks.filter(line => Number(line.split(" ")[1]) < frame), ended: frame };
  }
  return { checksums, stocks };
}

const LATE_STOCK_FRAMES = 1;

export function stocksMatch(native: readonly string[], headless: readonly string[]): boolean {
  return native.length === headless.length && native.every((line, index) => {
    const [, nativeFrame, ...nativeRest] = line.split(" ");
    const [, headlessFrame, ...headlessRest] = (headless[index] ?? "").split(" ");
    const late = Number(nativeFrame) - Number(headlessFrame);
    return nativeRest.join(" ") === headlessRest.join(" ") && late >= 0 && late <= LATE_STOCK_FRAMES;
  });
}

interface Stamped { readonly index: number; readonly frame: number }

const stampStrips = (ffmpeg: string, video: string) => Effect.flatMap(shell([ffmpeg, "-v", "error", "-i", video, "-filter_complex", `[0:v]split[a][b];[a]crop=iw:${STRIP}:0:0[t];[b]crop=iw:${STRIP}:0:ih-${STRIP}[u];[t][u]vstack`, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]), child => Effect.promise(async () => {
  const size = WIDTH * STRIP * 2 * 3;
  const stamps: (number | undefined)[] = [];
  let pending = new Uint8Array(0);
  for await (const chunk of child.stdout) {
    const joined = new Uint8Array(pending.length + chunk.length);
    joined.set(pending);
    joined.set(chunk, pending.length);
    let offset = 0;
    for (; offset + size <= joined.length; offset += size) {
      const stamp = frameStamp({ width: WIDTH, height: STRIP * 2, rgb: joined.subarray(offset, offset + size) });
      stamps.push(stamp?.script === TRAILER_SCRIPT ? stamp.frame : undefined);
    }
    pending = joined.slice(offset);
  }
  await child.exited;
  return stamps;
}));

export function segments(stamps: readonly (number | undefined)[]): Stamped[][] {
  const runs: Stamped[][] = [];
  let run: Stamped[] = [];
  for (let index = 0; index < stamps.length; index++) {
    const frame = stamps[index];
    if (frame === undefined) continue;
    const previous = run.at(-1);
    if (previous !== undefined && (frame < previous.frame || index - previous.index > MATCH_TICKS_PER_SECOND)) {
      runs.push(run);
      run = [];
    }
    run.push({ index, frame });
  }
  if (run.length > 0) runs.push(run);
  return runs;
}

export const openedMatches = (runs: readonly Stamped[][]): Stamped[][] => runs.filter(run => (run[0]?.frame ?? Infinity) <= MATCH_TICKS_PER_SECOND);

export function windowOf(run: readonly Stamped[], shot: TrailerShot, end = shot.end) {
  const inside = run.filter(stamped => stamped.frame >= shot.start && stamped.frame <= end);
  const seen = new Map<number, number>();
  for (const { frame } of inside) seen.set(frame, (seen.get(frame) ?? 0) + 1);
  const missing: number[] = [];
  for (let frame = shot.start; frame <= end; frame++) if (!seen.has(frame)) missing.push(frame);
  const repeated = [...seen.entries()].filter(([, count]) => count > 1).map(([frame]) => frame);
  return { first: inside[0]?.index, last: inside.at(-1)?.index, missing, repeated };
}

const judge = (args: readonly string[]) => Effect.gen(function*() {
  const directory = args.find(value => !value.startsWith("--"));
  if (directory === undefined) return yield* new CaptureFailure({ problem: "usage: judge DIR" });
  const tools = yield* resolveTools(["ffmpeg", "ffprobe"]).pipe(Effect.mapError(cause => new CaptureFailure({ problem: String(cause) })));
  const ffmpeg = tools["ffmpeg"] ?? "ffmpeg";
  const ffprobe = tools["ffprobe"] ?? "ffprobe";
  const video = join(directory, "capture.mkv");
  const native = parseTrailerLog(yield* attempt("read trailer-log.txt", () => readFileSync(join(directory, "trailer-log.txt"), "utf8").split("\n")));
  const cache = join(directory, "stamps.json");
  const stamps: readonly (number | null)[] = existsSync(cache) ? JSON.parse(readFileSync(cache, "utf8")) as (number | null)[] : (yield* stampStrips(ffmpeg, video)).map(frame => frame ?? null);
  if (!existsSync(cache)) yield* attempt("write stamps.json", () => writeFileSync(cache, JSON.stringify(stamps)));
  const runs = openedMatches(segments(stamps.map(frame => frame ?? undefined)));
  if (runs.length !== TRAILER_SHOTS.length) return yield* new CaptureFailure({ problem: `${runs.length} stamped matches in the capture, ${TRAILER_SHOTS.length} shots` });
  const rows = [];
  for (const [index, shot] of TRAILER_SHOTS.entries()) {
    const nativeShot = native[index];
    const run = runs[index] ?? [];
    if (nativeShot === undefined) return yield* new CaptureFailure({ problem: `the map log has no shot ${index}` });
    const headless = replayShot(shot, new Set(nativeShot.checksums.keys()));
    const checksumsEqual = [...nativeShot.checksums].every(([frame, sum]) => headless.checksums.get(frame) === sum);
    const stocksEqual = stocksMatch(nativeShot.stocks, headless.stocks.filter(line => Number(line.split(" ")[1]) <= Math.max(...nativeShot.checksums.keys())));
    const endedEqual = nativeShot.ended === headless.ended;
    const end = Math.min(shot.end, headless.ended ?? shot.end);
    const window = windowOf(run, shot, end);
    const name = `shot-${String(index + 1).padStart(2, "0")}-seed-${shot.seed}.mp4`;
    let clip: { readonly frames: number; readonly missing: number; readonly repeated: number; readonly width?: number; readonly height?: number; readonly rate?: string } = { frames: 0, missing: end - shot.start + 1, repeated: 0 };
    if (window.first !== undefined && window.last !== undefined) {
      const frames = window.last - window.first + 1;
      const cut = yield* shell([ffmpeg, "-v", "error", "-y", "-ss", (window.first / 60).toFixed(6), "-i", video, "-frames:v", String(frames), "-r", "60", "-c:v", "libx264", "-preset", "slow", "-crf", "14", "-pix_fmt", "yuv420p", join(directory, name)]);
      yield* Effect.promise(() => cut.exited);
      const clipWindow = windowOf(segments(yield* stampStrips(ffmpeg, join(directory, name))).flat(), shot, end);
      const probe = yield* shell([ffprobe, "-v", "error", "-select_streams", "v:0", "-count_frames", "-show_entries", "stream=width,height,r_frame_rate,nb_read_frames", "-of", "json", join(directory, name)]);
      const probed = JSON.parse(yield* Effect.promise(() => new Response(probe.stdout).text())) as { streams?: { width?: number; height?: number; r_frame_rate?: string; nb_read_frames?: string }[] };
      const stream = probed.streams?.[0];
      clip = { frames: Number(stream?.nb_read_frames ?? 0), missing: clipWindow.missing.length, repeated: clipWindow.repeated.length, ...(stream?.width === undefined ? {} : { width: stream.width }), ...(stream?.height === undefined ? {} : { height: stream.height }), ...(stream?.r_frame_rate === undefined ? {} : { rate: stream.r_frame_rate }) };
    }
    const pass = checksumsEqual && stocksEqual && endedEqual && clip.missing === 0 && clip.repeated === 0 && clip.width === WIDTH && clip.height === HEIGHT && clip.rate === "60/1";
    rows.push({ shot: index + 1, seed: shot.seed, fighters: shot.fighters, stage: shot.stage, start: shot.start, end, file: name, checksumsEqual, stocksEqual, endedEqual, captureMissing: window.missing.length, captureRepeated: window.repeated.length, clip, pass });
  }
  const verdict = { pass: rows.every(row => row.pass), shots: rows };
  yield* attempt("write verdict.json", () => writeFileSync(join(directory, "verdict.json"), `${JSON.stringify(verdict, null, 1)}\n`));
  for (const row of rows) console.log(JSON.stringify(row));
  if (!verdict.pass) return yield* new CaptureFailure({ problem: `${rows.filter(row => !row.pass).length} of ${rows.length} shots fail` });
});

export function trailerCapture(argv: readonly string[]) {
  const [verb, ...args] = argv;
  const program = verb === "record" ? record(args) : verb === "judge" ? judge(args) : Effect.fail(new CaptureFailure({ problem: "usage: trailerCapture.ts record|judge ..." }));
  return program.pipe(Effect.provide(Layer.merge(BunServices.layer, platformLayer())));
}
if (import.meta.main) BunRuntime.runMain(trailerCapture(Bun.argv.slice(2)));
