




















import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, statfsSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { basename, dirname, join } from "node:path";
import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Effect, Layer, Schema } from "effect";
import { ChildProcess } from "effect/process";
import { runProcess } from "./hostProcess";
import { onlyClient, resolveTools, withRuntimeTools } from "./wisp/nativeTools";
import { CLASSIC_BUILDS } from "./wisp/classicBuilds";
import { capture, loadClients } from "wisp/scripts/warcraft/desktop";
import { type Frame, decodePpm, encodePpm } from "wisp/scripts/wisp/frameProbe";
import { preloadLines } from "wisp/scripts/wisp/preloadRecord";
import { dataDirectory } from "wisp/scripts/wisp/gameFiles";
import { parsePadScript } from "./integrity/padScript";
import { STAMP_CELL } from "../src/game/core/drawnStamp";
import { CAPTURE_STATUS_FILE } from "../src/game/core/gameFiles";
import { CAPTURE_FIXTURES, type CaptureFixture, SILHOUETTE_HIDDEN_FRAME, type Silhouette } from "../src/platform/captureFixtures";
import { encodePng } from "./wisp/hurtboxView";
import { platformLayer } from "wisp/scripts/platform/layer";
import { sheetCanvas, putSheetFrame, writeSheet } from "./nativeCaptureSheet";
import { nativeCaptureChunks } from "./nativeCaptureChunks";
import { frameVerdict } from "./nativeCaptureVerdict";

export class CaptureFailure extends Schema.TaggedError<CaptureFailure, { readonly brand: unique symbol }>()("CaptureFailure", { problem: Schema.String }) {
  override get message(): string { return this.problem; }
}
const fail = (problem: string): never => { throw new CaptureFailure({ problem }); };
const attempt = <A>(operation: string, run: () => A) => Effect.try({ try: run, catch: cause => new CaptureFailure({ problem: `${operation}: ${String(cause)}` }) });

const FIXTURES_MODULE = join(import.meta.dir, "../src/platform/captureFixtures.ts");

export function option(args: readonly string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
}

const SWITCHES = new Set(["--control", "--no-audio", "--sheets"]);
const positional = (args: readonly string[]) => args.filter((value, index) => !value.startsWith("--") && !(args[index - 1]?.startsWith("--") === true && !SWITCHES.has(args[index - 1] ?? "")));


