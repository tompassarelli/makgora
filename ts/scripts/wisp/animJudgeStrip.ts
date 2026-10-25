import type { JudgeKeys } from "./animJudgeFrames";

const JUDGE_ROW_TILES = 4;
const BACKGROUND = "#101522";
const BORDER = 3;

export interface JudgeTile { readonly width: number; readonly height: number; readonly x: number; readonly y: number }

export function judgeRows(count: number): number[][] {
  const rows = Math.max(1, Math.ceil(count / JUDGE_ROW_TILES)), columns = Math.ceil(count / rows);
  return Array.from({ length: rows }, (_, row) => Array.from({ length: Math.min(columns, count - row * columns) }, (_, column) => row * columns + column));
}

export function judgeStrip(crops: readonly string[], labels: readonly string[], tile: JudgeTile, output: string): { readonly args: string[]; readonly width: number } {
  const tiles = crops.map((crop, index) => ["(", crop, "-gravity", "NorthWest", "-crop", `${tile.width}x${tile.height}+${tile.x}+${tile.y}`, "+repage", "(", "-size", `${tile.width}x`, "-gravity", "center", `caption:${labels[index] ?? ""}`, ")", "-gravity", "NorthWest", "-append", "-bordercolor", BACKGROUND, "-border", `${BORDER}`, ")"]);
  const rows = judgeRows(tiles.length);
  return {
    args: ["-background", BACKGROUND, "-fill", "white", "-font", "DejaVu-Sans", "-pointsize", "28", ...rows.flatMap((indices) => ["(", ...indices.flatMap((index) => tiles[index] ?? []), "-gravity", "North", "+append", ")"]), "-gravity", "NorthWest", "-append", output],
    width: (tile.width + 2 * BORDER) * (rows[0]?.length ?? 1),
  };
}

export function judgeFrameLabel(keys: JudgeKeys, frame: number): string {
  const hit = keys.hits.length > 1 ? keys.hits.indexOf(frame) : -1;
  const rewind = keys.hits.length > 1 ? keys.hitWindups.indexOf(frame) : -1;
  const roles = [
    frame === 0 ? "start" : "", frame === keys.windup ? "windup" : "", rewind >= 0 ? `hit ${rewind + 2} windup` : "", hit >= 0 ? `hit ${hit + 1}` : frame === keys.contact ? "contact" : "",
    frame === keys.lastActive ? "last active" : "", frame === keys.recovery ? "recovery" : "", frame === keys.end ? "end" : "",
  ].filter((role) => role !== "");
  return `frame ${frame}: ${roles.join(", ")}`;
}
