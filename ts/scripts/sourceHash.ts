import { readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const tsDirectory = resolve(import.meta.dir, "..");

const transpiler = new Bun.Transpiler({ loader: "ts" });

function resolveLocal(from: string, specifier: string): string | undefined {
  if (!specifier.startsWith(".")) return undefined;
  const base = resolve(dirname(from), specifier);
  return [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts")].find((path) => statSync(path, { throwIfNoEntry: false })?.isFile() === true);
}

/** A hash of `entry` and every local module it reaches through its imports, by path and content. */
export function sourceHash(entry: string): string {
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
  const hash = new Bun.CryptoHasher("sha256");
  for (const file of [...seen].sort()) hash.update(`${relative(tsDirectory, file)}\0`).update(readFileSync(file)).update("\n");
  return hash.digest("hex");
}