// `#! silhouette a|b FIGHTER MOVE [WIDTHxHEIGHT]`: the fighter in that slot, the move it plays and the client resolution.
export function silhouetteOf(path: string, lines: readonly string[]): Silhouette | undefined {
  const rows = lines.filter(line => /^\s*#!\s*silhouette\b/.test(line));
  if (rows.length === 0) return undefined;
  const match = /^\s*#!\s*silhouette\s+([ab])\s+(\S+)\s+(\S+)(?:\s+(\d+)x(\d+))?\s*$/.exec(rows[0] ?? "");
  if (rows.length > 1 || match === null) return fail(`${path}: a silhouette line is "#! silhouette a|b FIGHTER MOVE [WIDTHxHEIGHT]", once`);
  return { slot: match[1] === "a" ? 0 : 1, fighter: match[2] ?? "", move: match[3] ?? "", width: Number(match[4] ?? 1920), height: Number(match[5] ?? 1080) };
}

export function fixtureOf(path: string, script: string): CaptureFixture {
  const chat = /^\s*\S+\s+[ab]\s+(?:chat|move|brace|cross)(?:\s|$)/;
  const lines = script.split("\n");
  const silhouette = silhouetteOf(path, lines);
  if (lines.some(line => chat.test(line) && line.trim().startsWith("+"))) fail(`${path}: a chat line needs an absolute frame`);
  const frames = [...new Set(parsePadScript(lines.filter(line => !chat.test(line)).join("\n")).filter(step => step.kind === "capture").map(step => step.frame))].sort((a, b) => a - b);
  if (frames.length === 0) fail(`${path}: no capture lines`);
  if (frames[0] === 0) fail(`${path}: a capture at frame 0 can't be held`);
  if (silhouette !== undefined && (frames.at(-1) ?? 0) >= SILHOUETTE_HIDDEN_FRAME) fail(`${path}: a silhouette capture frame must be below ${SILHOUETTE_HIDDEN_FRAME}`);
  const folder = basename(dirname(path));
  const name = folder === "pads" || folder === "captures" ? basename(path, ".pad") : `${folder}-${basename(path, ".pad")}`;
  const reel = /^#! reel (\S+) (R\d+) (\S+) (right|left) (\d+)$/m.exec(script);
  if (reel !== null && silhouette !== undefined) fail(`${path}: a script is a reel or a silhouette, not both`);
  if (reel === null) return silhouette === undefined ? { name, frames, script } : { name, frames, script, silhouette };
  const [, fighter = "", row = "", slot = "", facing, ticks] = reel;
  if (facing !== "right" && facing !== "left") fail("invalid reel facing");
  const holdTicks = Number(ticks);
  if (holdTicks < 6 || holdTicks > 180) fail("reel hold ticks must be 6..180");
  return { name, frames, script, holdTicks, openingTicks: 1, tailFrames: 0, reel: { fighter, row, slot, facing: facing === "left" ? "left" : "right" } };
}

const build = (args: readonly string[]) => Effect.gen(function*() {
  const out = option(args, "--out");
  const name = option(args, "--name") ?? "Smashcraft native capture";
  const pads = positional(args).flatMap(path => statSync(path).isDirectory() ? readdirSync(path).filter(file => file.endsWith(".pad")).sort().map(file => join(path, file)) : [path]);
  if (out === undefined) return yield* new CaptureFailure({ problem: "usage: build --out MAP.w3x [--name NAME] [PAD|DIR...]; without scripts it builds the control" });

  const scripts = yield* attempt("read pad scripts", () => pads.map(path => fixtureOf(path, readFileSync(path, "utf8"))));
  const fixtures = pads.length === 0 ? CAPTURE_FIXTURES : args.includes("--control") ? [...CAPTURE_FIXTURES, ...scripts] : scripts;
  if (new Set(fixtures.map(fixture => fixture.name)).size !== fixtures.length) return yield* new CaptureFailure({ problem: "two pad scripts share a fixture name" });
  if (fixtures.length >= 64) return yield* new CaptureFailure({ problem: "a capture map holds at most 63 scripts; split the batch" });
  const original = yield* attempt("read the checked-in fixtures", () => readFileSync(FIXTURES_MODULE, "utf8"));
  const generated = pads.length === 0 ? original : `${original.slice(0, original.indexOf("const WALK"))}export const CAPTURE_FIXTURES: readonly CaptureFixture[] = ${JSON.stringify(fixtures, null, 2)};\n`;
  const code = yield* Effect.acquireUseRelease(
    attempt("write this build's fixtures", () => writeFileSync(FIXTURES_MODULE, generated)),
    () => Effect.tryPromise({
      try: () => Bun.spawn(["bun", "scripts/wisp.ts", "map", "build", "--profile", "native-capture", "--name", name, "--out", out], { cwd: join(import.meta.dir, ".."), stdout: "inherit", stderr: "inherit" }).exited,
      catch: cause => new CaptureFailure({ problem: `map build: ${String(cause)}` }),
    }),
    () => Effect.sync(() => writeFileSync(FIXTURES_MODULE, original)),
  );
  if (code !== 0) return yield* new CaptureFailure({ problem: `map build exited ${code}` });
  const manifest = `${out.replace(/\.w3x$/, "")}.captures.json`;
  const sourceRevision = yield* runProcess(ChildProcess.make("git", ["rev-parse", "HEAD"], { cwd: join(import.meta.dir, "..") })).pipe(Effect.mapError(failure => new CaptureFailure({ problem: failure.message })));
  const mapSha256 = createHash("sha256").update(readFileSync(out)).digest("hex");
  yield* attempt("write the manifest", () => writeFileSync(manifest, `${JSON.stringify({ map: out, mapSha256, sourceRevision, fixtures: fixtures.map(({ script: _, ...fixture }) => fixture) }, null, 2)}\n`));
  console.log(`built ${out}: ${fixtures.length} scripts, ${fixtures.reduce((total, fixture) => total + fixture.frames.length, 0)} captures; manifest ${manifest}`);
});

const SilhouetteRow = Schema.Struct({ slot: Schema.Finite, fighter: Schema.String, move: Schema.String, width: Schema.Finite, height: Schema.Finite });
const FixtureRecord = Schema.Struct({ name: Schema.String, frames: Schema.Array(Schema.Finite), reel: Schema.optionalKey(Schema.Struct({ fighter: Schema.String, row: Schema.String, slot: Schema.String, facing: Schema.Literals(["right", "left"]) })), silhouette: Schema.optional(SilhouetteRow) });
const Manifest = Schema.fromJsonString(Schema.Struct({ map: Schema.String, mapSha256: Schema.optionalKey(Schema.String), sourceRevision: Schema.optionalKey(Schema.String), fixtures: Schema.Array(FixtureRecord) }));
const CaptureRecord = Schema.Struct({ fixture: Schema.String, frame: Schema.Finite, phase: Schema.Literals(["held", "shown", "hidden"]), file: Schema.String, capturedMs: Schema.Finite, width: Schema.Finite, height: Schema.Finite });
const Checkpoint = Schema.fromJsonString(Schema.Struct({ version: Schema.Literals([1]), mapSha256: Schema.String, sourceRevision: Schema.String, captures: Schema.Array(CaptureRecord) }));
const BatchPlan = Schema.fromJsonString(Schema.Struct({ version: Schema.Literals([1]), sourceRevision: Schema.String, rows: Schema.Array(Schema.Struct({ name: Schema.String, map: Schema.String, manifest: Schema.String, mapSha256: Schema.String, frames: Schema.Array(Schema.Finite) })) }));

export function heldCapture(fixture: { readonly frames: readonly number[]; readonly silhouette?: unknown }, stampFrame: number): { readonly frame: number; readonly phase: "held" | "shown" | "hidden" } | undefined {
  if (fixture.silhouette === undefined) return fixture.frames.includes(stampFrame) ? { frame: stampFrame, phase: "held" } : undefined;
  const hidden = stampFrame >= SILHOUETTE_HIDDEN_FRAME;
  const frame = hidden ? stampFrame - SILHOUETTE_HIDDEN_FRAME : stampFrame;
  return fixture.frames.includes(frame) ? { frame, phase: hidden ? "hidden" : "shown" } : undefined;
}

const PipeWireObjects = Schema.fromJsonString(Schema.Array(Schema.Struct({
  id: Schema.Finite,
  type: Schema.String,
  info: Schema.optional(Schema.NullOr(Schema.Struct({
    props: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
    "input-node-id": Schema.optional(Schema.Finite),
  }))),
})));


const sinkSerial = (sink: string) => Effect.gen(function*() {
  const dump = yield* runProcess(ChildProcess.make("pw-dump", [])).pipe(Effect.mapError(failure => new CaptureFailure({ problem: failure.message })));
  const objects = yield* Schema.decodeEffect(PipeWireObjects)(dump).pipe(Effect.mapError(cause => new CaptureFailure({ problem: `pw-dump: ${String(cause)}` })));
  const fed = new Set(objects.filter(row => row.type === "PipeWire:Interface:Link").map(row => row.info?.["input-node-id"]));
  const sinks = objects.filter(row => row.type === "PipeWire:Interface:Node" && row.info?.props?.["node.name"] === sink && row.info.props["media.class"] === "Audio/Sink")
    .map(row => ({ fed: fed.has(row.id), serial: Number(row.info?.props?.["object.serial"]) }))
    .sort((a, b) => Number(b.fed) - Number(a.fed) || b.serial - a.serial);
  const chosen = sinks[0];
  if (chosen === undefined || !Number.isInteger(chosen.serial)) return yield* new CaptureFailure({ problem: `no PipeWire sink ${sink}; pass --audio-sink SINK or --no-audio` });
  return chosen;
});


export const recordAudio = (sink: string, file: string, started: number) => Effect.gen(function*() {
  const chosen = yield* sinkSerial(sink);
  const startedMs = Date.now() - started;
  yield* ChildProcess.make("pw-record", ["--target", String(chosen.serial), "-P", "{ stream.capture.sink=true }", "--rate", "48000", "--channels", "2", "--format", "s16", file], { stdin: "ignore", stdout: "ignore", stderr: "inherit", killSignal: "SIGINT", forceKillAfter: "3 seconds" })
    .pipe(Effect.mapError(cause => new CaptureFailure({ problem: `pw-record: ${cause.message}` })));
  console.log(`recording ${sink} (serial ${chosen.serial}${chosen.fed ? ", playing" : ", silent so far"}) to ${file}`);
  return { file: basename(file), sink, serial: chosen.serial, startedMs };
});


function cropFrame(frame: Frame, [x0, y0, width, height]: readonly [number, number, number, number]): Frame {
  const rgb = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y++) rgb.set(frame.rgb.subarray(((y + y0) * frame.width + x0) * 3, ((y + y0) * frame.width + x0 + width) * 3), y * width * 3);
  return { width, height, rgb };
}

