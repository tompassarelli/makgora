import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { type CharacterAttributes, readCharacterAttributes } from "./character-attributes";
import { type FightCoreRow, readFightCore } from "./fightcore";

export const RECORDS_FILE = "references/melee-frame-data/records.jsonl";
export const LIBMELEE_FILE = "references/melee-frame-data/libmelee.jsonl";

export interface FrameRecord {
  readonly character: string;
  readonly category: string;
  readonly action: string | null;
  readonly values: Readonly<Record<string, number | null>>;
}

export function readRecords(root: string): FrameRecord[] {
  return readFileSync(join(root, RECORDS_FILE), "utf8").trim().split("\n").map((line, index) => {
    const parsed: unknown = JSON.parse(line);
    const where = `${RECORDS_FILE}:${index + 1}`;
    if (typeof parsed !== "object" || parsed === null) throw new Error(`${where}: not an object`);
    const { character, category, action, values } = parsed as Record<string, unknown>;
    if (typeof character !== "string" || typeof category !== "string" || !(action === null || typeof action === "string")) throw new Error(`${where}: bad key`);
    if (typeof values !== "object" || values === null) throw new Error(`${where}: no values`);
    for (const value of Object.values(values)) if (value !== null && typeof value !== "number") throw new Error(`${where}: non-numeric value`);
    return { character, category, action, values: values as Record<string, number | null> };
  });
}

export const recordCharacter = (fightCoreName: string): string => fightCoreName.toLowerCase().replaceAll(" ", "_");
const attributeCharacter = (name: string): string => recordCharacter(name.replace(/^Dr /, "Dr. ").replace(/^Game & Watch$/, "Mr. Game & Watch"));

interface Motion { readonly start: number | null; readonly end: number | null; readonly total: number; readonly iasa: number | null }

function readMotion(root: string): Map<string, Motion> {
  return new Map(readFileSync(join(root, LIBMELEE_FILE), "utf8").trim().split("\n").map((line) => {
    const record = JSON.parse(line) as { character: string; category: string; action: string; recorded_frames: number; first_iasa_frame: number | null; hitbox_frames: { frame: number }[] };
    return [`${record.character}/${record.category}/${record.action}`, {
      start: record.hitbox_frames[0]?.frame ?? null, end: record.hitbox_frames.at(-1)?.frame ?? null, total: record.recorded_frames, iasa: record.first_iasa_frame,
    }];
  }));
}

const AERIAL_LANDING_LAG: Readonly<Record<string, string>> = {
  nair: "N-Air Landing Lag", fair: "F-Air Landing Lag", bair: "B-Air Landing Lag", uair: "U-Air Landing Lag", dair: "D-Air Landing Lag",
};

export interface ThirdSources { readonly motion: ReadonlyMap<string, Motion>; readonly attributes: readonly CharacterAttributes[] }

function thirdSource(sources: ThirdSources, character: string, record: string, field: string): { readonly source: string; readonly value: number } | undefined {
  const id = recordCharacter(character);
  const motion = sources.motion.get(`${id}/${record}`);
  const recorded = field === "start" || field === "end" || field === "total" || field === "iasa" ? motion?.[field] : undefined;
  if (recorded !== undefined && recorded !== null) return { source: "libmelee", value: recorded };
  const column = field === "land_lag" ? AERIAL_LANDING_LAG[record.split("/")[1] ?? ""] : undefined;
  const cell = column === undefined ? undefined : sources.attributes.find((row) => attributeCharacter(row.character) === id)?.cells.get(column);
  return cell === undefined || cell === "" ? undefined : { source: "character attributes", value: Number(cell) };
}

