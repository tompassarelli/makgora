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

export function judgeKeyFrames(keys: JudgeKeys): number[] {
  const hits = keys.hits.length > 1 ? [...keys.hits, ...keys.hitWindups] : [];
  return [...new Set([0, keys.windup, keys.contact, keys.lastActive, keys.recovery, keys.end, ...hits])].sort((a, b) => a - b);
}