const VERSIONS_URL = "http://us.patch.battle.net:1119/w3/versions";

function pipeTable(text: string): Record<string, string>[] {
  const lines = text.split("\n").map(line => line.trim()).filter(line => line !== "" && !line.startsWith("#"));
  const header = (lines[0] ?? "").split("|").map(column => column.split("!")[0] ?? "");
  return lines.slice(1).map(line => Object.fromEntries(line.split("|").map((value, index) => [header[index] ?? "", value])));
}

export function installedBuild(buildInfo: string): { readonly build: string; readonly branch: string } {
  const rows = pipeTable(buildInfo);
  const row = rows.find(entry => entry.Active === "1") ?? rows[0];
  if (row?.Version === undefined || row.Version === "") fail(".build.info names no Version");
  return { build: row!.Version!, branch: row!.Branch || "us" };
}

export function liveBuild(versions: string, region: string): string {
  const rows = pipeTable(versions);
  const row = rows.find(entry => entry.Region === region) ?? fail(`w3/versions has no ${region} row`);
  return row.VersionsName || fail(`w3/versions ${region} row names no build`);
}

export function bindBuild(installed: string, live: string, freeBytes: number, updateBytes: number | undefined) {
  const binding = { installed, live, equal: installed === live, freeBytes, ...(updateBytes === undefined ? {} : { updateBytes, updateFits: updateBytes <= freeBytes }) };
  if (!binding.equal) fail(`installed ${installed} isn't the live ${live}: captures bind to the live build. Before Battle.net updates, compare free space (${freeBytes} bytes) with the update's size${updateBytes === undefined ? " (pass --update-bytes N)" : `: ${updateBytes} bytes ${binding.updateFits ? "fit" : "don't fit"}`}`);
  return binding;
}

