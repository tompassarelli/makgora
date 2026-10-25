import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Effect, Schema } from "effect";
import { parseCharacterAttributes, type CharacterAttributes } from "./character-attributes";
import { parseFightCore, type FightCoreRow } from "./fightcore";

const root = resolve(import.meta.dir, "../..");
class ReaderCheckFailure extends Schema.TaggedError<ReaderCheckFailure>()("ReaderCheckFailure", { problem: Schema.String }) {
  override get message(): string { return this.problem; }
}
const attempt = <A>(problem: string, run: () => A) => Effect.try({ try: run, catch: (cause) => new ReaderCheckFailure({ problem: `${problem}: ${String(cause)}` }) });
const readText = (path: string) => Effect.tryPromise({ try: () => readFile(path, "utf8"), catch: (cause) => new ReaderCheckFailure({ problem: `read ${path}: ${String(cause)}` }) });
const RecordRow = Schema.Struct({
  character: Schema.String, category: Schema.String, action: Schema.NullOr(Schema.String),
  values: Schema.Record(Schema.String, Schema.NullOr(Schema.Finite)),
});
type MeleeRecord = typeof RecordRow.Type;
const recordsFrom = (text: string): readonly MeleeRecord[] => text.trim().split("\n").map((line, index) => {
  try { return Schema.decodeUnknownSync(RecordRow)(JSON.parse(line)); }
  catch (cause) { throw new Error(`records.jsonl line ${index + 1}: ${String(cause)}`); }
});

const fighterNames: Readonly<Record<string, string>> = {
  "captain falcon": "captain_falcon", "donkey kong": "donkey_kong", "dr mario": "dr._mario", "dr. mario": "dr._mario",
  "game & watch": "mr._game_&_watch", "ice climbers": "ice_climbers", "jigglypuff": "jigglypuff",
  "young link": "young_link", "mr. game & watch": "mr._game_&_watch",
};
const fighter = (name: string) => fighterNames[name.toLowerCase()] ?? name.toLowerCase().replaceAll(" ", "_");
const moveAliases: Readonly<Record<string, string>> = {
  "neutral air": "nair", "forward air": "fair", "back air": "bair", "up air": "uair", "down air": "dair",
  "dashattack": "dattack", "dash attack": "dattack", "jab 1": "jab1", "jab 2": "jab2", "jab 3": "jab3",
  "rapid jabs": "rjab", "down smash": "dsmash", "forward smash": "fsmash", "up smash": "usmash",
  "down tilt": "dtilt", "forward tilt": "ftilt", "forward tilt (up)": "ftilt", "forward tilt (down)": "ftilt", "up tilt": "utilt",
  "grab": "standing_grab", "dashgrab": "dash_grab", "air dodge": "air_dodge", airdodge: "air_dodge",
  "roll backwards": "back_roll", "roll forwards": "forward_roll", spotdodge: "spot_dodge",
  "forward throw": "forward_throw", "back throw": "back_throw", "down throw": "down_throw", "up throw": "up_throw",
};
const action = (row: FightCoreRow): string | undefined => {
  if (row.character === "Fox" && row.move === "Reflector") return "down_b";
  if (row.character === "Fox" && row.move === "Reflector (Air)") return "adown_b";
  return moveAliases[row.move.toLowerCase()];
};
const key = (character: string, move: string) => `${character}\0${move}`;
const show = (value: unknown): string => value === null || value === undefined ? "—" : Array.isArray(value) ? value.join(" / ") : String(value);
const same = (left: unknown, right: unknown): boolean => Array.isArray(left)
  ? left.length === 1 && left[0] === right
  : Array.isArray(right) ? right.length === 1 && right[0] === left : left === right;
const diff = (field: string, fc: unknown, mfd: unknown, fighterName: string, moveName: string): string | undefined =>
  fc !== null && fc !== undefined && mfd !== null && mfd !== undefined && !same(fc, mfd)
    ? `| ${fighterName} | ${moveName} | ${field} | ${show(fc)} | ${show(mfd)} |` : undefined;

