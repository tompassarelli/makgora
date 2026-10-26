export interface JudgeKeys {
  readonly windup: number;
  readonly contact: number;
  readonly lastActive: number;
  readonly recovery: number;
  readonly end: number;
  readonly hits: readonly number[];
  readonly hitWindups: readonly number[];
}

export function hitStarts(windows: readonly (readonly number[])[]): number[] {
  return windows.flatMap((open, index) => open.some((window) => !(windows[index - 1] ?? []).includes(window)) ? [index] : []);
}

export const JUDGE_MAX_GAP = 6;

export function judgeKeyFrames(keys: JudgeKeys): number[] {
  const hits = keys.hits.length > 1 ? [...keys.hits, ...keys.hitWindups] : [];
  const key = [...new Set([0, keys.windup, keys.contact, keys.lastActive, keys.recovery, keys.end, ...hits])].sort((a, b) => a - b);
  return key.flatMap((frame, index) => {
    const next = key[index + 1];
    if (next === undefined || frame < keys.contact || next - frame <= JUDGE_MAX_GAP) return [frame];
    const parts = Math.ceil((next - frame) / JUDGE_MAX_GAP);
    return Array.from({ length: parts }, (_, part) => frame + Math.round((part * (next - frame)) / parts));
  });
}