export const readBinding = (args: readonly string[]) => Effect.gen(function*() {
  const install = option(args, "--install");
  if (install === undefined) return yield* new CaptureFailure({ problem: "--install DIR names the installation whose .build.info the captures bind to" });
  const versionsFile = option(args, "--versions");
  const updateText = option(args, "--update-bytes");
  const updateBytes = updateText === undefined ? undefined : Number(updateText);
  if (updateBytes !== undefined && !Number.isSafeInteger(updateBytes)) return yield* new CaptureFailure({ problem: "--update-bytes takes a whole number" });
  const { build, branch } = yield* attempt("read .build.info", () => installedBuild(readFileSync(join(install, ".build.info"), "utf8")));
  const offlineBuild = option(args, "--offline-build");
  if (offlineBuild !== undefined) {
    if (!CLASSIC_BUILDS.includes(offlineBuild) || build !== offlineBuild) return yield* new CaptureFailure({ problem: `offline Classic capture requires an installed ${CLASSIC_BUILDS.join(" or ")}, got ${build}` });
    return { install, readAt: new Date().toISOString(), installed: build, live: build, equal: true, offline: true };
  }
  const versions = versionsFile === undefined
    ? yield* Effect.tryPromise({ try: async () => { const response = await fetch(VERSIONS_URL, { signal: AbortSignal.timeout(15000) }); if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.text(); }, catch: cause => new CaptureFailure({ problem: `read ${VERSIONS_URL}: ${String(cause)}` }) })
    : yield* attempt("read --versions", () => readFileSync(versionsFile, "utf8"));
  const live = yield* attempt("read the live build", () => liveBuild(versions, branch));
  const freeBytes = yield* attempt("read free space", () => { const disk = statfsSync(install); return disk.bavail * disk.bsize; });
  const binding = yield* attempt("bind to the live build", () => bindBuild(build, live, freeBytes, updateBytes));
  return { install, readAt: new Date().toISOString(), ...binding };
});

const buildCheck = (args: readonly string[]) => readBinding(args).pipe(Effect.tap(binding => Effect.sync(() => console.log(JSON.stringify(binding)))));

