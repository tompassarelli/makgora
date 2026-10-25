import { readFileSync } from "node:fs";
import { join } from "node:path";
import { columnIndex, csvNumber, parseCsv, slashNumbers } from "./csv";

export const FIGHTCORE_FILE = "references/melee-frame-data/fightcore.csv";
export const FIGHTCORE_URL = "https://www.fightcore.gg";
export const SAKURAI_ANGLE = 361;

export const FIGHTCORE_SECTIONS = ["Air", "Grounded", "Tilt", "Special", "Grab/Throw", "Dodge", "Edge", "Getups/Techs"] as const;
export type FightCoreSection = (typeof FIGHTCORE_SECTIONS)[number];

export const FIGHTCORE_COLUMNS = {
  timeline: "Frame Timeline", firstActive: "First Active", lastActive: "Last Active", totalFrames: "Total Frames", iasa: "IASA",
  landingLag: "Landing lag", landingFallSpecialLag: "Landing fall special lag", autocancel: "Autocancel", damage: "Damage",
  angle: "Angle", effect: "Effect", baseKnockback: "Base Knockback", knockbackGrowth: "Knockback Growth", setKnockback: "Set Knockback",
} as const;
export type FightCoreField = keyof typeof FIGHTCORE_COLUMNS;

export interface FightCoreRow {
  readonly character: string;
  readonly section: FightCoreSection;
  readonly move: string;
  readonly timeline: readonly number[];
  readonly firstActive: number | null;
  readonly lastActive: number | null;
  readonly totalFrames: number | null;
  readonly iasa: number | null;
  readonly landingLag: number | null;
  readonly lCancelledLandingLag: number | null;
  readonly landingFallSpecialLag: number | null;
  readonly autocancel: { readonly before: number; readonly from: number } | null;
  readonly damage: readonly number[];
  readonly angle: readonly number[];
  readonly effect: readonly string[];
  readonly baseKnockback: readonly number[];
  readonly knockbackGrowth: readonly number[];
  readonly setKnockback: readonly number[];
}

const isSection = (text: string): text is FightCoreSection => (FIGHTCORE_SECTIONS as readonly string[]).includes(text);

const frame = (text: string, where: string): number | null => text === "-" || text === "" ? null : csvNumber(text, where);

function landing(text: string, where: string): { readonly landingLag: number | null; readonly lCancelledLandingLag: number | null } {
  const lagged = /^(\d+) \((\d+) L-Cancelled\)$/.exec(text);
  if (lagged !== null) return { landingLag: csvNumber(lagged[1] ?? "", where), lCancelledLandingLag: csvNumber(lagged[2] ?? "", where) };
  return { landingLag: frame(text, where), lCancelledLandingLag: null };
}

function autocancel(text: string, where: string): FightCoreRow["autocancel"] {
  if (text === "-" || text === "") return null;
  const window = /^<(\d+) (\d+)>$/.exec(text);
  if (window === null) throw new Error(`${where}: unexpected autocancel "${text}"`);
  return { before: csvNumber(window[1] ?? "", where), from: csvNumber(window[2] ?? "", where) };
}

export function parseFightCore(text: string): FightCoreRow[] {
  const [header, ...body] = parseCsv(text);
  if (header === undefined) throw new Error(`${FIGHTCORE_FILE}: empty`);
  const at = (name: string): number => columnIndex(header, name, FIGHTCORE_FILE);
  const columns = { character: at("Character"), section: at("Section"), move: at("Move"), ...Object.fromEntries(Object.entries(FIGHTCORE_COLUMNS).map(([field, name]) => [field, at(name)])) } as Record<FightCoreField | "character" | "section" | "move", number>;
  return body.map((cells, line) => {
    if (cells.length !== header.length) throw new Error(`${FIGHTCORE_FILE}:${line + 2}: ${cells.length} cells, header has ${header.length}`);
    const cell = (field: keyof typeof columns): string => cells[columns[field]] ?? "";
    const where = `${FIGHTCORE_FILE}:${line + 2}`;
    const section = cell("section");
    if (!isSection(section)) throw new Error(`${where}: unknown section "${section}"`);
    return {
      character: cell("character"), section, move: cell("move"),
      timeline: slashNumbers(cell("timeline").split(" ").join(" / "), where),
      firstActive: frame(cell("firstActive"), where), lastActive: frame(cell("lastActive"), where),
      totalFrames: frame(cell("totalFrames"), where), iasa: frame(cell("iasa"), where),
      ...landing(cell("landingLag"), where), landingFallSpecialLag: frame(cell("landingFallSpecialLag"), where),
      autocancel: autocancel(cell("autocancel"), where),
      damage: slashNumbers(cell("damage"), where, "%"), angle: slashNumbers(cell("angle"), where),
      effect: cell("effect") === "" ? [] : cell("effect").split(" / "),
      baseKnockback: slashNumbers(cell("baseKnockback"), where), knockbackGrowth: slashNumbers(cell("knockbackGrowth"), where),
      setKnockback: slashNumbers(cell("setKnockback"), where),
    };
  });
}

export function readFightCore(root: string): FightCoreRow[] {
  return parseFightCore(readFileSync(join(root, FIGHTCORE_FILE), "utf8"));
}

export function fightCoreSource(row: Pick<FightCoreRow, "character" | "section" | "move">, field: FightCoreField): string {
  return `${FIGHTCORE_URL} via ${FIGHTCORE_FILE} (${row.character}, ${row.section}, ${row.move}) ${FIGHTCORE_COLUMNS[field]}`;
}
