import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { Effect, Schema } from "effect";
import type { CommandFailure } from "wisp/scripts/wisp/command";
import { admit } from "./heavyCapacity";

const tsDirectory = resolve(import.meta.dir, "..");
const STAMPS = join(tsDirectory, "build/generated");

export interface Generated {
  readonly name: string;
  readonly generator: string;
  readonly output: string;
  readonly produce: Effect.Effect<string, CommandFailure>;
  readonly inputs?: readonly string[];
  readonly inputHash?: Effect.Effect<string, CommandFailure>;
  readonly available?: () => boolean;
}

const scoreInputs = [join(tsDirectory, "../build-inputs/original-clips-static-lights"), join(tsDirectory, "../tools/move-data/anim-score/judge.jsonl"),
  join(tsDirectory, "../references/melee-frame-data/records.jsonl"), join(tsDirectory, "wisp.lock"), join(tsDirectory, "package.json"), join(tsDirectory, "../typescript-toolchain.lock")];

const scoreAvailable = () => {
  const pin = join(tsDirectory, "../build-inputs/original-clips-static-lights");
  return existsSync(pin) && existsSync(join(homedir(), ".local/share/smashcraft-build-inputs/store/original-clips-static-lights", readFileSync(pin, "utf8").trim()));
};

export const GENERATED: readonly Generated[] = [
  { name: "move-list", generator: join(import.meta.dir, "moveList.ts"), output: join(tsDirectory, "../docs/move-list.md"),
    produce: Effect.promise(() => import("./moveList")).pipe(Effect.map((module) => module.moveListMarkdown())) },
  ...(["classic", "definitive"] as const).map((look): Generated => ({
    name: `anim-score-${look}`, generator: join(import.meta.dir, "wisp/commands/anim.ts"), output: join(tsDirectory, `../build/anim-score/${look}.tsv`),
    inputs: scoreInputs, available: scoreAvailable,
    produce: Effect.promise(() => import("./wisp/commands/anim")).pipe(Effect.flatMap((module) => module.scoreTable(look))),
  })),
];

class GenerationFailure extends Schema.TaggedError<GenerationFailure>()("GenerationFailure", { operation: Schema.String, cause: Schema.String }) {
  override get message(): string { return `${this.operation}: ${this.cause}`; }
}

const transpiler = new Bun.Transpiler({ loader: "ts" });

function resolveLocal(from: string, specifier: string): string | undefined {
  if (!specifier.startsWith(".")) return undefined;
  const base = resolve(dirname(from), specifier);
  return [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts")].find((path) => statSync(path, { throwIfNoEntry: false })?.isFile() === true);
}

/** A hash of `entry` and every local module it reaches through its imports, by path and content. */
export function sourceHash(entry: string, sources = new Map<string, { readonly content: Buffer; readonly imports: readonly string[] }>()): string {
  const seen = new Set<string>();
  const queue = [entry];
  for (let file = queue.pop(); file !== undefined; file = queue.pop()) {
    if (seen.has(file)) continue;
    seen.add(file);
    let source = sources.get(file);
    if (source === undefined) {
      const content = readFileSync(file);
      const imports = transpiler.scanImports(content).flatMap(({ path }) => {
        const local = resolveLocal(file, path);
        return local === undefined ? [] : [local];
      });
      source = { content, imports };
      sources.set(file, source);
    }
    for (const local of source.imports) if (!seen.has(local)) queue.push(local);
  }
  const hash = new Bun.CryptoHasher("sha256");
  for (const file of [...seen].sort()) hash.update(`${relative(tsDirectory, file)}\0`).update(sources.get(file)?.content ?? readFileSync(file)).update("\n");
  return hash.digest("hex");
}

export const ensureGenerated = (entries: readonly Generated[] = GENERATED) => Effect.gen(function*() {
  const written: string[] = [];
  const sources = new Map<string, string>();
  const files = new Map<string, { readonly content: Buffer; readonly imports: readonly string[] }>();
  for (const { name, generator, output, produce, inputs = [], inputHash, available } of entries) {
    if (available !== undefined && !available()) continue;
    const stamp = join(STAMPS, `${name}.sha256`);
    const hash = yield* Effect.try({
      try: () => {
        let source = sources.get(generator);
        if (source === undefined) { source = sourceHash(generator, files); sources.set(generator, source); }
        const digest = new Bun.CryptoHasher("sha256").update(source);
        for (const path of inputs) digest.update(`${relative(tsDirectory, path)}\0`).update(existsSync(path) ? readFileSync(path) : "missing").update("\n");
        return digest;
      },
      catch: (cause) => new GenerationFailure({ operation: `hash ${name}`, cause: String(cause) }),
    });
    if (inputHash !== undefined) hash.update(yield* inputHash);
    const key = hash.digest("hex");
    if (existsSync(output) && existsSync(stamp) && readFileSync(stamp, "utf8").trim() === key) continue;
    const content = yield* produce;
    yield* Effect.try({
      try: () => {
        mkdirSync(dirname(output), { recursive: true });
        writeFileSync(output, content);
        mkdirSync(STAMPS, { recursive: true });
        writeFileSync(stamp, `${key}\n`);
      },
      catch: (cause) => new GenerationFailure({ operation: `write ${name}`, cause: String(cause) }),
    });
    written.push(name);
  }
  return written;
});

if (import.meta.main) {
  const { BunRuntime } = await import("@effect/platform-bun");
  BunRuntime.runMain(Effect.gen(function*() {
    const admitted = yield* admit("moderate", "smashcraft:generated", 900);
    if (admitted !== undefined) { process.exitCode = admitted; return; }
    const written = yield* ensureGenerated();
    console.log(written.length === 0 ? "generated files are current" : `generated ${written.join(", ")}`);
  }));
}