export const runCaptures = (args: readonly string[]) => Effect.scoped(Effect.gen(function*() {
  const clientsFile = option(args, "--clients-file");
  const clientName = option(args, "--client");
  const manifestPath = option(args, "--manifest");
  const out = option(args, "--out");
  const minutes = Number(option(args, "--minutes") ?? "60");
  const cropText = option(args, "--crop");
  const [cx, cy, cw, ch, ...extra] = cropText?.split(",").map(Number) ?? [];
  const crop = cx !== undefined && cy !== undefined && cw !== undefined && ch !== undefined ? [cx, cy, cw, ch] as const : undefined;
  if (cropText !== undefined && (crop === undefined || extra.length > 0 || !crop.every(Number.isInteger))) return yield* new CaptureFailure({ problem: "--crop takes X,Y,W,H in whole pixels" });
  if (clientsFile === undefined || clientName === undefined || manifestPath === undefined || out === undefined) return yield* new CaptureFailure({ problem: "usage: run --clients-file FILE --client NAME --install DIR --manifest MAP.captures.json --out DIR [--versions FILE] [--minutes M] [--crop X,Y,W,H] [--audio-sink SINK | --no-audio]" });
  const text = yield* attempt("read the manifest", () => readFileSync(manifestPath, "utf8"));
  const manifest = yield* Schema.decodeEffect(Manifest)(text).pipe(Effect.mapError(cause => new CaptureFailure({ problem: `${manifestPath}: ${String(cause)}` })));
  const sheets = args.includes("--sheets");
  const effectText = option(args, "--effect-crop");
  const [ex, ey, ew, eh, ...effectExtra] = effectText?.split(",").map(Number) ?? [];
  const effectCrop = ex !== undefined && ey !== undefined && ew !== undefined && eh !== undefined && effectExtra.length === 0 ? [ex, ey, ew, eh] as const : undefined;
  if (sheets && (crop === undefined || effectCrop === undefined || !effectCrop.every(Number.isInteger) || manifest.fixtures.some(row => row.reel === undefined) || new Set(manifest.fixtures.map(row => row.reel?.fighter)).size !== 1)) return yield* new CaptureFailure({ problem: "--sheets needs one fighter's reel manifest, --crop X,Y,W,H excluding HUD/labels and --effect-crop X,Y,W,H excluding the body" });
  if (sheets && (manifest.fixtures.length > 63 || manifest.fixtures.some(row => row.frames.length !== 8) || new Set(manifest.fixtures.map(row => row.reel?.row)).size !== manifest.fixtures.length)) return yield* new CaptureFailure({ problem: "a sheet needs at most 63 unique rows with eight frames each" });
  const canvas = sheets ? sheetCanvas(manifest.fixtures.map(row => ({ row: row.reel?.row ?? "", frames: row.frames }))) : undefined;
  const tools = yield* resolveTools().pipe(Effect.mapError(cause => new CaptureFailure({ problem: String(cause) })));
  const runtimeClients = join(out, "runtime-clients.json");
  yield* attempt("resolve capture client tools", () => {
    mkdirSync(out, { recursive: true });
    writeFileSync(runtimeClients, withRuntimeTools(onlyClient(readFileSync(clientsFile, "utf8"), clientName), tools));
  });
  const client = (yield* loadClients(runtimeClients).pipe(Effect.mapError(failure => new CaptureFailure({ problem: `${failure.operation}: ${failure.cause}` })))).find(row => row.name === clientName);
  if (client === undefined) return yield* new CaptureFailure({ problem: `${clientName} isn't in ${clientsFile}` });
  const binding = yield* readBinding(args);
  console.log(`build: installed ${binding.installed}, live ${binding.live}`);
  yield* attempt("create the result folder", () => mkdirSync(out, { recursive: true }));
  const resumable = manifest.mapSha256 !== undefined && manifest.sourceRevision !== undefined;
  const actualMapSha256 = existsSync(manifest.map) ? createHash("sha256").update(readFileSync(manifest.map)).digest("hex") : undefined;
  if (manifest.mapSha256 !== undefined && manifest.mapSha256 !== actualMapSha256) return yield* new CaptureFailure({ problem: `${manifest.map}: map hash differs from its capture manifest` });
  const mapSha256 = actualMapSha256 ?? "unknown";
  const sourceRevision = manifest.sourceRevision ?? "unknown";
  const checkpointPath = join(out, "checkpoint.json");
  const statusPath = join(dataDirectory(client.documents), CAPTURE_STATUS_FILE);
  const started = Date.now();
  const audio = sheets || args.includes("--no-audio") ? undefined : yield* recordAudio(option(args, "--audio-sink") ?? `wisp-online-${client.name}`, join(out, "audio.wav"), started);
  const wanted = manifest.fixtures.reduce((total, fixture) => total + fixture.frames.length * (fixture.silhouette === undefined ? 1 : 2), 0);
  const saved = new Map<string, { fixture: string; frame: number; phase: "held" | "shown" | "hidden"; file: string; capturedMs: number; width: number; height: number }>();
  if (resumable && existsSync(checkpointPath)) {
    const checkpoint = yield* Schema.decodeEffect(Checkpoint)(yield* attempt("read capture checkpoint", () => readFileSync(checkpointPath, "utf8"))).pipe(Effect.mapError(cause => new CaptureFailure({ problem: `${checkpointPath}: ${String(cause)}` })));
    if (checkpoint.mapSha256 !== mapSha256 || checkpoint.sourceRevision !== sourceRevision) return yield* new CaptureFailure({ problem: `${checkpointPath}: map identity changed; start a new row output` });
    for (const capture of checkpoint.captures) {
      const file = join(out, capture.file);
      if (!existsSync(file) || statSync(file).size === 0) continue;
      saved.set(`${capture.fixture}/${capture.frame}/${capture.phase}`, capture);
    }
    console.log(`resuming ${saved.size}/${wanted} saved frames for ${manifest.fixtures.map(fixture => fixture.name).join(",")}`);
  }
  const log: { ms: number; captureMs: number; stamp: string }[] = [];
  let lastScript = 0;
  let idleSince = Date.now();
  let lastStatus = "";
  let sawFinalScript = false;
  let captureDone = false;
  while (saved.size < wanted && Date.now() - started < minutes * 60000) {
    const status = existsSync(statusPath) && statSync(statusPath).mtimeMs >= started ? preloadLines(readFileSync(statusPath, "latin1"))?.[0] ?? "" : "";
    if (status !== lastStatus) { lastStatus = status; console.log(status); }
    const finalFixture = manifest.fixtures.at(-1);
    if (finalFixture !== undefined && status === `CAPTURE SCRIPT ${manifest.fixtures.length} ${finalFixture.name}`) sawFinalScript = true;
    if (sawFinalScript && status === `CAPTURE DONE ${manifest.fixtures.length}`) captureDone = true;
    const before = Date.now();
    const whole = yield* capture(client).pipe(Effect.mapError(failure => new CaptureFailure({ problem: `${failure.operation}: ${failure.cause}` })));
    const shot = crop === undefined || sheets ? whole : cropFrame(whole, crop);
    const verdict = frameVerdict(whole);
    const stamp = "keep" in verdict && status === `CAPTURE SCRIPT ${verdict.keep.script} ${manifest.fixtures[verdict.keep.script - 1]?.name ?? ""}` ? verdict.keep : undefined;
    log.push({ ms: before - started, captureMs: Date.now() - before, stamp: "keep" in verdict ? `${verdict.keep.script}/${verdict.keep.frame}` : verdict.reject });
    const fixture = stamp === undefined ? undefined : manifest.fixtures[stamp.script - 1];
    if (stamp !== undefined && stamp.script > lastScript) { lastScript = stamp.script; idleSince = Date.now(); }
    const held = stamp === undefined || fixture === undefined ? undefined : heldCapture(fixture, stamp.frame);
    const key = held === undefined || fixture === undefined ? "" : `${fixture.name}/${held.frame}/${held.phase}`;
    if (stamp !== undefined && held !== undefined && fixture !== undefined && !saved.has(key)) {
      const file = canvas !== undefined ? `${fixture.reel?.fighter}.jpg` : join(fixture.name, held.phase === "held" ? `frame-${held.frame}.ppm` : `${held.frame}-${held.phase}.png`);
      yield* attempt("save the capture", () => {
        if (canvas === undefined) {
          mkdirSync(join(out, fixture.name), { recursive: true });
          writeFileSync(join(out, file), held.phase === "held" ? encodePpm(shot) : encodePng(shot.width, shot.height, shot.rgb));
        } else {
          const row = stamp.script - 1;
          const column = fixture.frames.indexOf(held.frame);
          putSheetFrame(canvas, row, column, whole, crop ?? fail("missing crop"));
          if (column === 3 || column === 7) putSheetFrame(canvas, row, column === 3 ? 8 : 9, whole, effectCrop ?? fail("missing effect crop"));
        }
      });
      saved.set(key, { fixture: fixture.name, frame: held.frame, phase: held.phase, file, capturedMs: before - started, width: shot.width, height: shot.height });
      if (resumable) yield* attempt("checkpoint captured frame", () => {
        const temporary = `${checkpointPath}.tmp`;
        writeFileSync(temporary, `${JSON.stringify({ version: 1, mapSha256, sourceRevision, captures: [...saved.values()] }, null, 1)}\n`);
        renameSync(temporary, checkpointPath);
      });
      idleSince = Date.now();
      console.log(`captured ${fixture.name} ${held.frame}${held.phase === "held" ? "" : ` ${held.phase}`} (${saved.size}/${wanted})`);
    }
    if ((resumable ? captureDone : lastScript >= manifest.fixtures.length) && Date.now() - idleSince > 30000) break;
  }
  const phases = (fixture: { readonly silhouette?: unknown }) => fixture.silhouette === undefined ? ["held"] as const : ["shown", "hidden"] as const;
  const missed = manifest.fixtures.flatMap(fixture => fixture.frames.flatMap(frame => phases(fixture).filter(phase => !saved.has(`${fixture.name}/${frame}/${phase}`)).map(phase => ({ fixture: fixture.name, frame, phase }))));
  if (canvas !== undefined && missed.length === 0) {
    const fighter = manifest.fixtures[0]?.reel?.fighter ?? fail("missing reel fighter");
    const bytes = yield* writeSheet(canvas, manifest.fixtures.map(row => ({ row: row.reel?.row ?? "", frames: row.frames })), join(out, `${fighter}.jpg`));
    yield* attempt("write opaque row key", () => writeFileSync(join(out, `${fighter}.rows.json`), `${JSON.stringify(Object.fromEntries(manifest.fixtures.map(row => [row.reel?.row, { slot: row.reel?.slot, facing: row.reel?.facing }])), null, 2)}\n`));
    console.log(`sheet ${fighter}: ${bytes} bytes; ${manifest.fixtures.length} rows`);
  }
  const wrongSize: string[] = [];
  for (const fixture of manifest.fixtures) {
    const silhouette = fixture.silhouette;
    if (silhouette === undefined) continue;
    const pairs = fixture.frames.map(frame => ({ matchFrame: frame, shown: saved.get(`${fixture.name}/${frame}/shown`), hidden: saved.get(`${fixture.name}/${frame}/hidden`) }));
    const sizes = [...new Set(pairs.flatMap(pair => [pair.shown, pair.hidden]).filter(row => row !== undefined).map(row => `${row.width}x${row.height}`))];
    const receipt = {
      fixture: fixture.name, map: manifest.map, build: binding.installed, slot: silhouette.slot, fighter: silhouette.fighter, move: silhouette.move,
      resolution: { width: silhouette.width, height: silhouette.height }, captured: sizes, crop: crop ?? null,
      pairs: pairs.map(pair => ({ matchFrame: pair.matchFrame, shown: pair.shown === undefined ? null : basename(pair.shown.file), hidden: pair.hidden === undefined ? null : basename(pair.hidden.file) })),
    };
    yield* attempt("write the silhouette receipt", () => {
      mkdirSync(join(out, fixture.name), { recursive: true });
      writeFileSync(join(out, fixture.name, "silhouette.json"), `${JSON.stringify(receipt, null, 1)}\n`);
    });
    if (sizes.some(size => size !== `${silhouette.width}x${silhouette.height}`)) wrongSize.push(`${fixture.name}: captured at ${sizes.join(", ")}, not the scenario's ${silhouette.width}x${silhouette.height}`);
  }
  const result = { map: manifest.map, build: binding, captured: saved.size, wanted, missed, audio, captures: [...saved.values()], log };
  const evidence = sheets ? `${manifest.fixtures[0]?.reel?.fighter}.captures.json` : "captures.json";
  yield* attempt("write capture evidence", () => writeFileSync(join(out, evidence), `${JSON.stringify(result, null, 1)}\n`));
  const unreadable = log.filter(row => row.stamp === "unreadable").length;
  const torn = log.filter(row => row.stamp === "torn").length;
  console.log(JSON.stringify({ captured: saved.size, wanted, missed: missed.length, screenCaptures: log.length, unreadable, torn, medianCaptureMs: [...log.map(row => row.captureMs)].sort((a, b) => a - b)[Math.floor(log.length / 2)] ?? 0 }));
  if (wrongSize.length > 0) return yield* new CaptureFailure({ problem: wrongSize.join("; ") });
  if (missed.length > 0) return yield* new CaptureFailure({ problem: `missed ${missed.map(row => `${row.fixture}@${row.frame}${row.phase === "held" ? "" : ` ${row.phase}`}`).join(", ")}` });
}));