function compareMoves(fightCore: readonly FightCoreRow[], records: readonly MeleeRecord[]): readonly string[] {
  const reference = new Map(records.filter((row) => row.category === "attacks" || row.category === "grabs" || row.category === "throws" || row.category === "dodges")
    .map((row) => [key(row.character, row.action ?? ""), row]));
  const lines: string[] = [];
  let comparedRows = 0;
  for (const row of fightCore) {
    const mappedAction = action(row);
    if (mappedAction === undefined) continue;
    const character = fighter(row.character), match = reference.get(key(character, mappedAction));
    if (match === undefined) continue;
    comparedRows++;
    const values = match.values;
    const pairs: readonly [string, number | null, number | null][] = [
      ["start", row.firstActive, values.start ?? null], ["end", row.lastActive, values.end ?? null],
      ["total", row.totalFrames, values.total ?? null], ["IASA", row.iasa, values.iasa ?? null],
      ["landing lag", row.landingLag, values.land_lag ?? null],
      ["L-cancelled landing lag", row.lCancelledLandingLag, values.cancel_lag ?? null],
      ["autocancel start", row.autocancel?.before ?? null, values.auto_cancel_s ?? null],
      ["autocancel end", row.autocancel?.from ?? null, values.auto_cancel_e ?? null],
    ];
    for (const [field, fc, mfd] of pairs) { const line = diff(field, fc, mfd, row.character, row.move); if (line !== undefined) lines.push(line); }
    const strongest = row.damage[0] ?? null, weakest = row.damage.at(-1) ?? null;
    for (const [field, fc, mfd] of [["damage strongest", strongest, values.percent ?? null], ["damage weakest", weakest, values.percent_weak ?? null]] as const) {
      const line = diff(field, fc, mfd, row.character, row.move); if (line !== undefined) lines.push(line);
    }
  }
  lines.unshift(`Compared ${comparedRows} fighter/move pairs with explicit action mappings.`);
  return lines;
}

function compareAttributes(attributes: readonly CharacterAttributes[], records: readonly MeleeRecord[]): readonly string[] {
  const misc = new Map(records.filter((row) => row.category === "misc").map((row) => [row.character, row]));
  const lines: string[] = [];
  const fields = (row: typeof attributes[number], values: MeleeRecord["values"]) => [
    ["weight", row.weight, values.weight ?? null],
    ["terminal velocity (records gravity label)", row.terminalVelocity, values.gravity ?? null],
    ["jump squat", row.jumpSquat, values.jump_squat ?? null],
    ["dash (records walk_speed label)", row.dashInitialVelocity, values.walk_speed ?? null],
    ["run speed", row.runVelocity, values.run_speed ?? null],
  ] as const;
  for (const row of attributes) {
    const record = misc.get(fighter(row.character));
    if (record === undefined) { lines.push(`| ${row.character} | misc | missing records.jsonl row | — | — |`); continue; }
    for (const [field, csv, mfd] of fields(row, record.values)) {
      const line = diff(field, csv, mfd, row.character, "misc"); if (line !== undefined) lines.push(line);
    }
  }
  return lines;
}

const main = Effect.gen(function*() {
  const [fightCoreText, attributesText, recordsText] = yield* Effect.all([
    readText(resolve(root, "references/melee-frame-data/fightcore.csv")),
    readText(resolve(root, "references/melee-frame-data/character-attributes.csv")),
    readText(resolve(root, "references/melee-frame-data/records.jsonl")),
  ]);
  const fightCore = yield* attempt("decode fightcore.csv", () => parseFightCore(fightCoreText));
  const attributes = yield* attempt("decode character-attributes.csv", () => parseCharacterAttributes(attributesText));
  const records = yield* attempt("decode records.jsonl", () => recordsFrom(recordsText));
  const moveDisagreements = compareMoves(fightCore, records), attributeDisagreements = compareAttributes(attributes, records);
  const moveRows = moveDisagreements.slice(1);
  yield* Effect.sync(() => {
    console.log(`FightCore rows: ${fightCore.length}; character-attribute rows: ${attributes.length}; records: ${records.length}`);
    console.log(`\n${moveDisagreements[0]?.startsWith("Compared ") === true ? moveDisagreements[0] : "Compared 0 fighter/move pairs."}\n`);
    console.log("| Fighter | Move | Field | FightCore | records.jsonl |\n|---|---|---|---:|---:|");
    console.log(moveRows.length === 0 ? "| — | — | no disagreements | — | — |" : moveRows.join("\n"));
    console.log("\nAttribute disagreements\n");
    console.log("| Fighter | Field | character-attributes.csv | records.jsonl |\n|---|---|---:|---:|");
    console.log(attributeDisagreements.length === 0 ? "| — | no disagreements | — | — |" : attributeDisagreements.map((line) => {
      const columns = line.split("|");
      return `| ${columns[1]?.trim() ?? ""} | ${columns[3]?.trim() ?? ""} | ${columns[4]?.trim() ?? ""} | ${columns[5]?.trim() ?? ""} |`;
    }).join("\n"));
    console.log(`\nTotal disagreements: ${moveRows.length + attributeDisagreements.length}`);
  });
});

if (import.meta.main) Effect.runPromise(main);
