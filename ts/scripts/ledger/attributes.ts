import { resolve } from "node:path";
import { CHARACTER_ATTRIBUTES_URL, type CharacterAttributes, readCharacterAttributes } from "../../../references/melee-frame-data/character-attributes";
import { Character } from "../../src/game/sim/codes";
import { SELECTABLE_CHARACTERS, fighterName, fighterSlug } from "../../src/game/roster/kits";
import { AUTHORED_PHYSICS, type FighterPhysics, HERO_VERTICAL, WORLD_UNITS_PER_MELEE_UNIT, authoredPhysics, melee } from "../../src/game/sim/tuning";
import { type FamilyNote, type LedgerRow, PARITY, type ReadSource, type Status, sameValue, shortNumber } from "./row";

const TUNING = "ts/src/game/sim/tuning.ts";
const BODIES = "ts/src/game/sim/heroes/heroBodies.ts";
const MELEE = readCharacterAttributes(resolve(import.meta.dir, "../../.."));

const rounded = (value: number): number => Number(value.toPrecision(6));

function world(value: number): number {
  for (let digits = 1; digits <= 6; digits++) {
    const units = Number((value / WORLD_UNITS_PER_MELEE_UNIT).toPrecision(digits));
    if (melee(Math.fround(units)) === value) return units;
  }
  return rounded(value / WORLD_UNITS_PER_MELEE_UNIT);
}

interface Attribute {
  readonly key: string;
  readonly name: string;
  readonly ours: (physics: FighterPhysics) => number;
  readonly melee: (fighter: CharacterAttributes) => readonly number[];
  readonly body?: true;
}

const ATTRIBUTES: readonly Attribute[] = [
  { key: "weight", name: "Weight", ours: (p) => rounded(p.weight), melee: (m) => m.weight, body: true },
  { key: "gravity", name: "Gravity", ours: (p) => world(p.gravity), melee: (m) => [m.gravity] },
  { key: "terminal", name: "Terminal speed", ours: (p) => world(p.terminalSpeed), melee: (m) => [m.terminalVelocity] },
  { key: "fast-fall", name: "Fast-fall speed", ours: (p) => world(p.fastFallSpeed), melee: (m) => [m.fastFallVelocity] },
  { key: "jump-squat", name: "Jump squat frames", ours: (p) => p.jumpSquatFrames, melee: (m) => [m.jumpSquat] },
  { key: "full-jump", name: "Full jump velocity", ours: (p) => world(p.fullJumpSpeed), melee: (m) => [m.jumpVelocity] },
  { key: "short-jump", name: "Short jump velocity", ours: (p) => world(p.shortJumpSpeed), melee: (m) => [m.hopVelocity] },
  { key: "double-jump", name: "Double jump velocity, against fighters with one double jump", ours: (p) => world(p.aerialJumpSpeed), melee: (m) => (m.jumps === 2 ? [m.jumpVelocity * m.aerialJumpMultiplier] : []) },
  { key: "air-speed", name: "Air speed", ours: (p) => world(p.airSpeed), melee: (m) => m.airSpeed, body: true },
  { key: "air-acceleration", name: "Air acceleration", ours: (p) => world(p.airAcceleration), melee: (m) => [m.airMobilityA + m.airMobilityB] },
  { key: "air-friction", name: "Air friction", ours: (p) => world(p.airFriction), melee: (m) => [m.airFriction] },
  { key: "dash", name: "Initial dash speed", ours: (p) => world(p.dashSpeed), melee: (m) => [m.dashInitialVelocity], body: true },
  { key: "run", name: "Run speed", ours: (p) => world(p.runSpeed), melee: (m) => m.runVelocity, body: true },
  { key: "walk", name: "Walk speed", ours: (p) => world(p.walkSpeed), melee: (m) => [m.walkVelocity], body: true },
  { key: "traction", name: "Traction", ours: (p) => world(p.traction), melee: (m) => [m.groundFriction], body: true },
];

const OUTSIDE_SPREAD = "ours, outside Melee's spread; needs Tom's decision";

const STATUS: Readonly<Record<string, Status>> = {
  "thrall-weight": { kind: "open", reason: OUTSIDE_SPREAD, issue: 293 },
  "cairne-bloodhoof-weight": { kind: "open", reason: OUTSIDE_SPREAD, issue: 293 },
};

function meleeFighter(name: string): CharacterAttributes {
  const found = MELEE.find(({ character }) => character === name);
  if (found === undefined) throw new Error(`references/melee-frame-data/character-attributes.csv has no ${name}`);
  return found;
}

const FOX = meleeFighter("Fox");
const FALCO = meleeFighter("Falco");

const valuesText = (values: readonly number[]): string => values.map(shortNumber).join("/");

