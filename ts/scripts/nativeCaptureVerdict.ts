import { type Frame } from "wisp/scripts/wisp/frameProbe";
import { STAMP_CELLS, type Stamp, type StampCell, type StampVerdict, readStamp, stampVerdict } from "../src/game/core/drawnStamp";

const GUARD_TOLERANCE = 24;

function colourClass(red: number, green: number, blue: number): StampCell | "unclear" {
  if (red - Math.max(green, blue) > 60) return "one";
  if (blue - Math.max(red, green) > 60) return "zero";
  if (green - Math.max(red, blue) > 60) return "guard";
  return "unclear";
}

function cellAt(frame: Frame, x: number, y: number): StampCell | "unclear" {
  let red = 0;
  let green = 0;
  let blue = 0;
  let count = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const px = Math.round(x) + dx;
    const py = Math.round(y) + dy;
    if (px < 0 || py < 0 || px >= frame.width || py >= frame.height) return "unclear";
    const offset = (py * frame.width + px) * 3;
    red += frame.rgb[offset] ?? 0;
    green += frame.rgb[offset + 1] ?? 0;
    blue += frame.rgb[offset + 2] ?? 0;
    count++;
  }
  return colourClass(red / count, green / count, blue / count);
}

function stampAlong(frame: Frame, y: number, start: number, end: number) {
  const side = (end - start + 1) / STAMP_CELLS;
  const middle = y + side / 2;
  const cells: (StampCell | "unclear")[] = [];
  for (let index = 0; index < STAMP_CELLS; index++) cells.push(cellAt(frame, start + (index + 0.5) * side, middle));
  return readStamp(cells);
}

function stampInRows(frame: Frame, rows: readonly number[]): Stamp | undefined {
  for (const y of rows) {
    const runs: { start: number; end: number }[] = [];
    for (let x = 0; x < frame.width; x++) {
      const offset = (y * frame.width + x) * 3;
      if (colourClass(frame.rgb[offset] ?? 0, frame.rgb[offset + 1] ?? 0, frame.rgb[offset + 2] ?? 0) !== "guard") continue;
      const last = runs[runs.length - 1];
      if (last !== undefined && last.end === x - 1) last.end = x;
      else runs.push({ start: x, end: x });
    }
    for (const left of runs) for (const right of runs) {
      const side = (right.end - left.start + 1) / STAMP_CELLS;
      if (right.start <= left.end || side < 3) continue;
      const fits = (run: { start: number; end: number }) => Math.abs(run.end - run.start + 1 - side) <= Math.max(2, side * 0.3);
      if (!fits(left) || !fits(right)) continue;
      const inside = left.end - 1;
      const same = (row: number) => [0, 1, 2].every(channel => Math.abs((frame.rgb[(row * frame.width + inside) * 3 + channel] ?? 0) - (frame.rgb[(y * frame.width + inside) * 3 + channel] ?? 0)) <= GUARD_TOLERANCE);
      let top = y;
      while (top > 0 && same(top - 1)) top--;
      const stamp = stampAlong(frame, top, left.start, right.end);
      if (stamp !== undefined) return stamp;
    }
  }
  return undefined;
}

export function frameVerdict(frame: Frame): StampVerdict {
  const half = Math.floor(frame.height / 2);
  const top = Array.from({ length: half }, (_, index) => index);
  const bottom = Array.from({ length: frame.height - half }, (_, index) => frame.height - 1 - index);
  return stampVerdict(stampInRows(frame, top), stampInRows(frame, bottom));
}

export function frameStamp(frame: Frame): Stamp | undefined {
  const verdict = frameVerdict(frame);
  return "keep" in verdict ? verdict.keep : undefined;
}

const STALL_MS = 10000;

export function attemptEnding(log: readonly { readonly ms: number; readonly stamp: string }[], spentMinutes: number | undefined): string {
  const end = log.at(-1)?.ms ?? 0;
  const stamped = log.filter(row => /^\d+\/\d+$/.test(row.stamp));
  const last = stamped.at(-1);
  const prefix = spentMinutes !== undefined ? `the ${spentMinutes}-minute attempt budget ran out` : "the attempt ended";
  if (last === undefined) return `${prefix} before any frame stamp was readable`;
  let since = last.ms;
  for (let index = stamped.length - 1; index >= 0 && stamped[index]?.stamp === last.stamp; index--) since = stamped[index]?.ms ?? since;
  const [script, frame] = last.stamp.split("/");
  const held = end - since;
  return held >= STALL_MS
    ? `${prefix} with the frame stamp stuck at script ${script} frame ${frame} for ${Math.round(held / 1000)} s`
    : `${prefix} while the frame stamp still advanced, last at script ${script} frame ${frame}`;
}
