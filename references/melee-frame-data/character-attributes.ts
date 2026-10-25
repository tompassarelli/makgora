import { readFileSync } from "node:fs";
import { join } from "node:path";
import { columnIndex, csvNumber, parseCsv, slashNumbers } from "./csv";

export const CHARACTER_ATTRIBUTES_FILE = "references/melee-frame-data/character-attributes.csv";
export const CHARACTER_ATTRIBUTES_URL = "https://wiki.supercombo.gg/w/SSBM/Character_Attributes";

export const SCALAR_ATTRIBUTE_COLUMNS = {
  walkVelocity: "Walk Maximum Velocity", groundFriction: "Ground Friction/Stop Deccel", dashInitialVelocity: "Dash Initial Velocity",
  dashRunAccelerationA: "Dash & Run Acceleration A", dashRunAccelerationB: "Dash & Run Acceleration B", jumpSquat: "JumpSquat Frames",
  jumpHorizontalVelocity: "Jump H Initial Velocity", jumpVelocity: "Jump V Initial Velocity", hopVelocity: "Shorthop V Initial Velocity",
  aerialJumpMultiplier: "Air Jump Multiplier B (16)", jumps: "Number of Jumps", gravity: "Gravity", terminalVelocity: "Terminal Velocity",
  airMobilityA: "Air Mobility A", airMobilityB: "Air Mobility B", airFriction: "Air Friction", fastFallVelocity: "Fast Fall Terminal Velocity",
  normalLandingLag: "Normal Landing Lag",
} as const;
export const SLASHED_ATTRIBUTE_COLUMNS = { runVelocity: "Dash & Run Terminal Velocity", airSpeed: "Air Speed", weight: "Weight" } as const;
export const ATTRIBUTE_COLUMNS = { ...SCALAR_ATTRIBUTE_COLUMNS, ...SLASHED_ATTRIBUTE_COLUMNS } as const;
export type AttributeField = keyof typeof ATTRIBUTE_COLUMNS;

export type CharacterAttributes =
  { readonly character: string; readonly cells: ReadonlyMap<string, string> }
  & { readonly [field in keyof typeof SCALAR_ATTRIBUTE_COLUMNS]: number }
  & { readonly [field in keyof typeof SLASHED_ATTRIBUTE_COLUMNS]: readonly number[] };

function byColumn<C extends Readonly<Record<string, string>>, V>(columns: C, read: (name: string) => V): { readonly [K in keyof C]: V } {
  return Object.fromEntries(Object.entries(columns).map(([field, name]) => [field, read(name)])) as { readonly [K in keyof C]: V };
}

export function parseCharacterAttributes(text: string): CharacterAttributes[] {
  const [header, ...body] = parseCsv(text);
  if (header === undefined) throw new Error(`${CHARACTER_ATTRIBUTES_FILE}: empty`);
  const at = (name: string): number => columnIndex(header, name, CHARACTER_ATTRIBUTES_FILE);
  return body.map((cells, line) => {
    const where = `${CHARACTER_ATTRIBUTES_FILE}:${line + 2}`;
    if (cells.length !== header.length) throw new Error(`${where}: ${cells.length} cells, header has ${header.length}`);
    const cell = (name: string): string => cells[at(name)] ?? "";
    const character = cells[0] ?? "";
    if (character === "") throw new Error(`${where}: no fighter name`);
    const named = new Map(header.flatMap((name, index) => name === "" ? [] : [[name, cells[index] ?? ""] as const]));
    return {
      character, cells: named,
      ...byColumn(SCALAR_ATTRIBUTE_COLUMNS, (name) => csvNumber(cell(name), `${where} ${name}`)),
      ...byColumn(SLASHED_ATTRIBUTE_COLUMNS, (name) => slashNumbers(cell(name), `${where} ${name}`)),
    };
  });
}

export function readCharacterAttributes(root: string): CharacterAttributes[] {
  return parseCharacterAttributes(readFileSync(join(root, CHARACTER_ATTRIBUTES_FILE), "utf8"));
}

export function attributeSource(character: string, field: AttributeField): string {
  return `${CHARACTER_ATTRIBUTES_URL} via ${CHARACTER_ATTRIBUTES_FILE} (${character}) ${ATTRIBUTE_COLUMNS[field]}`;
}
