import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

export interface Producer { readonly output: string; readonly render: () => string }

export const tsRoot = resolve(import.meta.dir, "..");

/** Brings each producer's output up to date, or with `check` only lists the drifted ones; files in `owned` directories that no producer writes are drift too. */
export function syncGenerated(producers: readonly Producer[], owned: readonly string[], check: boolean): string[] {
  const drifted: string[] = [];
  const shown = (path: string) => relative(resolve(tsRoot, ".."), path);
  for (const producer of producers) {
    const path = resolve(tsRoot, producer.output);
    const text = producer.render();
    if (existsSync(path) && readFileSync(path, "utf8") === text) continue;
    drifted.push(shown(path));
    if (check) continue;
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text);
  }
  const written = new Set(producers.map(({ output }) => resolve(tsRoot, output)));
  for (const directory of owned.map((path) => resolve(tsRoot, path)).filter(existsSync)) {
    for (const file of readdirSync(directory).map((name) => join(directory, name)).filter((path) => !written.has(path))) {
      drifted.push(shown(file));
      if (!check) rmSync(file);
    }
  }
  return drifted;
}
