import type { Frame } from "wisp/scripts/wisp/frameProbe";

export const BRIGHT_LUMA = 0.92;
export const PLAY_TOP = 0.25;
export const PLAY_BOTTOM = 0.8;
export const NOISE_FACTOR = 3;
export const MIN_EXCESS_SHARE = 0.0005;

export function brightCount({ width, height, rgb }: Frame): number {
  let count = 0;
  for (let y = Math.floor(height * PLAY_TOP); y < Math.floor(height * PLAY_BOTTOM); y++) {
    for (let x = 0; x < width; x++) {
      const at = (y * width + x) * 3;
      if (0.2126 * (rgb[at] ?? 0) + 0.7152 * (rgb[at + 1] ?? 0) + 0.0722 * (rgb[at + 2] ?? 0) > BRIGHT_LUMA * 255) count++;
    }
  }
  return count;
}

export const playArea = ({ width, height }: Pick<Frame, "width" | "height">): number => width * (Math.floor(height * PLAY_BOTTOM) - Math.floor(height * PLAY_TOP));

export interface Settle {
  readonly step: string;
  readonly special: boolean;
  readonly count: number;
  readonly onTime: boolean;
}

export interface SpotResult {
  readonly step: string;
  readonly pass: boolean;
  readonly reason: string;
}

const changes = (runs: readonly (readonly Settle[])[]) => runs.flatMap(run => run.slice(1).flatMap((after, index) => {
  const before = run[index];
  return before === undefined ? [] : [{ before, after }];
}));

export function specialsSpot(runs: readonly (readonly Settle[])[], area: number): SpotResult[] {
  const pairs = changes(runs);
  const noise = Math.max(0, ...pairs.filter(({ before }) => !before.special).map(({ before, after }) => Math.abs(after.count - before.count)));
  const allowed = Math.max(NOISE_FACTOR * noise, MIN_EXCESS_SHARE * area);
  return pairs.filter(({ before }) => before.special).map(({ before, after }) => {
    if (!before.onTime || !after.onTime) return { step: before.step, pass: false, reason: "a settle frame was captured after the next press" };
    const excess = after.count - before.count;
    return { step: before.step, pass: excess <= allowed, reason: `${excess} more bright play-area pixels at the next rest than before it (allowed ${Math.round(allowed)}, noise ${noise})` };
  });
}

export const specialsReceipt = (fighters: number, results: readonly SpotResult[]): string =>
  `SMASHCRAFT GATE specials fighters=${fighters} checked=${results.length} clear=${results.filter(result => result.pass).length} pass=${results.length > 0 && results.every(result => result.pass) ? 1 : 0}`;
