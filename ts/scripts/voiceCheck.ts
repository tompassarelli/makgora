import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Effect, Layer, Schema } from "effect";
import { capture, loadClients } from "wisp/scripts/warcraft/desktop";
import { preloadLines } from "wisp/scripts/wisp/preloadRecord";
import { dataDirectory } from "wisp/scripts/wisp/gameFiles";
import { platformLayer } from "wisp/scripts/platform/layer";
import { onlyClient, resolveTools, withRuntimeTools } from "./wisp/nativeTools";
import { CaptureFailure, option, readBinding, recordAudio } from "./nativeCapture";
import { frameStamp } from "./nativeCaptureVerdict";
import { VOICE_CHECK_SCRIPT, VOICE_LOG_FILE } from "../src/game/core/gameFiles";
import { type StampSample, FRAME_MS, judge, onsets, parseVoices, parseWav } from "./voiceOnsets";

const MAX_MINUTES = 5;
const attempt = <A>(operation: string, run: () => A) => Effect.try({ try: run, catch: cause => new CaptureFailure({ problem: `${operation}: ${String(cause)}` }) });

const run = (args: readonly string[]) => Effect.scoped(Effect.gen(function*() {
  const clientsFile = option(args, "--clients-file");
  const clientName = option(args, "--client");
  const out = option(args, "--out");
  const minutes = Math.min(MAX_MINUTES, Number(option(args, "--minutes") ?? `${MAX_MINUTES}`));
  if (clientsFile === undefined || clientName === undefined || out === undefined) return yield* new CaptureFailure({ problem: "usage: run --clients-file FILE --client NAME --install DIR --out DIR [--minutes M<=5] [--audio-sink SINK]" });
  const binding = yield* readBinding(args);
  const tools = yield* resolveTools().pipe(Effect.mapError(cause => new CaptureFailure({ problem: String(cause) })));
  const runtimeClients = join(out, "runtime-clients.json");
  yield* attempt("resolve capture client tools", () => {
    mkdirSync(out, { recursive: true });
    writeFileSync(runtimeClients, withRuntimeTools(onlyClient(readFileSync(clientsFile, "utf8"), clientName), tools));
  });
  const client = (yield* loadClients(runtimeClients).pipe(Effect.mapError(failure => new CaptureFailure({ problem: `${failure.operation}: ${failure.cause}` })))).find(row => row.name === clientName);
  if (client === undefined) return yield* new CaptureFailure({ problem: `${clientName} isn't in ${clientsFile}` });
  const logPath = join(dataDirectory(client.documents), VOICE_LOG_FILE);
  const started = Date.now();
  const read = () => existsSync(logPath) && statSync(logPath).mtimeMs >= started ? preloadLines(readFileSync(logPath, "latin1")) ?? [] : [];
  const audio = yield* recordAudio(option(args, "--audio-sink") ?? `wisp-online-${client.name}`, join(out, "audio.wav"), started);
  const stamps: StampSample[] = [];
  let unread = 0;
  let lines: string[] = [];
  while (Date.now() - started < minutes * 60000) {
    lines = read();
    if (lines[0]?.startsWith("VOICE CHECK END") === true) break;
    const before = Date.now();
    const frame = yield* capture(client).pipe(Effect.mapError(failure => new CaptureFailure({ problem: `${failure.operation}: ${failure.cause}` })));
    const captureMs = Date.now() - before;
    const stamp = frameStamp(frame);
    if (stamp?.script === VOICE_CHECK_SCRIPT) stamps.push({ ms: before - started, captureMs, frame: stamp.frame });
    else unread++;
  }
  const finished = lines[0]?.startsWith("VOICE CHECK END") === true;
  yield* attempt("write the run record", () => {
    writeFileSync(join(out, "voices.txt"), `${lines.join("\n")}\n`);
    writeFileSync(join(out, "run.json"), `${JSON.stringify({ build: binding, client: client.name, finished, audio, stamps, unread, wallMs: Date.now() - started }, null, 1)}\n`);
  });
  console.log(JSON.stringify({ finished, voices: Math.max(0, lines.length - 1), stamps: stamps.length, unread, medianCaptureMs: [...stamps.map(row => row.captureMs)].sort((a, b) => a - b)[Math.floor(stamps.length / 2)] ?? 0 }));
  if (!finished) return yield* new CaptureFailure({ problem: `the match didn't write ${VOICE_LOG_FILE} within ${minutes} minutes` });
}));

const RunRecord = Schema.fromJsonString(Schema.Struct({
  audio: Schema.Struct({ startedMs: Schema.Finite }),
  stamps: Schema.Array(Schema.Struct({ ms: Schema.Finite, captureMs: Schema.Finite, frame: Schema.Finite })),
}));

const judgeRun = (args: readonly string[]) => Effect.gen(function*() {
  const directory = args.find(value => !value.startsWith("--"));
  if (directory === undefined) return yield* new CaptureFailure({ problem: "usage: judge DIR" });
  const record = yield* Schema.decodeEffect(RunRecord)(yield* attempt("read run.json", () => readFileSync(join(directory, "run.json"), "utf8"))).pipe(Effect.mapError(cause => new CaptureFailure({ problem: `run.json: ${String(cause)}` })));
  const voices = parseVoices(yield* attempt("read voices.txt", () => readFileSync(join(directory, "voices.txt"), "utf8").split("\n")));
  const found = onsets(yield* attempt("read audio.wav", () => parseWav(readFileSync(join(directory, "audio.wav")))));
  const verdict = judge(voices, record.stamps, found, record.audio.startedMs);
  const fixed = (value: number | undefined) => value === undefined ? "-" : value.toFixed(1);
  yield* attempt("write the onset table", () => {
    writeFileSync(join(directory, "onsets.tsv"), `${["frame", "drawn", "fighter", "live", "isolated", "expected_ms", "offset_ms", "on_frame", "sound"].join("\t")}\n${verdict.rows.map(row => [row.frame, row.drawn, row.fighter, row.live, row.isolated ? 1 : 0, fixed(row.expectedMs), fixed(row.offsetMs), row.onFrame ? 1 : 0, row.sound].join("\t")).join("\n")}\n`);
    const { rows: _rows, ...summary } = verdict;
    writeFileSync(join(directory, "verdict.json"), `${JSON.stringify({ ...summary, onsets: found.length, frameMs: FRAME_MS }, null, 1)}\n`);
  });
  const { rows: _rows, ...summary } = verdict;
  console.log(JSON.stringify({ ...summary, onsets: found.length }));
  if (!verdict.pass) return yield* new CaptureFailure({ problem: `${verdict.off} of ${verdict.hits} hit sounds start off their frame, ${verdict.unmatched} have no onset within 100 ms, max live ${verdict.maxLive}` });
});

export function voiceCheck(argv: readonly string[]) {
  const [verb, ...args] = argv;
  const program = verb === "run" ? run(args) : verb === "judge" ? judgeRun(args) : Effect.fail(new CaptureFailure({ problem: "usage: voiceCheck.ts run|judge ..." }));
  return program.pipe(Effect.provide(Layer.merge(BunServices.layer, platformLayer())));
}
if (import.meta.main) BunRuntime.runMain(voiceCheck(Bun.argv.slice(2)));
