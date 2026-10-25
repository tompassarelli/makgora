import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { Schema } from "effect";
import { ATTRIBUTE_COLUMNS, type AttributeField, type CharacterAttributes, attributeSource, readCharacterAttributes } from "../../../../references/melee-frame-data/character-attributes";
import { type FightCoreField, type FightCoreRow, fightCoreSource, readFightCore } from "../../../../references/melee-frame-data/fightcore";
import { FOX, type ReferenceFighter } from "../../meleeOracle";

export interface Cited<T> { readonly value: T; readonly source: string }

const ROOT = resolve(import.meta.dir, "../../../..");
const RECORDS_FILE = "references/melee-frame-data/records.jsonl";
const LIBMELEE_FILE = "references/melee-frame-data/libmelee.jsonl";
const PHASES_FILE = "references/melee-frame-data/fightcore-phases.jsonl";

const FrameRecord = Schema.Struct({
  character: Schema.String, category: Schema.String, action: Schema.NullOr(Schema.String),
  values: Schema.Record(Schema.String, Schema.NullOr(Schema.Finite)),
});
const Hitbox = Schema.Struct({ size: Schema.Finite, x: Schema.Finite, y: Schema.Finite });
const HitboxFrame = Schema.Struct({ frame: Schema.Finite, hitboxes: Schema.Array(Hitbox) });
const MotionRecord = Schema.Struct({ character: Schema.String, category: Schema.String, action: Schema.String, hitbox_frames: Schema.Array(HitboxFrame) });
export type HitboxFrame = typeof HitboxFrame.Type;
const PhaseHitbox = Schema.Struct({
  name: Schema.String, damage: Schema.Finite, angle: Schema.Finite, base_knockback: Schema.Finite, knockback_growth: Schema.Finite,
  set_knockback: Schema.Finite, effect: Schema.String, weight_independent: Schema.Boolean,
});
const Phase = Schema.Struct({ character: Schema.String, move: Schema.String, phase: Schema.Finite, start: Schema.Finite, end: Schema.Finite, hitboxes: Schema.Array(PhaseHitbox) });
export type Phase = typeof Phase.Type;

const jsonl = <S extends Schema.Top>(file: string, schema: S): S["Type"][] =>
  readFileSync(join(ROOT, file), "utf8").trim().split("\n").map((line) => {
    const value: unknown = JSON.parse(line);
    Schema.asserts(schema, value);
    return value;
  });

const MOVES = [
  { id: "jab1", fightCore: "Jab 1", category: "attacks", action: "jab1", phases: "jab1" },
  { id: "jab2", fightCore: "Jab 2", category: "attacks", action: "jab2", phases: "jab2" },
  { id: "rapidJab", fightCore: "Rapid Jabs", category: "attacks", action: "jab3", phases: "rjab" },
  { id: "forwardTilt", fightCore: "Forward Tilt", category: "attacks", action: "ftilt", phases: "ftilt" },
  { id: "upTilt", fightCore: "Up Tilt", category: "attacks", action: "utilt", phases: "utilt" },
  { id: "downTilt", fightCore: "Down Tilt", category: "attacks", action: "dtilt", phases: "dtilt" },
  { id: "dashAttack", fightCore: "Dashattack", category: "attacks", action: "dattack", phases: "dattack" },
  { id: "forwardSmash", fightCore: "Forward Smash", category: "attacks", action: "fsmash", phases: "fsmash" },
  { id: "upSmash", fightCore: "Up Smash", category: "attacks", action: "usmash", phases: "usmash" },
  { id: "downSmash", fightCore: "Down Smash", category: "attacks", action: "dsmash", phases: "dsmash" },
  { id: "neutralAir", fightCore: "Neutral Air", category: "attacks", action: "nair", phases: "nair" },
  { id: "forwardAir", fightCore: "Forward Air", category: "attacks", action: "fair", phases: "fair" },
  { id: "backAir", fightCore: "Back Air", category: "attacks", action: "bair", phases: "bair" },
  { id: "upAir", fightCore: "Up Air", category: "attacks", action: "uair", phases: "uair" },
  { id: "downAir", fightCore: "Down Air", category: "attacks", action: "dair", phases: "dair" },
  { id: "reflector", fightCore: "Reflector", category: "attacks", action: "down_b", phases: "downb" },
  { id: "aerialReflector", fightCore: "Reflector (Air)", category: "attacks", action: "adown_b", phases: "adownb" },
  { id: "grab", fightCore: "Grab", category: "grabs", action: "standing_grab", phases: "grab" },
  { id: "forwardThrow", fightCore: "Forward throw", category: "throws", action: "forward_throw", phases: "fthrow" },
  { id: "backThrow", fightCore: "Back throw", category: "throws", action: "back_throw", phases: "bthrow" },
  { id: "upThrow", fightCore: "Up throw", category: "throws", action: "up_throw", phases: "uthrow" },
  { id: "downThrow", fightCore: "Down throw", category: "throws", action: "down_throw", phases: "dthrow" },
] as const;
export type FoxMoveId = (typeof MOVES)[number]["id"];

