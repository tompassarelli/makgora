import { createHash } from "node:crypto";
import { realpathSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { BunRuntime } from "@effect/platform-bun";
import { Console, Effect, Schema } from "effect";
import { packSample, type PackReference, type PackSample } from "./wisp/classicScreenPack";

const Box = Schema.Struct({ x: Schema.Finite, y: Schema.Finite, width: Schema.Finite, height: Schema.Finite });
const Spec = Schema.Struct({
  excluded: Schema.Array(Box),
  crop: Box,
  regionMargin: Schema.Finite,
  bodyMargin: Schema.Finite,
  defender: Schema.optionalKey(Box),
  samples: Schema.Array(Schema.Struct({ move: Schema.String, role: Schema.Literals(["positive", "negative", "candidate"]), version: Schema.String, source: Schema.String, fixture: Schema.String, manifest: Schema.String, runs: Schema.Tuple([Schema.String, Schema.String]), regionMargin: Schema.optionalKey(Schema.Finite) })),
});
const Manifest = Schema.Struct({ map: Schema.String, fixtures: Schema.Array(Schema.Struct({ name: Schema.String, frames: Schema.Array(Schema.Finite) })) });
const Run = Schema.Struct({ map: Schema.String, captures: Schema.Array(Schema.Struct({ fixture: Schema.String, frame: Schema.Finite, phase: Schema.String, file: Schema.String })), screen: Schema.optionalKey(Schema.Array(Schema.String)) });

export class PackFailure extends Schema.TaggedError<PackFailure, { readonly brand: unique symbol }>()("PackFailure", { problem: Schema.String }) {
  override get message(): string { return this.problem; }
}

const failure = (label: string, cause: unknown) => new PackFailure({ problem: `${label}: ${String(cause)}` });
const readJson = <S extends Schema.Top & { readonly DecodingServices: never }>(path: string, schema: S) => Effect.tryPromise({ try: () => Bun.file(path).text(), catch: cause => failure(path, cause) }).pipe(
  Effect.flatMap(Schema.decodeUnknownEffect(Schema.fromJsonString(schema))), Effect.mapError(cause => failure(path, cause)));
const real = (root: string, path: string) => Effect.try({ try: () => realpathSync(isAbsolute(path) ? path : join(root, path)), catch: cause => failure(path, cause) });

export const buildScreenPack = Effect.fnUntraced(function*(specPath: string, packPath: string) {
  const root = dirname(specPath), spec = yield* readJson(specPath, Spec), samples: PackSample[] = [];
  const written = (path: string) => relative(dirname(resolve(packPath)), resolve(root, path));
  const rebased = (reference: PackReference): PackReference => ({ ...reference, receipt: written(reference.receipt), file: written(reference.file) });
  const hashes = new Map<string, string>();
  for (const request of spec.samples) {
    const manifestPath = join(root, request.manifest);
    const manifest = yield* readJson(manifestPath, Manifest);
    const manifestMap = yield* real(dirname(manifestPath), manifest.map);
    const mapSha256 = hashes.get(manifestMap) ?? createHash("sha256").update(yield* Effect.tryPromise({ try: () => Bun.file(manifestMap).bytes(), catch: cause => failure(manifestMap, cause) })).digest("hex");
    hashes.set(manifestMap, mapSha256);
    const packMap = join(dirname(request.manifest), relative(yield* real(root, dirname(request.manifest)), manifestMap));
    const run = (path: string) => Effect.gen(function*() {
      const recorded = yield* readJson(join(root, path), Run);
      return { ...recorded, path, map: yield* real(dirname(join(root, path)), recorded.map) };
    });
    const runs = [yield* run(request.runs[0]), yield* run(request.runs[1])] as const;
    const sample = yield* Effect.try({ try: () => packSample({ ...request, excluded: spec.excluded, crop: spec.crop, regionMargin: request.regionMargin ?? spec.regionMargin, bodyMargin: spec.bodyMargin, defender: spec.defender }, { ...manifest, path: request.manifest, map: manifestMap }, packMap, mapSha256, runs), catch: cause => failure(request.move, cause) });
    samples.push({ ...sample, manifest: written(sample.manifest), map: written(sample.map), frames: sample.frames.map(frame => ({ ...frame, shown: rebased(frame.shown), off: rebased(frame.off), repeatedOff: rebased(frame.repeatedOff) })) });
  }
  return { samples };
});

if (import.meta.main) BunRuntime.runMain(Effect.gen(function*() {
  const [flag, spec, outFlag, out, ...rest] = process.argv.slice(2);
  if (flag !== "--spec" || spec === undefined || outFlag !== "--out" || out === undefined || rest.length > 0) return yield* new PackFailure({ problem: "usage: bun scripts/classicScreenPack.ts --spec SPEC.json --out PACK.json" });
  const pack = yield* buildScreenPack(spec, out);
  yield* Effect.tryPromise({ try: () => Bun.write(out, `${JSON.stringify(pack, null, 1)}\n`), catch: cause => failure(out, cause) });
  yield* Console.log(`${out}: ${pack.samples.length} samples, ${pack.samples.reduce((total, sample) => total + sample.frames.length, 0)} frames`);
}));
