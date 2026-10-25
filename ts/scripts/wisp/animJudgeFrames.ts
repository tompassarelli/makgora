export interface JudgeKeys {
  readonly windup: number;
  readonly contact: number;
  readonly lastActive: number;
  readonly recovery: number;
  readonly end: number;
  readonly hits: readonly number[];
}

export function hitStarts(windows: readonly (readonly number[])[]): number[] {
  return windows.flatMap((open, index) => open.some((window) => !(windows[index - 1] ?? []).includes(window)) ? [index] : []);
}

export function judgeKeyFrames(keys: JudgeKeys): number[] {
  const hits = keys.hits.length > 1 ? keys.hits : [];
  return [...new Set([0, keys.windup, keys.contact, keys.lastActive, keys.recovery, keys.end, ...hits])].sort((a, b) => a - b);
}

export function judgeFrameLabel(keys: JudgeKeys, frame: number): string {
  const hit = keys.hits.length > 1 ? keys.hits.indexOf(frame) : -1;
  const roles = [
    frame === 0 ? "start" : "", frame === keys.windup ? "windup" : "", hit >= 0 ? `hit ${hit + 1}` : frame === keys.contact ? "contact" : "",
    frame === keys.lastActive ? "last active" : "", frame === keys.recovery ? "recovery" : "", frame === keys.end ? "end" : "",
  ].filter((role) => role !== "");
  return `frame ${frame}: ${roles.join(", ")}`;
}

export const JUDGE_ROW_TILES = 4;

export function judgeRows(count: number): number[][] {
  const rows = Math.max(1, Math.ceil(count / JUDGE_ROW_TILES)), columns = Math.ceil(count / rows);
  return Array.from({ length: rows }, (_, row) => Array.from({ length: Math.min(columns, count - row * columns) }, (_, column) => row * columns + column));
}
