import { VOICE_CAP, VoiceClass } from "../src/game/presentation/voiceBudget";

export const FRAME_MS = 1000 / 60;
const STAMP_FRAMES = 32768;
const HOP = 48;
const RISE_HOPS = 5;
const BEFORE_HOPS = 20;
const RISE_RATIO = 4;
const ONSET_GAP_MS = 15;
const ISOLATION_MS = 150;
const SEARCH_MS = 100;

export interface Voice {
  readonly drawn: number;
  readonly frame: number;
  readonly fighter: number;
  readonly cls: number;
  readonly slot: number;
  readonly live: number;
  readonly volume: number;
  readonly sound: string;
}

export interface StampSample {
  readonly ms: number;
  readonly captureMs: number;
  readonly frame: number;
}

export function parseVoices(lines: readonly string[]): Voice[] {
  return lines.flatMap(line => {
    const match = /^(\d+) (\d+) (\d) (\d) (-?\d+) (\d+) (\d+) (.+)$/.exec(line);
    if (match === null) return [];
    const [, drawn, frame, fighter, cls, slot, live, volume, sound] = match;
    return [{ drawn: Number(drawn), frame: Number(frame), fighter: Number(fighter), cls: Number(cls), slot: Number(slot), live: Number(live), volume: Number(volume), sound: sound ?? "" }];
  });
}

export interface Pcm {
  readonly rate: number;
  readonly mono: Float32Array;
}

export function parseWav(bytes: Uint8Array): Pcm {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (offset: number) => String.fromCharCode(...bytes.subarray(offset, offset + 4));
  if (tag(0) !== "RIFF" || tag(8) !== "WAVE") throw new Error("not a WAVE file");
  let offset = 12;
  let channels = 0;
  let rate = 0;
  let bits = 0;
  while (offset + 8 <= bytes.length) {
    const id = tag(offset);
    const declared = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (id === "fmt ") {
      channels = view.getUint16(body + 2, true);
      rate = view.getUint32(body + 4, true);
      bits = view.getUint16(body + 14, true);
    }
    if (id === "data") {
      if (bits !== 16 || channels < 1) throw new Error(`expected 16-bit PCM, got ${bits}-bit ${channels} channels`);
      const size = declared === 0 || declared === 0xffffffff || body + declared > bytes.length ? bytes.length - body : declared;
      const frames = Math.floor(size / (2 * channels));
      const mono = new Float32Array(frames);
      for (let index = 0; index < frames; index++) {
        let sum = 0;
        for (let channel = 0; channel < channels; channel++) sum += view.getInt16(body + (index * channels + channel) * 2, true);
        mono[index] = sum / (channels * 32768);
      }
      return { rate, mono };
    }
    offset = body + declared + (declared % 2);
  }
  throw new Error("WAVE file has no data chunk");
}

/** Onset times in ms from the file's first sample: the hop where energy over the next 5 ms first exceeds four times the 20 ms before it and the noise floor. */
export function onsets(pcm: Pcm): number[] {
  const hops = Math.floor(pcm.mono.length / HOP);
  const energy = new Float64Array(hops);
  for (let hop = 0; hop < hops; hop++) {
    let sum = 0;
    for (let index = hop * HOP; index < (hop + 1) * HOP; index++) sum += (pcm.mono[index] ?? 0) ** 2;
    energy[hop] = sum / HOP;
  }
  const sorted = [...energy].sort((a, b) => a - b);
  const floor = Math.max(1e-9, 4 * (sorted[Math.floor(sorted.length / 10)] ?? 0));
  const hopMs = HOP / pcm.rate * 1000;
  const found: number[] = [];
  let rising = false;
  for (let hop = BEFORE_HOPS; hop + RISE_HOPS < hops; hop++) {
    let ahead = 0;
    for (let index = hop; index < hop + RISE_HOPS; index++) ahead += energy[index] ?? 0;
    ahead /= RISE_HOPS;
    let before = 0;
    for (let index = hop - BEFORE_HOPS; index < hop; index++) before += energy[index] ?? 0;
    before /= BEFORE_HOPS;
    const onset = ahead > floor && ahead > RISE_RATIO * before;
    const ms = hop * hopMs;
    if (onset && !rising && (found.length === 0 || ms - (found.at(-1) ?? 0) >= ONSET_GAP_MS)) found.push(ms);
    rising = onset;
  }
  return found;
}

/** Wall ms at which FRAME was on screen, by a local least-squares line through the stamps read near it. */
export function drawnAt(stamps: readonly StampSample[], frame: number): number | undefined {
  for (const reach of [120, 600, 3600]) {
    const near = stamps.filter(stamp => Math.abs(stamp.frame - frame) <= reach);
    if (near.length < 3) continue;
    const meanFrame = near.reduce((total, stamp) => total + stamp.frame, 0) / near.length;
    const meanMs = near.reduce((total, stamp) => total + stamp.ms + stamp.captureMs / 2, 0) / near.length;
    let covariance = 0;
    let variance = 0;
    for (const stamp of near) {
      covariance += (stamp.frame - meanFrame) * (stamp.ms + stamp.captureMs / 2 - meanMs);
      variance += (stamp.frame - meanFrame) ** 2;
    }
    if (variance === 0) continue;
    return meanMs + covariance / variance * (frame - meanFrame);
  }
  return undefined;
}