const HITBOX_FIELDS = ["damage", "angle", "baseKnockback", "knockbackGrowth", "setKnockback", "effect", "timeline", "firstActive", "lastActive"] as const satisfies readonly FightCoreField[];
type HitboxField = (typeof HITBOX_FIELDS)[number];

export interface FoxMove {
  readonly id: FoxMoveId;
  readonly hitboxes: { readonly [F in HitboxField]: Cited<FightCoreRow[F]> };
  readonly frames: Readonly<Record<string, Cited<number | null>>> | null;
  readonly positions: Cited<readonly HitboxFrame[]> | null;
  readonly phases: Cited<readonly Phase[]>;
}

export interface FoxFixture {
  readonly attributes: { readonly [F in AttributeField]: Cited<CharacterAttributes[F]> };
  readonly moves: readonly FoxMove[];
}

interface Sources {
  readonly fightCore: readonly FightCoreRow[];
  readonly records: readonly (typeof FrameRecord.Type)[];
  readonly motion: readonly (typeof MotionRecord.Type)[];
  readonly phases: readonly Phase[];
}

function move(spec: (typeof MOVES)[number], { fightCore, records, motion, phases }: Sources): FoxMove {
  const row = fightCore.find((candidate) => candidate.character === "Fox" && candidate.move === spec.fightCore);
  if (row === undefined) throw new Error(`fightcore.csv has no Fox "${spec.fightCore}"`);
  const key = `(fox, ${spec.category}, ${spec.action})`;
  const record = records.find((candidate) => candidate.character === "fox" && candidate.category === spec.category && candidate.action === spec.action);
  const recorded = motion.find((candidate) => candidate.character === "fox" && candidate.category === spec.category && candidate.action === spec.action);
  return {
    id: spec.id,
    hitboxes: Object.fromEntries(HITBOX_FIELDS.map((field) => [field, { value: row[field], source: fightCoreSource(row, field) }])) as FoxMove["hitboxes"],
    frames: record === undefined ? null : Object.fromEntries(Object.entries(record.values).map(([field, value]) => [field, { value, source: `${RECORDS_FILE} ${key} values.${field}` }])),
    positions: recorded === undefined ? null : { value: recorded.hitbox_frames, source: `${LIBMELEE_FILE} ${key} hitbox_frames` },
    phases: { value: phases.filter((phase) => phase.character === "fox" && phase.move === spec.phases), source: `${PHASES_FILE} (fox, ${spec.phases})` },
  };
}

export function foxFixture(): FoxFixture {
  const fox = readCharacterAttributes(ROOT).find((row) => row.character === "Fox");
  if (fox === undefined) throw new Error("character-attributes.csv has no Fox row");
  const fields = Object.keys(ATTRIBUTE_COLUMNS) as AttributeField[];
  const sources: Sources = { fightCore: readFightCore(ROOT), records: jsonl(RECORDS_FILE, FrameRecord), motion: jsonl(LIBMELEE_FILE, MotionRecord), phases: jsonl(PHASES_FILE, Phase) };
  return {
    attributes: Object.fromEntries(fields.map((field) => [field, { value: fox[field], source: attributeSource("Fox", field) }])) as FoxFixture["attributes"],
    moves: MOVES.map((spec) => move(spec, sources)),
  };
}

