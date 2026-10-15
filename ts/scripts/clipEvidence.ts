import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const CLIP_PROVENANCE = "original-clips-evidence.json";
export const CLIP_RECORDS = "original-clips-evidence";

export const clipRecordPath = (pool: string, fighter: string) => join(pool, CLIP_RECORDS, `${fighter}.json`);

export function readClipRecords(pool: string) {
  const directory = join(pool, CLIP_RECORDS);
  if (!existsSync(directory)) return [];
  return readdirSync(directory).filter((file) => file.endsWith(".json")).sort().map((file) => JSON.parse(readFileSync(join(directory, file), "utf8")));
}

export const clipPoolFiles = (pool: string): string[] => [...new Set(readClipRecords(pool).flatMap((record: { readonly clips: readonly { readonly filename: string }[]; readonly light: { readonly filename: string } | null }) =>
  [...record.clips.map(({ filename }) => filename), ...(record.light === null ? [] : [record.light.filename])]))];

export function writeClipRecord(pool: string, record: { readonly fighter: string }): void {
  mkdirSync(join(pool, CLIP_RECORDS), { recursive: true });
  writeFileSync(clipRecordPath(pool, record.fighter), `${JSON.stringify(record, null, 2)}\n`);
}

export function keepClipRecords(pool: string, fighters: ReadonlySet<string>): void {
  const directory = join(pool, CLIP_RECORDS);
  if (!existsSync(directory)) return;
  for (const file of readdirSync(directory)) if (file.endsWith(".json") && !fighters.has(file.slice(0, -".json".length))) rmSync(join(directory, file));
}