export function unwrapStamps(stamps: readonly StampSample[], voices: readonly Voice[]): StampSample[] {
  const base = Math.floor((voices[0]?.frame ?? 0) / STAMP_FRAMES) * STAMP_FRAMES;
  const out: StampSample[] = [];
  let lap = base;
  let previous: number | undefined;
  for (const stamp of stamps) {
    if (previous !== undefined && stamp.frame < previous - STAMP_FRAMES / 2) lap += STAMP_FRAMES;
    previous = stamp.frame;
    out.push({ ...stamp, frame: stamp.frame + lap });
  }
  return out;
}

export interface Row {
  readonly frame: number;
  readonly drawn: number;
  readonly fighter: number;
  readonly sound: string;
  readonly live: number;
  readonly isolated: boolean;
  readonly expectedMs: number | undefined;
  readonly offsetMs: number | undefined;
  readonly onFrame: boolean;
}

export interface Verdict {
  readonly voices: number;
  readonly hits: number;
  readonly maxLive: number;
  readonly latencyMs: number | undefined;
  readonly latencySamples: number;
  readonly latencySpreadMs: { readonly p10: number; readonly p90: number; readonly min: number; readonly max: number } | undefined;
  readonly mapLagFrames: number;
  readonly onFrame: number;
  readonly off: number;
  readonly unmatched: number;
  readonly isolatedHits: number;
  readonly isolatedOff: number;
  readonly pass: boolean;
  readonly rows: readonly Row[];
}

const nearest = (sorted: readonly number[], target: number): number | undefined => {
  let low = 0;
  let high = sorted.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if ((sorted[middle] ?? 0) < target) low = middle + 1;
    else high = middle;
  }
  const candidates = [sorted[low - 1], sorted[low]].filter((value): value is number => value !== undefined);
  return candidates.sort((a, b) => Math.abs(a - target) - Math.abs(b - target))[0];
};

/** Judges each hit voice: its audio onset, after the median audio latency of isolated non-hit voices, must fall within one frame of the moment its own frame was drawn. */
export function judge(voices: readonly Voice[], rawStamps: readonly StampSample[], found: readonly number[], audioStartMs: number): Verdict {
  const stamps = unwrapStamps(rawStamps, voices);
  const starts = voices.map(voice => drawnAt(stamps, voice.frame));
  const isolated = voices.map((voice, index) => {
    const at = starts[index];
    return at !== undefined && voices.every((other, otherIndex) => {
      const otherAt = starts[otherIndex];
      return otherIndex === index || otherAt === undefined || Math.abs(otherAt - at) > ISOLATION_MS;
    });
  });
  const latencies: number[] = [];
  voices.forEach((voice, index) => {
    const at = starts[index];
    if (voice.cls === VoiceClass.hit || !isolated[index] || at === undefined) return;
    const onset = nearest(found, at - audioStartMs + 50);
    if (onset !== undefined && Math.abs(onset - (at - audioStartMs + 50)) <= 150) latencies.push(onset - (at - audioStartMs));
  });
  latencies.sort((a, b) => a - b);
  const latencyMs = latencies[Math.floor(latencies.length / 2)];
  const quantile = (share: number) => latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * share))] ?? 0;
  const latencySpreadMs = latencies.length === 0 ? undefined : { p10: quantile(0.1), p90: quantile(0.9), min: latencies[0] ?? 0, max: latencies.at(-1) ?? 0 };
  const rows: Row[] = [];
  voices.forEach((voice, index) => {
    if (voice.cls !== VoiceClass.hit) return;
    const at = starts[index];
    const expectedMs = at === undefined || latencyMs === undefined ? undefined : at - audioStartMs + latencyMs;
    const onset = expectedMs === undefined ? undefined : nearest(found, expectedMs);
    const offsetMs = onset === undefined || expectedMs === undefined || Math.abs(onset - expectedMs) > SEARCH_MS ? undefined : onset - expectedMs;
    rows.push({ frame: voice.frame, drawn: voice.drawn, fighter: voice.fighter, sound: voice.sound, live: voice.live, isolated: isolated[index] === true, expectedMs, offsetMs, onFrame: offsetMs !== undefined && Math.abs(offsetMs) <= FRAME_MS && voice.drawn === voice.frame });
  });
  const off = rows.filter(row => row.offsetMs !== undefined && !row.onFrame).length;
  const unmatched = rows.filter(row => row.offsetMs === undefined).length;
  const isolatedRows = rows.filter(row => row.isolated);
  const maxLive = voices.reduce((most, voice) => Math.max(most, voice.live), 0);
  return {
    voices: voices.length, hits: rows.length, maxLive, latencyMs, latencySamples: latencies.length, latencySpreadMs,
    mapLagFrames: voices.reduce((most, voice) => Math.max(most, voice.drawn - voice.frame), 0),
    onFrame: rows.filter(row => row.onFrame).length, off, unmatched,
    isolatedHits: isolatedRows.length, isolatedOff: isolatedRows.filter(row => !row.onFrame).length,
    pass: rows.length > 0 && off === 0 && unmatched === 0 && maxLive <= VOICE_CAP, rows,
  };
}
