import { join, resolve } from "node:path";
import { Schema } from "effect";

export const ROOT = resolve(import.meta.dir, "../..");
export const REFERENCE = "references/melee-frame-data";
export const RECORDS = `${REFERENCE}/records.jsonl`;
export const LIBMELEE = `${REFERENCE}/libmelee.jsonl`;
export const FIGHTCORE = `${REFERENCE}/fightcore.csv`;
export const ATTRIBUTES = `${REFERENCE}/character-attributes.csv`;

const FrameRecord = Schema.Struct({
  character: Schema.String, category: Schema.String, action: Schema.NullOr(Schema.String),
  values: Schema.Record(Schema.String, Schema.NullOr(Schema.Finite)),
});
const MotionRecord = Schema.Struct({
  character: Schema.String, action: Schema.String,
  hitbox_frames: Schema.Array(Schema.Struct({
    frame: Schema.Finite,
    hitboxes: Schema.Array(Schema.Struct({ size: Schema.Finite, x: Schema.Finite, y: Schema.Finite })),
  })),
});

export interface Fighter {
  readonly id: string;
  readonly name: string;
  readonly fightcore: string;
  readonly attributes: string;
}

const FIGHTERS: readonly Fighter[] = [
  ["bowser", "Bowser"], ["captain_falcon", "Captain Falcon"], ["donkey_kong", "Donkey Kong"],
  ["dr._mario", "Dr. Mario", "Dr. Mario", "Dr Mario"], ["falco", "Falco"], ["fox", "Fox"], ["ganondorf", "Ganondorf"],
  ["ice_climbers", "Ice Climbers"], ["jigglypuff", "Jigglypuff"], ["kirby", "Kirby"], ["link", "Link"], ["luigi", "Luigi"],
  ["mario", "Mario"], ["marth", "Marth"], ["mewtwo", "Mewtwo"],
  ["mr._game_&_watch", "Mr. Game & Watch", "Mr. Game & Watch", "Game & Watch"], ["ness", "Ness"], ["peach", "Peach"],
  ["pichu", "Pichu"], ["pikachu", "Pikachu"], ["roy", "Roy"], ["samus", "Samus"], ["sheik", "Sheik"], ["yoshi", "Yoshi"],
  ["young_link", "Young Link"], ["zelda", "Zelda"],
].map(([id, name, fightcore, attributes]) => ({ id: id ?? "", name: name ?? "", fightcore: fightcore ?? name ?? "", attributes: attributes ?? name ?? "" }));

export const TOP_EIGHT: readonly string[] = ["fox", "falco", "marth", "sheik", "jigglypuff", "captain_falcon", "peach", "ice_climbers"];

export function fighters(): readonly Fighter[] {
  return FIGHTERS;
}

async function jsonl<S extends Schema.Top>(path: string, schema: S): Promise<S["Type"][]> {
  return (await Bun.file(join(ROOT, path)).text()).trim().split("\n").map((line) => {
    const value: unknown = JSON.parse(line);
    Schema.asserts(schema, value);
    return value;
  });
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === "\"" && text[i + 1] === "\"") { cell += "\""; i++; } else if (c === "\"") quoted = false; else cell += c;
    } else if (c === "\"") quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; } else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; } else if (c !== "\r") cell += c;
  }
  if (cell !== "" || row.length > 0) { row.push(cell); rows.push(row); }
  return rows;
}

export function firstNumber(cell: string | undefined): number | null {
  const match = /-?\d+(\.\d+)?/.exec(cell ?? "");
  return match === null ? null : Number(match[0]);
}

export interface Reference {
  readonly field: (f: Fighter, category: string, action: string, key: string) => number | null;
  readonly fightcore: (f: Fighter, move: string, column: string) => string | undefined;
  readonly attribute: (f: Fighter, column: string) => string | undefined;
  readonly hitboxes: (f: Fighter, action: string) => readonly { size: number; x: number; y: number }[];
}

function csvIndex(rows: readonly string[][], key: (row: readonly string[]) => string): (k: string, column: string) => string | undefined {
  const header = rows[0] ?? [];
  const index = new Map(rows.slice(1).map((row) => [key(row), row]));
  return (k, column) => {
    const at = header.indexOf(column);
    if (at < 0) throw new Error(`no column ${column}`);
    return index.get(k)?.[at];
  };
}

export async function loadReference(): Promise<Reference> {
  const records = await jsonl(RECORDS, FrameRecord);
  const motion = await jsonl(LIBMELEE, MotionRecord);
  const fightcore = csvIndex(parseCsv(await Bun.file(join(ROOT, FIGHTCORE)).text()), (row) => `${row[0]}/${row[2]}`);
  const attributes = csvIndex(parseCsv(await Bun.file(join(ROOT, ATTRIBUTES)).text()), (row) => row[0] ?? "");
  const recordIndex = new Map(records.map((r) => [`${r.character}/${r.category}/${r.action ?? ""}`, r]));
  const motionIndex = new Map(motion.map((m) => [`${m.character}/${m.action}`, m]));
  return {
    field: (f, category, action, key) => recordIndex.get(`${f.id}/${category}/${action}`)?.values[key] ?? null,
    fightcore: (f, move, column) => fightcore(`${f.fightcore}/${move}`, column),
    attribute: (f, column) => attributes(f.attributes, column),
    hitboxes: (f, action) => (motionIndex.get(`${f.id}/${action}`)?.hitbox_frames ?? []).flatMap((frame) => frame.hitboxes),
  };
}
