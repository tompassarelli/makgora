import type { Frame } from "wisp/scripts/wisp/frameProbe";
import { SELECTABLE_CHARACTERS, fighterSlug } from "../../src/game/roster/kits";
import { effectSourceDigest, effectUses, effectUseDigest } from "./effectVisibility";

export interface PixelBox { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
export interface Footprint { readonly pixels: number; readonly contamination: number; readonly unstable: number }
export interface ScreenFrame extends Footprint { readonly frame: number }
export interface ScreenSample {
  readonly move: string;
  readonly role: "positive" | "negative" | "candidate";
  readonly source: string;
  readonly version: string;
  readonly width: number;
  readonly height: number;
  readonly first: number;
  readonly last: number;
  readonly frames: readonly ScreenFrame[];
  readonly problem?: string | undefined;
}

export const SCREEN_POSITIVES = ["neutral-special", "side-special", "up-special", "down-special", "ultimate"].map(move => `blademaster:${move}`);
export const SCREEN_NEGATIVES = ["chen-stormstout:neutral-special", "murloc:side-special", "murloc:up-special", "shadow-hunter:neutral-special", "mountain-king:down-special", "thrall:down-special", "cairne:neutral-special", "lich:side-special", "lich:down-special"];
const projectileUses = effectUses().filter(use => use.kind === "projectile");
const projectileKey = (use: typeof projectileUses[number]) => `${use.fighter}:${use.move} [projectile:${effectUseDigest(use)}]`;
const SCREEN_PROJECTILES = projectileUses.map(projectileKey);
const projectileFrames = new Map(projectileUses.map(use => [projectileKey(use), Math.round((use.lifetime ?? 0) * 60)]));
export const screenRequiredFrames = (move: string) => Math.max(1, projectileFrames.get(move) ?? 1);
export const SCREEN_MOVES = [...new Set([...SELECTABLE_CHARACTERS.flatMap(character => ["neutral-special", "side-special", "up-special", "down-special", "ultimate"].map(move => `${fighterSlug(character)}:${move}`)), ...SCREEN_PROJECTILES])];
export const SCREEN_CHANNEL_DELTA = 24;

const contains = (box: PixelBox, x: number, y: number) => x >= box.x && y >= box.y && x < box.x + box.width && y < box.y + box.height;
const validBox = (box: PixelBox, width: number, height: number) => [box.x, box.y, box.width, box.height].every(Number.isInteger) && box.x >= 0 && box.y >= 0 && box.width > 0 && box.height > 0 && box.x + box.width <= width && box.y + box.height <= height;

export function measureFootprint(shown: Frame, off: Frame, repeatedOff: Frame, region: PixelBox, excluded: readonly PixelBox[]): Footprint | undefined {
  if ([shown, off, repeatedOff].some(image => image.width !== shown.width || image.height !== shown.height || image.rgb.length !== image.width * image.height * 3)
    || !validBox(region, shown.width, shown.height) || excluded.some(box => !validBox(box, shown.width, shown.height))) return undefined;
  let pixels = 0, contamination = 0, unstable = 0;
  const differs = (left: Frame, right: Frame, offset: number) => [0, 1, 2].some(channel => Math.abs((left.rgb[offset + channel] ?? 0) - (right.rgb[offset + channel] ?? 0)) > SCREEN_CHANNEL_DELTA);
  for (let y = 0; y < shown.height; y++) for (let x = 0; x < shown.width; x++) {
    if (excluded.some(box => contains(box, x, y))) continue;
    const offset = (y * shown.width + x) * 3;
    const noise = differs(off, repeatedOff, offset);
    const changed = differs(shown, off, offset) && differs(shown, repeatedOff, offset);
    if (!contains(region, x, y)) {
      if (changed && !noise) contamination++;
    } else if (noise) unstable++;
    else if (changed) pixels++;
  }
  return { pixels, contamination, unstable };
}

export function sampleProblem(sample: ScreenSample): string | undefined {
  if (sample.problem !== undefined) return sample.problem;
  if (!Number.isInteger(sample.first) || !Number.isInteger(sample.last) || sample.first < 1 || sample.last < sample.first) return "invalid active frame window";
  if (sample.frames.length !== sample.last - sample.first + 1 || sample.frames.some((row, index) => row.frame !== sample.first + index)) return "missing, duplicate or unordered active frames";
  if (sample.role === "candidate" && sample.frames.length < screenRequiredFrames(sample.move)) return "projectile capture does not cover its whole lifetime/path";
  if (sample.frames.some(row => ![row.pixels, row.contamination, row.unstable].every(value => Number.isInteger(value) && value >= 0))) return "invalid pixel measurements";
  if (sample.frames.some(row => row.contamination > 0)) return "cue-on/control differences outside the effect region";
  if (sample.width < 1 || sample.height < 1 || !Number.isInteger(sample.width) || !Number.isInteger(sample.height)) return "invalid screen resolution";
  return undefined;
}

export function visibleRun(sample: ScreenSample, minimumPixels: number): number {
  let longest = 0, run = 0;
  for (const row of sample.frames) {
    run = row.pixels >= minimumPixels ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  return longest;
}

export interface ScreenCalibration { readonly pixels: number; readonly frames: number; readonly width: number; readonly height: number; readonly positives: readonly string[]; readonly negatives: readonly string[] }
export function calibrateScreen(samples: readonly ScreenSample[]): { readonly calibration?: ScreenCalibration; readonly problem?: string } {
  const positives = samples.filter(sample => sample.role === "positive"), negatives = samples.filter(sample => sample.role === "negative");
  if (SCREEN_POSITIVES.some(move => !positives.some(sample => sample.move === move)) || SCREEN_NEGATIVES.some(move => !negatives.some(sample => sample.move === move))) return { problem: "native Blademaster positives and all flagged 0.0.192 negatives are required" };
  if (positives.some(sample => !SCREEN_POSITIVES.includes(sample.move)) || negatives.some(sample => !SCREEN_NEGATIVES.includes(sample.move) || sample.version !== "0.0.192")) return { problem: "unapproved calibration reference or negative map version" };
  const first = positives[0];
  if (first === undefined) return { problem: "no native calibration" };
  for (const sample of [...positives, ...negatives]) {
    const problem = sampleProblem(sample);
    if (problem !== undefined) return { problem: `${sample.move}: ${problem}` };
    if (sample.width !== first.width || sample.height !== first.height) return { problem: "calibration camera resolution differs" };
  }
  const pixels = Math.min(...positives.map(sample => Math.max(0, ...sample.frames.map(row => row.pixels))));
  if (pixels < 1) return { problem: "a known-good positive has no stable effect pixels" };
  const frames = Math.min(...positives.map(sample => visibleRun(sample, pixels)));
  if (frames < 1 || negatives.some(sample => visibleRun(sample, pixels) >= frames)) return { problem: "known-good and flagged cues do not separate; calibration remains unproven" };
  return { calibration: { pixels, frames, width: first.width, height: first.height, positives: positives.map(sample => sample.move), negatives: negatives.map(sample => sample.move) } };
}

export interface ScreenRow { readonly move: string; readonly status: "visible" | "invisible" | "unproven"; readonly reason: string; readonly pixels?: number; readonly frames?: number }
export interface ScreenReport { readonly source: string; readonly provenance: string; readonly calibration?: ScreenCalibration | undefined; readonly calibrationProblem?: string | undefined; readonly rows: readonly ScreenRow[] }
export function screenReport(samples: readonly ScreenSample[], provenance: string, source = effectSourceDigest()): ScreenReport {
  const { calibration, problem: calibrationProblem } = calibrateScreen(samples);
  const rows = SCREEN_MOVES.map((move): ScreenRow => {
    const candidates = samples.filter(sample => sample.role === "candidate" && sample.move === move);
    if (candidates.length === 0) return { move, status: "unproven", reason: "native cue-on/off motion captures missing; model data cannot establish visibility" };
    for (const sample of candidates) {
      const problem = sampleProblem(sample);
      if (problem !== undefined || sample.source !== source) return { move, status: "unproven", reason: problem ?? "capture source differs from current source" };
    }
    if (calibration === undefined) return { move, status: "unproven", reason: calibrationProblem ?? "native calibration missing" };
    if (candidates.some(sample => sample.width !== calibration.width || sample.height !== calibration.height)) return { move, status: "unproven", reason: "capture resolution differs from calibrated scene" };
    const pixels = Math.min(...candidates.map(sample => Math.max(0, ...sample.frames.map(row => row.pixels))));
    const frames = Math.min(...candidates.map(sample => visibleRun(sample, calibration.pixels)));
    return { move, status: frames >= calibration.frames ? "visible" : "invisible", reason: `${pixels} stable pixels; ${frames} consecutive frames; calibrated minimum ${calibration.pixels} pixels for ${calibration.frames} frames`, pixels, frames };
  });
  return { source, provenance, calibration, calibrationProblem, rows };
}

export function screenAcceptanceProblem(report: ScreenReport, source = effectSourceDigest()): string | undefined {
  if (report.source !== source || !/^[0-9a-f]{64}$/.test(report.provenance)) return "native screen evidence is stale or has no capture provenance";
  const calibration = report.calibration;
  if (calibration === undefined || report.calibrationProblem !== undefined) return report.calibrationProblem ?? "native screen calibration missing";
  if (![calibration.pixels, calibration.frames, calibration.width, calibration.height].every(value => Number.isInteger(value) && value > 0) || SCREEN_POSITIVES.some(move => !calibration.positives.includes(move)) || SCREEN_NEGATIVES.some(move => !calibration.negatives.includes(move))) return "native screen calibration is incomplete or invalid";
  if (SCREEN_MOVES.some(move => report.rows.filter(row => row.move === move).length !== 1) || report.rows.some(row => !SCREEN_MOVES.includes(row.move))) return "native special/ultimate matrix is incomplete or duplicated";
  const unresolved = report.rows.filter(row => row.status !== "visible" || (row.pixels ?? 0) < calibration.pixels || (row.frames ?? 0) < calibration.frames);
  return unresolved.length === 0 ? undefined : `native Classic visibility: ${unresolved.length} moves remain invisible/unproven: ${unresolved.map(row => row.move).join("; ")}`;
}
