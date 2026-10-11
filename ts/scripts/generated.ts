// Files generated from tracked sources instead of committed (#401). Each is
// rebuilt when a hash of its generator and every module it imports (local or
// pinned Wisp) changes; the hash, the outputs and each input's size and mtime
// are stamped under build/generated/, so a warm run only stats the inputs and
// loads no generator. `bun install`, `bun run check`, `bun run test`,
// `bun scripts/lua-tests.ts` and `wisp map build` run this;
// `bun scripts/generated.ts` runs it by hand.
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const tsDirectory = resolve(import.meta.dir, "..");
const STAMPS = join(tsDirectory, "build/generated");
const WISP = join(tsDirectory, "node_modules/wisp");

/** One generator: the module whose import graph is its input, and the files it writes, by absolute path. Generators load only when they run. */
interface Generated { readonly name: string; readonly generator: string; readonly produce: () => Readonly<Record<string, string>> }

const uiFrames = (): Record<string, string> => {
  const { generateFrames } = require("wisp/scripts/wisp/frames") as typeof import("wisp/scripts/wisp/frames");
  const { UI_FRAMES, UI_FRAMES_IMPORTS } = require("./wisp/uiFrames") as typeof import("./wisp/uiFrames");
  return Object.fromEntries(UI_FRAMES.flatMap(({ definition, bindings }) => {
    const { fdf, toc, bindings: source } = generateFrames(definition);
    const imports = join(tsDirectory, UI_FRAMES_IMPORTS);
    return [[join(imports, `${definition.name}.fdf`), fdf], [join(imports, `${definition.name}.toc`), toc], [join(tsDirectory, bindings), source]];
  }));
};

export const GENERATED: readonly Generated[] = [
  { name: "move-list", generator: join(import.meta.dir, "moveList.ts"), produce: () => {
    const { MOVE_LIST_PATH, moveListMarkdown } = require("./moveList") as typeof import("./moveList");
    return { [MOVE_LIST_PATH]: moveListMarkdown() };
  } },
  { name: "sound-table", generator: join(import.meta.dir, "soundTable.ts"), produce: () => {
    const { SOUND_TABLE_PATH, soundTableMarkdown } = require("./soundTable") as typeof import("./soundTable");
    return { [SOUND_TABLE_PATH]: soundTableMarkdown() };
  } },
  { name: "stage-silhouettes", generator: join(import.meta.dir, "stageThumbnailSpec.ts"), produce: () => {
    const { SILHOUETTE_PATH, silhouetteSource } = require("./stageThumbnailSpec") as typeof import("./stageThumbnailSpec");
    return { [SILHOUETTE_PATH]: silhouetteSource() };
  } },
  { name: "ui-frames", generator: join(import.meta.dir, "wisp/uiFrames.ts"), produce: uiFrames },
];

const transpiler = new Bun.Transpiler({ loader: "ts" });

/** A relative import, or one into the pinned Wisp package, resolved to its file; other packages are outside the hash. */
function resolveLocal(from: string, specifier: string): string | undefined {
  const base = specifier.startsWith(".") ? resolve(dirname(from), specifier) : specifier.startsWith("wisp/") ? join(WISP, specifier.slice("wisp/".length)) : undefined;
  if (base === undefined) return undefined;
  return [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts")].find((path) => statSync(path, { throwIfNoEntry: false })?.isFile() === true);
}

/** `entry` and every module it reaches through local or Wisp imports, sorted. */
export function sourceGraph(entry: string): string[] {
  const seen = new Set<string>();
  const queue = [entry];
  for (let file = queue.pop(); file !== undefined; file = queue.pop()) {
    if (seen.has(file)) continue;
    seen.add(file);
    for (const { path } of transpiler.scanImports(readFileSync(file, "utf8"))) {
      const local = resolveLocal(file, path);
      if (local !== undefined && !seen.has(local)) queue.push(local);
    }
  }
  return [...seen].sort();
}

/** A hash of `files` by path and content. */
function contentHash(files: readonly string[]): string {
  const hash = new Bun.CryptoHasher("sha256");
  for (const file of files) hash.update(`${relative(tsDirectory, file)}\0`).update(readFileSync(file)).update("\n");
  return hash.digest("hex");
}

/** A hash of `entry` and every module it reaches through its imports, by path and content. */
export const sourceHash = (entry: string): string => contentHash(sourceGraph(entry));

interface Stamp { readonly hash: string; readonly outputs: readonly string[]; readonly inputs: Readonly<Record<string, readonly [number, number]>> }

const fileStat = (file: string): readonly [number, number] | undefined => {
  const stat = statSync(file, { throwIfNoEntry: false });
  return stat === undefined ? undefined : [stat.size, stat.mtimeMs];
};

const readStamp = (path: string): Stamp | undefined => existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) as Stamp : undefined;

/** Every input still has the size and mtime it had when stamped, so nothing it imports can have changed. */
const unchanged = (stamp: Stamp): boolean => Object.entries(stamp.inputs).every(([file, recorded]) => {
  const now = fileStat(join(tsDirectory, file));
  return now !== undefined && now[0] === recorded[0] && now[1] === recorded[1];
});

/** Regenerates every generated file whose inputs changed or whose output is missing; returns the names it wrote. */
export function ensureGenerated(): string[] {
  const written: string[] = [];
  for (const { name, generator, produce } of GENERATED) {
    const stampPath = join(STAMPS, `${name}.json`);
    const stamp = readStamp(stampPath);
    const present = stamp !== undefined && stamp.outputs.every((output) => existsSync(join(tsDirectory, output)));
    if (present && unchanged(stamp)) continue;
    const graph = sourceGraph(generator);
    const hash = contentHash(graph);
    let outputs = stamp?.outputs ?? [];
    if (!present || stamp.hash !== hash) {
      const produced = produce();
      for (const [output, text] of Object.entries(produced)) {
        mkdirSync(dirname(output), { recursive: true });
        writeFileSync(output, text);
      }
      outputs = Object.keys(produced).map((output) => relative(tsDirectory, output));
      written.push(name);
    }
    const inputs = Object.fromEntries(graph.flatMap((file) => {
      const stat = fileStat(file);
      return stat === undefined ? [] : [[relative(tsDirectory, file), stat]];
    }));
    mkdirSync(STAMPS, { recursive: true });
    writeFileSync(stampPath, `${JSON.stringify({ hash, outputs, inputs } satisfies Stamp)}\n`);
  }
  return written;
}

if (import.meta.main) {
  const written = ensureGenerated();
  console.log(written.length === 0 ? "generated files are current" : `generated ${written.join(", ")}`);
}
