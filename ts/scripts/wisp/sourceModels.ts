// Every stock model path the game source names, so the player-view scene lists what the map can draw, not only what a producer table exposes.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const SOURCE_ROOT = join(import.meta.dir, "../../src/game");
const PATH_LITERAL = /"([A-Za-z0-9_ ]+(?:\\\\[A-Za-z0-9_ .-]+)+\.(?:mdx|mdl))"/g;
const IMPORTED_PREFIXES = ["war3mapimported\\", "_hd.w3mod\\"];

export function sourceNamedModels(root = SOURCE_ROOT): readonly string[] {
  const found = new Set<string>();
  for (const entry of readdirSync(root, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".ts")) continue;
    const text = readFileSync(join(entry.parentPath, entry.name), "utf8");
    for (const match of text.matchAll(PATH_LITERAL)) {
      const model = (match[1] as string).replaceAll("\\\\", "\\");
      if (!IMPORTED_PREFIXES.some((prefix) => model.toLowerCase().startsWith(prefix))) found.add(model);
    }
  }
  return [...found].sort();
}
