import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { ChildProcess } from "effect/process";
import { Effect, Schema } from "effect";
import { runProcess } from "./hostProcess";

class CaptureChunkFailure extends Schema.TaggedError<CaptureChunkFailure, { readonly brand: unique symbol }>()("CaptureChunkFailure", { problem: Schema.String }) {
  override get message(): string { return this.problem; }
}

const option = (args: readonly string[], name: string) => {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
};

const positional = (args: readonly string[]) => args.filter((value, index) => !value.startsWith("--") && !(args[index - 1]?.startsWith("--") === true && args[index - 1] === "--out"));

export const nativeCaptureChunks = <A, E, R>(args: readonly string[], build: (args: readonly string[]) => Effect.Effect<A, E, R>, fixtureOf: (path: string, script: string) => { readonly name: string; readonly frames: readonly number[] }) => Effect.gen(function*() {
  const out = option(args, "--out");
  const pads = positional(args).flatMap(path => statSync(path).isDirectory() ? readdirSync(path).filter(file => file.endsWith(".pad")).sort().map(file => join(path, file)) : [path]);
  if (out === undefined || pads.length === 0) return yield* new CaptureChunkFailure({ problem: "usage: chunks --out DIR PAD|DIR..." });
  yield* Effect.try({ try: () => mkdirSync(out, { recursive: true }), catch: cause => new CaptureChunkFailure({ problem: `create row map folder: ${String(cause)}` }) });
  const sourceRevision = yield* runProcess(ChildProcess.make("git", ["rev-parse", "HEAD"], { cwd: join(import.meta.dir, "..") })).pipe(Effect.mapError(failure => new CaptureChunkFailure({ problem: failure.message })));
  const rows: { name: string; map: string; manifest: string; mapSha256: string; frames: readonly number[] }[] = [];
  for (const pad of pads) {
    const fixture = yield* Effect.try({ try: () => fixtureOf(pad, readFileSync(pad, "utf8")), catch: cause => new CaptureChunkFailure({ problem: `read ${pad}: ${String(cause)}` }) });
    const map = join(out, `${fixture.name}.w3x`);
    yield* build(["--out", map, "--name", `Smashcraft native capture ${fixture.name}`, pad]);
    const manifest = `${map.replace(/\.w3x$/, "")}.captures.json`;
    const mapSha256 = yield* Effect.try({ try: () => createHash("sha256").update(readFileSync(map)).digest("hex"), catch: cause => new CaptureChunkFailure({ problem: `hash ${map}: ${String(cause)}` }) });
    rows.push({ name: fixture.name, map, manifest, mapSha256, frames: fixture.frames });
  }
  const plan = join(out, "capture-batch.json");
  yield* Effect.try({ try: () => {
    const temporary = `${plan}.tmp`;
    writeFileSync(temporary, `${JSON.stringify({ version: 1, sourceRevision, rows }, null, 1)}\n`);
    renameSync(temporary, plan);
  }, catch: cause => new CaptureChunkFailure({ problem: `write ${basename(plan)}: ${String(cause)}` }) });
  console.log(`chunks: ${rows.length} row maps, ${rows.reduce((total, row) => total + row.frames.length, 0)} capture frames; ${plan}`);
});
