import { readChunks, writeChunks } from "wisp/src/platform/fileio";
import { CPU_TIERS, type CpuTier } from "../match/cpuProfiles";
import { beatsScore, type RunScore } from "./score";

export const ARCADE_RECORDS_FILE = "MakgoraArcade.pld";

const CHUNK = 200;
const MAX_CHUNKS = 64;
const FIGHTER_SEPARATOR = "|";
const FIELD_SEPARATOR = ",";
const SCORE_SEPARATOR = ":";
const NO_CLEAR = "-";
const DIGITS = "0123456789";

export interface ChunkFiles {
  readonly read: (filename: string) => string[];
  readonly write: (filename: string, chunks: readonly string[]) => boolean;
}

const NATIVE_FILES: ChunkFiles = { read: filename => readChunks(filename), write: (filename, chunks) => writeChunks(filename, chunks) };

export interface FighterRecord {
  readonly best: Readonly<Partial<Record<CpuTier, RunScore>>>;
  readonly rank: number;
}

const EMPTY: FighterRecord = { best: {}, rank: 0 };

function parseCount(text: string): number | undefined {
  if (text === "") return undefined;
  let value = 0;
  for (let index = 0; index < text.length; index++) {
    const digit = DIGITS.indexOf(text.substring(index, index + 1));
    if (digit < 0) return undefined;
    value = value * 10 + digit;
  }
  return value;
}

function parseScore(text: string): RunScore | undefined | null {
  if (text === NO_CLEAR) return undefined;
  const parts = text.split(SCORE_SEPARATOR);
  const negative = parts[0]?.substring(0, 1) === "-";
  const magnitude = parseCount(negative ? (parts[0] ?? "").substring(1) : (parts[0] ?? ""));
  const seconds = parseCount(parts[1] ?? "");
  if (parts.length !== 2 || magnitude === undefined || seconds === undefined) return null;
  return { total: negative ? -magnitude : magnitude, runSeconds: seconds };
}

function parseFighter(entry: string): { slug: string; record: FighterRecord } | undefined {
  const fields = entry.split(FIELD_SEPARATOR);
  const slug = fields[0] ?? "";
  const rank = parseCount(fields[1] ?? "");
  if (fields.length !== 2 + CPU_TIERS.length || slug === "" || rank === undefined) return undefined;
  const best: Partial<Record<CpuTier, RunScore>> = {};
  for (let index = 0; index < CPU_TIERS.length; index++) {
    const score = parseScore(fields[2 + index] ?? "");
    if (score === null) return undefined;
    const tier = CPU_TIERS[index];
    if (score !== undefined && tier !== undefined) best[tier] = score;
  }
  return { slug, record: { best, rank } };
}

function parseRecords(text: string): Map<string, FighterRecord> {
  const records = new Map<string, FighterRecord>();
  if (text === "") return records;
  for (const entry of text.split(FIGHTER_SEPARATOR)) {
    const parsed = parseFighter(entry);
    if (parsed === undefined) return new Map();
    records.set(parsed.slug, parsed.record);
  }
  return records;
}

function formatFighter(slug: string, record: FighterRecord): string {
  const tiers = CPU_TIERS.map(tier => {
    const score = record.best[tier];
    return score === undefined ? NO_CLEAR : `${score.total}${SCORE_SEPARATOR}${score.runSeconds}`;
  });
  return [slug, `${record.rank}`, ...tiers].join(FIELD_SEPARATOR);
}

function chunked(text: string): string[] {
  const chunks: string[] = [];
  for (let offset = 0; offset < text.length && chunks.length < MAX_CHUNKS; offset += CHUNK) chunks.push(text.substring(offset, offset + CHUNK));
  return chunks;
}

export class ArcadeRecords {
  private records: Map<string, FighterRecord> | undefined;

  constructor(private readonly files: ChunkFiles = NATIVE_FILES) {}

  // Engine: Preloader replays the first content it read from a path for the whole session, so the file is read once and every write updates this copy.
  private loaded(): Map<string, FighterRecord> {
    this.records ??= parseRecords(this.files.read(ARCADE_RECORDS_FILE).join(""));
    return this.records;
  }

  record(slug: string): FighterRecord {
    return this.loaded().get(slug) ?? EMPTY;
  }

  cleared(slug: string, tier: CpuTier): boolean {
    return this.record(slug).best[tier] !== undefined;
  }

  best(slug: string, tier: CpuTier): RunScore | undefined {
    return this.record(slug).best[tier];
  }

  rank(slug: string): number {
    return this.record(slug).rank;
  }

  /** Records a cleared run and reports whether it set a new best for the fighter and tier. */
  recordClear(slug: string, tier: CpuTier, score: RunScore): boolean {
    const previous = this.record(slug);
    const improved = beatsScore(score, previous.best[tier]);
    if (!improved) return false;
    this.loaded().set(slug, { best: { ...previous.best, [tier]: score }, rank: previous.rank });
    this.save();
    return true;
  }

  private save(): void {
    const entries: string[] = [];
    for (const [slug, record] of this.loaded()) entries.push(formatFighter(slug, record));
    this.files.write(ARCADE_RECORDS_FILE, chunked(entries.join(FIGHTER_SEPARATOR)));
  }
}

let local: ArcadeRecords | undefined;

export function arcadeRecords(): ArcadeRecords {
  local ??= new ArcadeRecords();
  return local;
}