const VERTICAL: ReadonlySet<string> = new Set(["gravity", "terminal", "fast-fall", "full-jump", "short-jump", "double-jump"]);
const ownVertical = (character: Character): boolean => HERO_VERTICAL[character] !== undefined;

function anchor(character: Character, attribute: Attribute): LedgerRow["anchor"] {
  if (attribute.body === true && character !== Character.rifleman && character !== Character.demonHunter) return { file: BODIES, symbol: "HERO_BODIES" };
  if (ownVertical(character) && VERTICAL.has(attribute.key)) return { file: TUNING, symbol: "HERO_VERTICAL" };
  return { file: TUNING, symbol: "AUTHORED_PHYSICS" };
}

function attributeRow(character: Character, attribute: Attribute): LedgerRow {
  const all = MELEE.flatMap(attribute.melee);
  const id = `${fighterSlug(character)}-${attribute.key}`;
  const original = character === Character.rifleman || character === Character.demonHunter;
  return {
    id, family: "attributes", block: fighterName(character), name: attribute.name,
    melee: {
      spread: [Math.min(...all), Math.max(...all)],
      note: ` (Fox ${valuesText(attribute.melee(FOX))}, Falco ${valuesText(attribute.melee(FALCO))})`,
      source: CHARACTER_ATTRIBUTES_URL,
    },
    ours: () => attribute.ours(authoredPhysics(character)),
    anchor: anchor(character, attribute),
    status: STATUS[id] ?? PARITY,
  };
}

export const ATTRIBUTE_ROWS: readonly LedgerRow[] = SELECTABLE_CHARACTERS.flatMap((character) => ATTRIBUTES.map((attribute) => attributeRow(character, attribute)));

const SHARED: readonly { readonly name: string; readonly ours: (physics: FighterPhysics) => number; readonly fox: number }[] = [
  { name: "gravity", ours: (p) => world(p.gravity), fox: FOX.gravity },
  { name: "fast fall", ours: (p) => world(p.fastFallSpeed), fox: FOX.fastFallVelocity },
  { name: "full jump", ours: (p) => world(p.fullJumpSpeed), fox: FOX.jumpVelocity },
  { name: "short jump", ours: (p) => world(p.shortJumpSpeed), fox: FOX.hopVelocity },
];

const INHERITED: readonly (keyof FighterPhysics)[] = [
  "gravity", "terminalSpeed", "fastFallSpeed", "jumpSquatFrames", "fullJumpSpeed", "shortJumpSpeed", "aerialJumpSpeed", "airAcceleration", "airFriction",
];

export function sharedRecordNote(read: ReadSource): FamilyNote {
  const reference = AUTHORED_PHYSICS.reference;
  const index = (read(TUNING) ?? "").split("\n").findIndex((line) => /^\s*reference: \{/.test(line));
  const line = index + 1;
  const show = (field: (p: FighterPhysics) => number): string => shortNumber(field(reference));
  const [gravity, fastFall, fullJump, shortJump] = SHARED.map(({ ours }) => show(ours));
  const heroes = SELECTABLE_CHARACTERS.filter((character) => character !== Character.rifleman && character !== Character.demonHunter);
  const own = heroes.filter(ownVertical);
  const problems = [
    ...(index < 0 ? [`attributes: the shared reference record no longer resolves in ${TUNING}`] : []),
    ...SHARED.filter(({ ours, fox }) => !sameValue(ours(reference), fox)).map(({ name, fox }) => `attributes: the shared record's ${name} is no longer Fox's ${shortNumber(fox)}`),
    ...heroes.flatMap((character) => INHERITED.filter((field) => !(field in (HERO_VERTICAL[character] ?? {})) && authoredPhysics(character)[field] !== reference[field]).map((field) => `attributes: ${fighterName(character)} no longer inherits the shared record's ${field}`)),
  ];
  return {
    family: "attributes",
    problems,
    lines: [
      `Every hero but Illidan and Rifleman inherits the shared \`reference\` record ([tuning.ts:${line}](../../${TUNING}#L${line})): its gravity ${gravity},`,
      `fast fall ${fastFall} and jumps ${fullJump}/${shortJump} are Fox's, and so are its terminal speed, jump squat, double jump, air acceleration`,
      "and air friction. A hero's body in `heroBodies.ts` sets only its weight, walk, dash and run speed, air speed and traction;",
      `${own.map(fighterName).join(", ")} instead ${own.length === 1 ? "takes" : "take"} gravity, terminal and fast-fall speed and jump velocities from \`HERO_VERTICAL\`.`,
      `Each block compares a fighter with Melee's spread across the ${MELEE.length} fighters in the [character attributes](${CHARACTER_ATTRIBUTES_URL}),`,
      "in Melee units, with Fox's and Falco's values beside it; a value outside the spread is a deviation or an open row.",
    ],
  };
}
