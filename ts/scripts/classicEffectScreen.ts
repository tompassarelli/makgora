import { createHash } from "node:crypto";
import { dirname, isAbsolute, join } from "node:path";
import { BunRuntime } from "@effect/platform-bun";
import { Console, Effect, Schema } from "effect";
import { decodePpm } from "wisp/scripts/wisp/frameProbe";
import { decodePng } from "wisp/scripts/wisp/fidelity/image";
import { frameStamp } from "./nativeCaptureVerdict";
import { effectSourceDigest } from "./wisp/effectVisibility";
import { measureFootprint, screenReport, screenAcceptanceProblem, type ScreenSample } from "./wisp/classicEffectScreen";

const Box = Schema.Struct({ x: Schema.Finite, y: Schema.Finite, width: Schema.Finite, height: Schema.Finite });
const CaptureReference = Schema.Struct({ receipt: Schema.String, fixture: Schema.String, phase: Schema.Literals(["held", "shown", "hidden"]), file: Schema.String });
const CaptureFrame = Schema.Struct({ frame: Schema.Finite, shown: CaptureReference, off: CaptureReference, repeatedOff: CaptureReference, region: Box, body: Box, excluded: Schema.Array(Box) });
const CaptureSample = Schema.Struct({ move: Schema.String, role: Schema.Literals(["positive", "negative", "candidate"]), engine: Schema.String, camera: Schema.String, stage: Schema.String, source: Schema.String, version: Schema.String, manifest: Schema.String, map: Schema.String, mapSha256: Schema.String, first: Schema.Finite, last: Schema.Finite, frames: Schema.Array(CaptureFrame) });
const CapturePack = Schema.Struct({ samples: Schema.Array(CaptureSample) });
const Receipt = Schema.Struct({ map: Schema.String, build: Schema.Struct({ installed: Schema.String, equal: Schema.Boolean, offline: Schema.optionalKey(Schema.Boolean) }), missed: Schema.Array(Schema.Unknown), captures: Schema.Array(Schema.Struct({ fixture: Schema.String, frame: Schema.Finite, phase: Schema.String, file: Schema.String, width: Schema.Finite, height: Schema.Finite })) });
const Manifest = Schema.Struct({ map: Schema.String, fixtures: Schema.Array(Schema.Struct({ name: Schema.String, frames: Schema.Array(Schema.Finite) })) });

export class ScreenEvidenceFailure extends Schema.TaggedError<ScreenEvidenceFailure>()("ScreenEvidenceFailure", { problem: Schema.String }) {
  override get message(): string { return this.problem; }
}

const failure = (label: string, cause: unknown) => new ScreenEvidenceFailure({ problem: `${label}: ${String(cause)}` });
const readBytes = (path: string) => Effect.tryPromise({ try: () => Bun.file(path).bytes(), catch: cause => failure(path, cause) });
const readText = (path: string) => Effect.tryPromise({ try: () => Bun.file(path).text(), catch: cause => failure(path, cause) });
const readJson = <S extends Schema.Top & { readonly DecodingServices: never }>(path: string, schema: S) => readText(path).pipe(Effect.flatMap(Schema.decodeUnknownEffect(Schema.fromJsonString(schema))), Effect.mapError(cause => failure(path, cause)));
const resolve = (root: string, path: string) => isAbsolute(path) ? path : join(root, path);
const sha256 = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");

