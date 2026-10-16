import { type Frame } from "wisp/scripts/wisp/frameProbe";
import { STAMP_CELLS, type Stamp, type StampCell, type StampVerdict, readStamp, stampVerdict } from "../src/game/core/drawnStamp";

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
      const above = ((y - 1) * frame.width + left.start) * 3;
      if (y > 0 && colourClass(frame.rgb[above] ?? 0, frame.rgb[above + 1] ?? 0, frame.rgb[above + 2] ?? 0) === "guard") continue;
      const stamp = stampAlong(frame, y, left.start, right.end);
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
