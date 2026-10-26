import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { Schema } from "effect";
import type { ScoreFrame } from "./animScore";
import type { SampledCue } from "./animScoreSample";

const QUANTUM = 0.05;

export function clipIdentity(frames: readonly (ScoreFrame | undefined)[], travels: readonly number[], framing: string, cues: readonly (readonly SampledCue[])[] = []): string {
  const hasher = new Bun.CryptoHasher("sha256").update(`${framing}|`);
  for (const frame of frames) {
    if (frame === undefined) {
      hasher.update("missing|");
      continue;
    }
    const quantized = Int32Array.from(frame.vertices, (value) => Math.round(value / QUANTUM));
    hasher.update(new Uint8Array(quantized.buffer)).update("|");
  }
  const travel = Int32Array.from(travels, (value) => Math.round(value / QUANTUM));
  if (travel.some((value) => value !== 0)) hasher.update("travel|").update(new Uint8Array(travel.buffer));
  const placed = Int32Array.from(cues.flatMap((frame, index) => frame.flatMap((cue) => [index, cue.x, cue.z, cue.scale, cue.age])), (value) => Math.round(value / QUANTUM));
  if (placed.length > 0) hasher.update("cue|").update(new Uint8Array(placed.buffer));
  return hasher.digest("hex").slice(0, 16);
}

export const JUDGES_PER_CLIP = 3;

export function judgePanel<Entry extends { readonly clip?: string | undefined }>(own: readonly Entry[], clip: string): readonly Entry[] {
  return own.filter((entry) => entry.clip === clip).slice(0, JUDGES_PER_CLIP);
}

export const median = (values: readonly number[]): number => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0;

const PREPARED_CLIPS = "clips.json";
const PreparedClips = Schema.fromJsonString(Schema.Struct({ look: Schema.String, clips: Schema.Record(Schema.String, Schema.String) }));

export async function writePreparedClips(directory: string, look: string, clips: Readonly<Record<string, string>>): Promise<void> {
  mkdirSync(directory, { recursive: true });
  await Bun.write(join(directory, PREPARED_CLIPS), `${JSON.stringify({ look, clips }, null, 2)}\n`);
}

export async function withPreparedClips<Entry extends { readonly look: string; readonly fighter: string; readonly move: string; readonly clip?: string | undefined }>(entries: readonly Entry[], scoresFile: string): Promise<Entry[]> {
  const path = join(dirname(scoresFile), PREPARED_CLIPS);
  const prepared = (await Bun.file(path).exists()) ? Schema.decodeSync(PreparedClips)(await Bun.file(path).text()) : undefined;
  return entries.map((entry) => entry.clip !== undefined || prepared?.look !== entry.look ? entry : { ...entry, clip: prepared.clips[`${entry.fighter}/${entry.move}`] });
}

export const judgementKey = (entry: { readonly look: string; readonly fighter: string; readonly move: string; readonly judge: string; readonly clip?: string | undefined }): string =>
  `${entry.look}/${entry.fighter}/${entry.move}/${entry.judge}/${entry.clip ?? ""}`;