export const readScreenCaptures = Effect.fnUntraced(function*(path: string) {
  const root = dirname(path), hashes = new Map<string, string>(), samples: ScreenSample[] = [];
  const pack = yield* readJson(path, CapturePack);
  hashes.set(path, sha256(yield* readText(path)));
  for (const sample of pack.samples) {
    let width = 0, height = 0;
    const frames: ScreenSample["frames"][number][] = [];
    const measured = yield* Effect.gen(function*() {
      if (sample.engine !== "native-classic" || sample.camera !== "normal-match" || sample.stage !== "sky-deck") return yield* new ScreenEvidenceFailure({ problem: "requires native Classic captures on Sky Deck (stage 0) at the normal match camera" });
      const map = resolve(root, sample.map), mapBytes = yield* readBytes(map), manifestPath = resolve(root, sample.manifest);
      const mapHash = sha256(mapBytes);
      hashes.set(map, mapHash);
      if (mapHash !== sample.mapSha256) return yield* new ScreenEvidenceFailure({ problem: "map hash differs from captured candidate" });
      const manifest = yield* readJson(manifestPath, Manifest);
      hashes.set(manifestPath, sha256(yield* readText(manifestPath)));
      if (resolve(dirname(manifestPath), manifest.map) !== map) return yield* new ScreenEvidenceFailure({ problem: "capture manifest belongs to a different map" });
      for (const frame of sample.frames) {
        if (new Set([frame.shown.file, frame.off.file, frame.repeatedOff.file].map(file => resolve(root, file))).size !== 3) return yield* new ScreenEvidenceFailure({ problem: "cue-on and the two independent cue-off controls must be distinct captures" });
        const images = [];
        for (const reference of [frame.shown, frame.off, frame.repeatedOff]) {
          const receiptPath = resolve(root, reference.receipt), receipt = yield* readJson(receiptPath, Receipt);
          hashes.set(receiptPath, sha256(yield* readText(receiptPath)));
          if (receipt.build.installed !== "3.0.0.24268" || !receipt.build.equal || receipt.build.offline !== true || receipt.missed.length > 0 || resolve(dirname(receiptPath), receipt.map) !== map) return yield* new ScreenEvidenceFailure({ problem: "native receipt has wrong build/map or missed captures" });
          const fixtureIndex = manifest.fixtures.findIndex(row => row.name === reference.fixture);
          const fixture = manifest.fixtures[fixtureIndex];
          const saved = receipt.captures.find(row => row.fixture === reference.fixture && row.frame === frame.frame && row.phase === reference.phase);
          if (fixture === undefined || !fixture.frames.includes(frame.frame) || saved === undefined || resolve(dirname(receiptPath), saved.file) !== resolve(root, reference.file)) return yield* new ScreenEvidenceFailure({ problem: "image is absent from its native manifest/receipt" });
          const imagePath = resolve(root, reference.file), bytes = yield* readBytes(imagePath);
          hashes.set(imagePath, sha256(bytes));
          const image = yield* Effect.try({ try: () => imagePath.endsWith(".png") ? decodePng(bytes) : decodePpm(bytes), catch: cause => failure(imagePath, cause) });
          if (image === undefined) return yield* new ScreenEvidenceFailure({ problem: "capture image is not valid PNG or PPM" });
          const stamp = frameStamp(image);
          if (stamp?.script !== fixtureIndex + 1 || stamp.frame !== frame.frame || image.width !== saved.width || image.height !== saved.height) return yield* new ScreenEvidenceFailure({ problem: "pixels have no matching native held-frame stamp or resolution" });
          if (width > 0 && (width !== image.width || height !== image.height)) return yield* new ScreenEvidenceFailure({ problem: "sample camera resolution changed" });
          width = image.width; height = image.height;
          images.push(image);
        }
        const [shown, off, repeatedOff] = images;
        if (shown === undefined || off === undefined || repeatedOff === undefined) return yield* new ScreenEvidenceFailure({ problem: "same-frame cue-off controls missing" });
        const footprint = measureFootprint(shown, off, repeatedOff, frame.region, [frame.body, ...frame.excluded]);
        if (footprint === undefined) return yield* new ScreenEvidenceFailure({ problem: "invalid effect/body/HUD regions or frame pixels" });
        frames.push({ frame: frame.frame, ...footprint });
      }
      return undefined;
    }).pipe(Effect.catchTag("ScreenEvidenceFailure", error => Effect.succeed(error.problem)));
    samples.push({ move: sample.move, role: sample.role, source: sample.source, version: sample.version, width, height, first: sample.first, last: sample.last, frames, problem: measured });
  }
  return screenReport(samples, sha256(JSON.stringify([...hashes].sort(([a], [b]) => a.localeCompare(b)))), effectSourceDigest());
});

if (import.meta.main) BunRuntime.runMain(Effect.gen(function*() {
  const args = process.argv.slice(2), index = args.indexOf("--captures"), path = index >= 0 ? args[index + 1] : undefined;
  const outputIndex = args.indexOf("--out"), output = outputIndex >= 0 ? args[outputIndex + 1] : undefined;
  if (args.some((arg, position) => !["--captures", "--out", "--report"].includes(arg) && args[position - 1] !== "--captures" && args[position - 1] !== "--out") || index >= 0 && path === undefined || outputIndex >= 0 && output === undefined) return yield* new ScreenEvidenceFailure({ problem: "usage: bun scripts/classicEffectScreen.ts [--captures PACK.json] [--out REPORT.json] [--report]" });
  const report = path === undefined ? screenReport([], sha256("native captures missing")) : yield* readScreenCaptures(path);
  if (output !== undefined) yield* Effect.tryPromise({ try: () => Bun.write(output, `${JSON.stringify(report, null, 2)}\n`), catch: cause => failure(output, cause) });
  for (const row of report.rows) yield* Console.log(`${row.status}\t${row.move}\t${row.reason}`);
  yield* Console.error(`native Classic screen evidence: ${report.rows.filter(row => row.status === "visible").length}/${report.rows.length} visible; calibration ${report.calibration === undefined ? "unproven" : `${report.calibration.pixels}px for ${report.calibration.frames} frames`}`);
  const problem = screenAcceptanceProblem(report);
  if (problem !== undefined && !args.includes("--report")) return yield* new ScreenEvidenceFailure({ problem });
}));