const plan = (args: readonly string[]) => Effect.gen(function*() {
  const pads = positional(args).flatMap(path => statSync(path).isDirectory() ? readdirSync(path).filter(file => file.endsWith(".pad")).sort().map(file => join(path, file)) : [path]);
  if (pads.length === 0) return yield* new CaptureFailure({ problem: "usage: plan PAD|DIR..." });
  const fixtures = yield* attempt("read pad scripts", () => pads.map(path => fixtureOf(path, readFileSync(path, "utf8"))));
  const { planFixture } = yield* Effect.promise(() => import("./nativeCapturePlan"));
  let cues = 0;
  let passed = 0;
  for (const fixture of fixtures) {
    const row = yield* planFixture(fixture).pipe(Effect.mapError(failure => new CaptureFailure({ problem: failure.problem })));
    cues += row.cues;
    passed += row.passed;
  }
  console.log(`plan: ${passed}/${cues} cues shown on a capture frame, ${fixtures.length} scripts`);
  if (passed !== cues) return yield* new CaptureFailure({ problem: `${cues - passed} cues aren't shown on a capture frame` });
});

const reel = (args: readonly string[]) => Effect.gen(function*() {
  const out = option(args, "--out");
  if (out === undefined) return yield* new CaptureFailure({ problem: "usage: reel --out DIR [--fighter SLUG] [--hold-ticks N]" });
  const { reelFixtures } = yield* Effect.promise(() => import("./nativeCapturePlan"));
  const batches = yield* attempt("enumerate reel", () => reelFixtures(option(args, "--fighter"), Number(option(args, "--hold-ticks") ?? "6")));
  yield* attempt("write reel scripts", () => {
    for (const fixtures of batches) {
      const fighter = fixtures[0]?.reel?.fighter ?? fail("empty fighter reel");
      const directory = join(out, fighter);
      mkdirSync(directory, { recursive: true });
      for (const fixture of fixtures) writeFileSync(join(directory, `${fixture.reel?.row}.pad`), fixture.script);
    }
    writeFileSync(join(out, "reel-plan.json"), `${JSON.stringify(batches, null, 2)}\n`);
  });
  console.log(`reel: ${batches.length} fighters, ${batches.flat().length} move/facing rows, ${batches.flat().reduce((total, row) => total + row.frames.length, 0)} frames; ${out}`);
});