const NORMALS: Readonly<Record<string, readonly [string, string]>> = {
  "Jab 1": ["attacks", "jab1"], "Jab 2": ["attacks", "jab2"], "Jab 3": ["attacks", "jab3"], "Rapid Jabs": ["attacks", "rjab"],
  Dashattack: ["attacks", "dattack"], "Forward Tilt": ["attacks", "ftilt"], "Up Tilt": ["attacks", "utilt"], "Down Tilt": ["attacks", "dtilt"],
  "Forward Smash": ["attacks", "fsmash"], "Up Smash": ["attacks", "usmash"], "Down Smash": ["attacks", "dsmash"],
  "Neutral Air": ["attacks", "nair"], "Forward Air": ["attacks", "fair"], "Back Air": ["attacks", "bair"], "Up Air": ["attacks", "uair"], "Down Air": ["attacks", "dair"],
  Grab: ["grabs", "standing_grab"], Dashgrab: ["grabs", "dash_grab"],
  "Forward throw": ["throws", "forward_throw"], "Back throw": ["throws", "back_throw"], "Up throw": ["throws", "up_throw"], "Down throw": ["throws", "down_throw"],
  Spotdodge: ["dodges", "spot_dodge"], Airdodge: ["dodges", "air_dodge"], "Roll forwards": ["dodges", "forward_roll"], "Roll backwards": ["dodges", "back_roll"],
};

type Slot = "neutral_b" | "side_b" | "up_b" | "down_b";
const [N, S, U, D]: readonly Slot[] = ["neutral_b", "side_b", "up_b", "down_b"];

// Each special's input slot by its SmashWiki name; FightCore's own spellings are kept as keys.
const SPECIALS: Readonly<Record<string, Readonly<Record<string, Slot | undefined>>>> = {
  Bowser: { "Fire Breath": N, "Koopa Klaw": S, "Whirling Fortress": U, "Bowser Bomb": D },
  "Captain Falcon": { "Falcon Punch": N, "Raptor Boost": S, "Falcon Dive": U, "Facon kick": D, "Falcon Kick": D },
  "Donkey Kong": { Headbutt: S, "Spinning Kong": U, "Hand Slap": D },
  "Dr. Mario": { Megavitamins: N, "Super Sheet": S, "Super Jump Punch": U, "Dr. Tornado": D },
  Falco: { Blaster: N, "Falco Phantasm": S, "Fire Bird": U, Reflector: D },
  Fox: { Blaster: N, "Fox Illusion": S, "Fire Fox": U, Reflector: D },
  Ganondorf: { "Warlock Punch": N, "Gerudo Dragon": S, "Dark Dive": U, "Wizard's Foot": D },
  "Ice Climbers": { "Ice Shot": N, "Squall Hammer": S, Belay: U, Blizzard: D },
  Jigglypuff: { "Neutral special ": N, Pound: S, Sing: U, Rest: D },
  Kirby: { Swallow: N, "Hammer Hit": S, "Hammer Spin": S, "Final Cutter": U, Stone: D },
  Link: { Boomerang: S, "Spin Attack": U, Bomb: D },
  Luigi: { Fireball: N, "Green Missile": S, "Super Jump Punch": U, "Luigi Cyclone": D },
  Mario: { Fireball: N, Cape: S, "Super Jump Punch": U, "Mario Tornado": D },
  Marth: { "Sword Dance (1, Side)": S, "Dolphin Slash": U, Counter: D },
  Mewtwo: { Confusion: S, Teleport: U, Disable: D },
  "Mr. Game & Watch": { Chef: N, Judgement: S, Fire: U, "Oil Panic": D },
  Ness: { "PK Flash": N, "PK Fire": S, "PK Thunder": U, "PSI Magnet": D },
  Peach: { Toad: N, "Peach Bomber": S, "Peach Parasol": U, Vegetable: D },
  Pichu: { "Thunder Jolt": N, Agility: U, Thunder: D },
  Pikachu: { "Thunder Jolt": N, "Quick Attack": U, Thunder: D },
  Roy: { "Flare Blade": N, "Double Edged Dance": S, Blazer: U, Counter: D },
  Samus: { "Homing Missle": S, "Screw Attack": U, Bomb: D },
  Sheik: { "Needle Storm": N, Chain: S, Vanish: U, "Up B": U, Transform: D },
  Yoshi: { "Egg Lay": N, "Side special": S, "Egg Throw": U, "Yoshi Bomb": D },
  "Young Link": { Boomerang: S, "Spin Attack": U, Bomb: D },
  Zelda: { "Nayru's Love": N, "Din's Fire": S, "Farores Wind": U, Transform: D },
};

