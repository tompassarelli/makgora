import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { preloadLines } from "wisp/scripts/wisp/preloadRecord";
import { RATES_FILE, parseSessionRates } from "./sessionRates";
import { FRAME_MILLIS } from "./smokeTape";

export interface MapStall {
  readonly from: number;
  readonly through: number;
  readonly millis: number;
}

const STALL_FLOOR_MILLIS = 2 * FRAME_MILLIS;

export function mapStalls(lines: readonly string[], serial: number): MapStall[] {
  const seconds = parseSessionRates(lines).seconds.filter((row) => row.m === serial && row.f !== undefined).sort((left, right) => (left.t ?? 0) - (right.t ?? 0));
  return seconds.flatMap((row, index): MapStall[] => {
    const millis = (row.cbgap ?? 0) / 1000;
    const frame = row.f ?? 0;
    if (millis <= STALL_FLOOR_MILLIS) return [];
    return [{ from: seconds[index - 1]?.f ?? Math.max(0, frame - 60), through: frame + Math.ceil(millis / FRAME_MILLIS), millis }];
  });
}

export function readMapStalls(folder: string, since: number, serial: number): MapStall[] {
  const lines = readdirSync(folder).filter((file) => RATES_FILE.test(file) && statSync(join(folder, file)).mtimeMs >= since).flatMap((file) => {
    const text = readFileSync(join(folder, file), "utf8");
    return preloadLines(text) ?? text.split(/\r?\n/);
  });
  return mapStalls(lines, serial);
}