const ORACLE_FIELDS = {
  jumpSquat: "jumpSquat", jumpVelocity: "jumpVelocity", hopVelocity: "hopVelocity", aerialJumpMultiplier: "aerialJumpMultiplier", gravity: "gravity",
  fastFallVelocity: "fastFallVelocity", dashInitialVelocity: "dashInitialVelocity", runVelocity: "runVelocity", walkVelocity: "walkVelocity",
} as const satisfies { readonly [F in keyof ReferenceFighter]: AttributeField };

const ORACLE_DIFFERENCES: Partial<Record<keyof ReferenceFighter, string>> = {};

export function oracleDifferences(fixture: FoxFixture): string[] {
  return (Object.keys(ORACLE_FIELDS) as (keyof ReferenceFighter)[]).flatMap((field) => {
    const cited = fixture.attributes[ORACLE_FIELDS[field]];
    const values = typeof cited.value === "number" ? [cited.value] : cited.value;
    const agrees = values.length === 1 && Math.fround(values[0] ?? Number.NaN) === Math.fround(FOX[field]);
    const named = ORACLE_DIFFERENCES[field];
    if (agrees && named !== undefined) return [`${field}: named as a difference ("${named}") but ${cited.source} now agrees with meleeOracle FOX`];
    if (!agrees && named === undefined) return [`${field}: meleeOracle FOX has ${FOX[field]}, ${cited.source} has ${values.join(" / ")}`];
    return [];
  });
}

export function fixtureGaps(fixture: FoxFixture): string[] {
  return fixture.moves.flatMap(({ id, frames, positions, phases, hitboxes: { damage, angle, firstActive, lastActive } }) => [
    ...(frames === null ? [`${id}: records.jsonl has no frames or landing lag`] : []),
    ...(positions === null ? [`${id}: libmelee.jsonl has no hitbox positions or radii`] : []),
    ...(damage.value.length > 0 && angle.value.length === 0 ? [`${id}: fightcore.csv gives damage but no angle`] : []),
    ...(phases.value.length === 0 ? [`${id}: fightcore-phases.jsonl has no phases`] : []),
    ...(damage.value.length > 1 && phases.value.length === 0 ? [`${id}: fightcore.csv gives ${damage.value.length} hitboxes but only the move's active frames ${firstActive.value}-${lastActive.value}, not each hitbox's`] : []),
  ]);
}

const RECORD_PAIRS = [["firstActive", "start"], ["lastActive", "end"]] as const;

export function sourceDisagreements(fixture: FoxFixture): string[] {
  return fixture.moves.flatMap(({ id, frames, hitboxes }) => {
    if (frames === null) return [];
    const damage = hitboxes.damage.value;
    const pairs: [string, number | null, string][] = [
      ...RECORD_PAIRS.map(([field, recorded]): [string, number | null, string] => [hitboxes[field].source, hitboxes[field].value, recorded]),
      [hitboxes.damage.source, damage.length === 0 ? null : Math.max(...damage), "percent"],
      [hitboxes.damage.source, damage.length < 2 ? null : Math.min(...damage), "percent_weak"],
    ];
    return pairs.flatMap(([source, value, recorded]) => {
      const other = frames[recorded];
      return other === undefined || other.value === value ? [] : [`${id}: ${source} = ${value}, ${other.source} = ${other.value}`];
    });
  });
}

if (import.meta.main) {
  for (const disagreement of sourceDisagreements(foxFixture())) console.log(`disagreement ${disagreement}`);
  const fixture = foxFixture();
  const differences = oracleDifferences(fixture);
  console.log(`attributes: ${Object.keys(fixture.attributes).length}, moves: ${fixture.moves.length}`);
  for (const gap of fixtureGaps(fixture)) console.log(`gap ${gap}`);
  for (const difference of differences) console.error(`difference ${difference}`);
  if (differences.length > 0) process.exit(1);
  console.log(`meleeOracle FOX agrees on ${Object.keys(ORACLE_FIELDS).join(", ")}`);
}