export function recordKey(row: FightCoreRow): readonly [string, string] | undefined {
  if (row.section !== "Special") return NORMALS[row.move];
  const aerial = / \((?:Air|air)\)$/.exec(row.move);
  const slot = SPECIALS[row.character]?.[aerial === null ? row.move : row.move.slice(0, aerial.index)];
  return slot === undefined ? undefined : ["attacks", aerial === null ? slot : `a${slot}`];
}

const strongest = (damage: readonly number[]): number | null => damage.length === 0 ? null : Math.max(...damage);
const weakest = (damage: readonly number[]): number | null => damage.length < 2 ? null : Math.min(...damage);

const FIELDS: Readonly<Record<string, readonly (readonly [string, string, (row: FightCoreRow) => number | null])[]>> = {
  attacks: [
    ["start", "First Active", (row) => row.firstActive], ["end", "Last Active", (row) => row.lastActive],
    ["total", "Total Frames", (row) => row.totalFrames], ["iasa", "IASA", (row) => row.iasa],
    ["land_lag", "Landing lag", (row) => row.landingLag], ["cancel_lag", "Landing lag (L-Cancelled)", (row) => row.lCancelledLandingLag],
    ["auto_cancel_s", "Autocancel before", (row) => row.autocancel?.before ?? null], ["auto_cancel_e", "Autocancel from", (row) => row.autocancel?.from ?? null],
    ["percent", "Damage, strongest", (row) => strongest(row.damage)], ["percent_weak", "Damage, weakest", (row) => weakest(row.damage)],
  ],
  grabs: [["start", "First Active", (row) => row.firstActive], ["total", "Total Frames", (row) => row.totalFrames]],
  throws: [
    ["start", "First Active", (row) => row.firstActive], ["end", "Last Active", (row) => row.lastActive],
    ["total", "Total Frames", (row) => row.totalFrames], ["percent", "Damage, strongest", (row) => strongest(row.damage)],
  ],
  dodges: [["start", "First Active", (row) => row.firstActive], ["inv_end", "Last Active", (row) => row.lastActive], ["total", "Total Frames", (row) => row.totalFrames]],
};

export interface Disagreement {
  readonly character: string;
  readonly move: string;
  readonly record: string;
  readonly field: string;
  readonly fightCore: number;
  readonly records: number;
  readonly third: { readonly source: string; readonly value: number } | undefined;
}

export interface Comparison {
  readonly paired: number;
  readonly compared: number;
  readonly disagreements: readonly Disagreement[];
  readonly unpaired: readonly FightCoreRow[];
}

export function compareWithRecords(fightCore: readonly FightCoreRow[], records: readonly FrameRecord[], sources: ThirdSources): Comparison {
  const byKey = new Map(records.map((record) => [`${record.character}/${record.category}/${record.action}`, record]));
  const disagreements: Disagreement[] = [];
  const unpaired: FightCoreRow[] = [];
  let paired = 0, compared = 0;
  for (const row of fightCore) {
    if (row.section === "Edge" || row.section === "Getups/Techs") continue;
    const key = recordKey(row);
    const record = key === undefined ? undefined : byKey.get(`${recordCharacter(row.character)}/${key[0]}/${key[1]}`);
    if (key === undefined || record === undefined) { if (row.section !== "Grab/Throw" || row.move !== "Pummel") unpaired.push(row); continue; }
    paired++;
    for (const [field, column, read] of FIELDS[key[0]] ?? []) {
      const ours = read(row), theirs = record.values[field] ?? null;
      if (ours === null || theirs === null) continue;
      compared++;
      if (ours !== theirs) disagreements.push({ character: row.character, move: row.move, record: `${key[0]}/${key[1]}`, field: `${column} / ${field}`, fightCore: ours, records: theirs, third: thirdSource(sources, row.character, `${key[0]}/${key[1]}`, field) });
    }
  }
  return { paired, compared, disagreements, unpaired };
}

const MISC_PAIRS: readonly (readonly [string, string, (row: CharacterAttributes) => number])[] = [
  ["weight", "Weight", (row) => row.weight[0] ?? Number.NaN],
  ["gravity", "Terminal Velocity", (row) => row.terminalVelocity],
  ["gravity", "Fast Fall Terminal Velocity", (row) => row.fastFallVelocity],
  ["jump_squat", "JumpSquat Frames", (row) => row.jumpSquat],
  ["walk_speed", "Dash Initial Velocity", (row) => row.dashInitialVelocity],
  ["run_speed", "Dash & Run Terminal Velocity", (row) => row.runVelocity[0] ?? Number.NaN],
];

