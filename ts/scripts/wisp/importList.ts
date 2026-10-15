import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export function importList(path: string): string[] {
  const lists = statSync(path).isDirectory() ? readdirSync(path).filter((file) => file.endsWith(".txt")).sort().map((file) => join(path, file)) : [path];
  return [...new Set(lists.flatMap((list) => readFileSync(list, "utf8").split(/\r?\n/).filter((line) => line.length > 0)))];
}