export function rmse(a: Frame, b: Frame): number {
  if (a.width !== b.width || a.height !== b.height) return 1;
  const skip = Math.ceil(STAMP_CELL * (a.height / 0.6)) + 2;
  let total = 0;
  let count = 0;
  for (let y = skip; y < a.height - skip; y += 2) for (let x = 0; x < a.width; x += 2) {
    const offset = (y * a.width + x) * 3;
    for (let channel = 0; channel < 3; channel++) {
      const difference = ((a.rgb[offset + channel] ?? 0) - (b.rgb[offset + channel] ?? 0)) / 255;
      total += difference * difference;
      count++;
    }
  }
  return Math.sqrt(total / count);
}

const compare = (args: readonly string[]) => Effect.gen(function*() {
  const [directory, first, second] = positional(args);
  if (directory === undefined || first === undefined || second === undefined) return yield* new CaptureFailure({ problem: "usage: compare DIR FIXTURE OTHER" });
  const frames = (fixture: string) => readdirSync(join(directory, fixture)).map(file => /^frame-(\d+)\.ppm$/.exec(file)?.[1]).filter((value): value is string => value !== undefined).map(Number).sort((a, b) => a - b);
  const load = (fixture: string, frame: number) => decodePpm(readFileSync(join(directory, fixture, `frame-${frame}.ppm`))) ?? fail(`${fixture} frame ${frame} isn't a PPM image`);
  const rows = yield* attempt("compare captures", () => {
    const shared = frames(first).filter(frame => frames(second).includes(frame));
    const twin = shared.map(frame => ({ frame, rmse: rmse(load(first, frame), load(second, frame)) }));
    const spread = [first, second].map(fixture => {
      const own = frames(fixture);
      return { fixture, from: own[0], to: own.at(-1), rmse: rmse(load(fixture, own[0] ?? 0), load(fixture, own.at(-1) ?? 0)) };
    });
    return { twin, spread };
  });
  for (const row of rows.twin) console.log(`frame ${row.frame}: ${first} vs ${second} rmse ${row.rmse.toFixed(4)}`);
  for (const row of rows.spread) console.log(`${row.fixture}: frame ${row.from} vs ${row.to} rmse ${row.rmse.toFixed(4)}`);
});

export function nativeCapture(argv: readonly string[]) {
  const [verb, ...args] = argv;
  const normalize = <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, CaptureFailure, R> => effect.pipe(Effect.mapError(failure => failure instanceof CaptureFailure ? failure : new CaptureFailure({ problem: String(failure) })));
  const program = verb === "reel" ? normalize(reel(args)) : verb === "build" ? normalize(build(args)) : verb === "chunks" ? normalize(nativeCaptureChunks(args, build, fixtureOf)) : verb === "plan" ? normalize(plan(args)) : verb === "run" ? normalize(runCaptures(args)) : verb === "batch" ? normalize(Effect.promise(() => import("./nativeCaptureBatch")).pipe(Effect.flatMap(module => module.nativeCaptureBatch(args)))) : verb === "compare" ? normalize(compare(args)) : verb === "build-check" ? normalize(buildCheck(args)) : Effect.fail(new CaptureFailure({ problem: "usage: nativeCapture.ts reel|build|chunks|plan|run|batch|compare|build-check ..." }));
  return program.pipe(
    Effect.provide(Layer.merge(BunServices.layer, platformLayer())),
  );
}
if (import.meta.main) {
  BunRuntime.runMain(nativeCapture(Bun.argv.slice(2)));
}