export interface AttributeRow { readonly character: string; readonly field: string; readonly column: string; readonly attributes: number; readonly records: number }

export function compareAttributes(attributes: readonly CharacterAttributes[], records: readonly FrameRecord[]): { readonly compared: number; readonly rows: readonly AttributeRow[] } {
  const misc = new Map(records.filter((record) => record.category === "misc").map((record) => [record.character, record]));
  const rows: AttributeRow[] = [];
  for (const fighter of attributes) {
    const id = attributeCharacter(fighter.character);
    const record = misc.get(id);
    if (record === undefined) throw new Error(`${RECORDS_FILE} has no misc row for ${fighter.character} (${id})`);
    for (const [field, column, read] of MISC_PAIRS) {
      const theirs = record.values[field];
      if (theirs === null || theirs === undefined) continue;
      rows.push({ character: fighter.character, field, column, attributes: read(fighter), records: theirs });
    }
  }
  return { compared: rows.length, rows };
}

export function sidesWith(row: Disagreement): "FightCore" | "records.jsonl" | "neither" | "no third source" {
  if (row.third === undefined) return "no third source";
  return row.third.value === row.fightCore ? "FightCore" : row.third.value === row.records ? "records.jsonl" : "neither";
}

function tally(disagreements: readonly Disagreement[]): string[] {
  const counts = new Map<string, Map<string, number>>();
  for (const row of disagreements) {
    const key = `${row.record.split("/")[0]} ${row.field}`;
    const sides = counts.get(key) ?? new Map<string, number>();
    sides.set(sidesWith(row), (sides.get(sidesWith(row)) ?? 0) + 1);
    counts.set(key, sides);
  }
  return [...counts].sort(([a], [b]) => a.localeCompare(b)).map(([key, sides]) => `- ${key}: ${[...sides].sort(([a], [b]) => a.localeCompare(b)).map(([side, count]) => `${side} ${count}`).join(", ")}`);
}

function report(root: string): string[] {
  const records = readRecords(root);
  const characterAttributes = readCharacterAttributes(root);
  const { paired, compared, disagreements, unpaired } = compareWithRecords(readFightCore(root), records, { motion: readMotion(root), attributes: characterAttributes });
  const lines = [
    `FightCore against ${RECORDS_FILE}: ${paired} moves paired, ${compared} values compared, ${disagreements.length} disagree.`, "",
    `Third source sides with, per field (libmelee's recorded frames, or the attributes' per-aerial landing lag):`, ...tally(disagreements), "",
    "| Fighter | FightCore move | records.jsonl | Field | FightCore | records.jsonl | Third source | Sides with |", "|---|---|---|---|---:|---:|---|---|",
    ...disagreements.map((row) => `| ${row.character} | ${row.move} | ${row.record} | ${row.field} | ${row.fightCore} | ${row.records} | ${row.third === undefined ? "" : `${row.third.source} ${row.third.value}`} | ${sidesWith(row)} |`), "",
    `FightCore rows with no records.jsonl move (${unpaired.length}): ${unpaired.map((row) => `${row.character} ${row.move}`).join("; ")}`, "",
  ];
  const attributes = compareAttributes(characterAttributes, records);
  const differing = (column: string): AttributeRow[] => attributes.rows.filter((row) => row.column === column && Math.fround(row.attributes) !== Math.fround(row.records));
  lines.push(`Character attributes against ${RECORDS_FILE} misc rows: ${attributes.compared} pairs.`, "");
  for (const [field, column] of MISC_PAIRS) {
    const rows = differing(column);
    lines.push(`- misc.${field} against ${column}: ${rows.length === 0 ? "all 26 agree" : rows.map((row) => `${row.character} ${row.attributes} against ${row.records}`).join("; ")}`);
  }
  return lines;
}

if (import.meta.main) console.log(report(resolve(import.meta.dir, "../..")).join("\n"));
