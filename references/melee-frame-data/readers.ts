import { Schema } from "effect";

export interface FightCoreRow {
  readonly character: string;
  readonly section: string;
  readonly move: string;
  readonly frameTimeline: readonly number[];
  readonly firstActive: number | null;
  readonly lastActive: number | null;
  readonly totalFrames: number | null;
  readonly iasa: number | null;
  readonly landingLag: number | null;
  readonly lCancelledLandingLag: number | null;
  readonly autocancel: { readonly before: number; readonly from: number } | null;
  readonly damage: readonly number[];
  readonly angles: readonly number[];
  readonly baseKnockback: readonly number[];
  readonly knockbackGrowth: readonly number[];
  readonly setKnockback: readonly number[];
}

export interface CharacterAttributesRow {
  readonly character: string;
  readonly walkInitialVelocity: number | null;
  readonly walkMaximumVelocity: number | null;
  readonly dashInitialVelocity: number | null;
  readonly dashAndRunTerminalVelocity: readonly number[];
  readonly maximumGroundVelocity: number | null;
  readonly jumpSquatFrames: number | null;
  readonly gravity: number | null;
  readonly terminalVelocity: number | null;
  readonly airSpeed: readonly number[];
  readonly fastFallTerminalVelocity: number | null;
  readonly weight: readonly number[];
  readonly normalLandingLag: number | null;
}

export interface MeleeRecord {
  readonly character: string;
  readonly category: string;
  readonly action: string | null;
  readonly values: Readonly<Record<string, number | null>>;
}

const CsvRow = Schema.Array(Schema.String);
const finite = (value: string, context: string): number => {
  const parsed = Number(value);
  if (value.trim() === "" || !Number.isFinite(parsed)) throw new Error(`${context}: expected a finite number, got ${JSON.stringify(value)}`);
  return parsed;
};

/** Parse RFC 4180 quoting, including quoted commas, escaped quotes and CRLF. */
export function parseCsv(text: string): readonly (readonly string[])[] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') { cell += '"'; index++; }
      else quoted = !quoted;
    } else if (character === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += character;
  }
  if (quoted) throw new Error("CSV ended inside a quoted field");
  if (cell !== "" || row.length > 0) { row.push(cell); rows.push(row); }
  return rows;
}

function table(text: string, expectedHeaders: readonly string[]): readonly Readonly<Record<string, string>>[] {
  const [header, ...body] = parseCsv(text);
  if (header === undefined) throw new Error("CSV has no header");
  for (const name of expectedHeaders) if (!header.includes(name)) throw new Error(`CSV is missing column ${JSON.stringify(name)}`);
  return body.filter((cells) => cells.some((cell) => cell.trim() !== "")).map((cells, index) => {
    const decoded = Schema.decodeUnknownSync(CsvRow)(cells);
    if (decoded.length !== header.length) throw new Error(`CSV row ${index + 2} has ${decoded.length} cells; expected ${header.length}`);
    const occurrences = new Map<string, number>();
    return Object.fromEntries(header.map((name, column) => {
      const occurrence = occurrences.get(name) ?? 0;
      occurrences.set(name, occurrence + 1);
      return [occurrence === 0 ? name : `${name}#${occurrence + 1}`, decoded[column] ?? ""];
    }));
  });
}

const nullableNumber = (value: string | undefined, label: string): number | null => value === undefined || value.trim() === "-" || value.trim() === "" ? null : finite(value, label);
const numbers = (value: string | undefined, label: string): readonly number[] => value === undefined || value.trim() === "-" || value.trim() === "" ? [] : value.split("/").map((part) => finite(part.trim().replace(/%$/, ""), label));

export function readFightCoreCsv(text: string): readonly FightCoreRow[] {
  const rows = table(text, ["Character", "Section", "Move", "Frame Timeline", "First Active", "Last Active", "Total Frames", "IASA", "Landing lag", "Autocancel", "Damage", "Angle", "Base Knockback", "Knockback Growth", "Set Knockback"]);
  return rows.map((row, index) => {
    const context = `FightCore row ${index + 2} (${row.Character} / ${row.Move})`;
    const landing = /^(\d+)\s*\((\d+)\s+L-Cancelled\)$/.exec(row["Landing lag"] ?? "");
    const autocancel = /^<(\d+)\s+(\d+)>$/.exec(row.Autocancel ?? "");
    const timeline = row["Frame Timeline"]?.trim() ?? "";
    return {
      character: row.Character ?? "", section: row.Section ?? "", move: row.Move ?? "",
      frameTimeline: timeline === "" || timeline === "-" ? [] : timeline.split(/\s+/).map((value) => finite(value, `${context} frame timeline`)),
      firstActive: nullableNumber(row["First Active"], `${context} first active`),
      lastActive: nullableNumber(row["Last Active"], `${context} last active`),
      totalFrames: nullableNumber(row["Total Frames"], `${context} total frames`),
      iasa: nullableNumber(row.IASA, `${context} IASA`),
      landingLag: landing === null ? nullableNumber(row["Landing lag"], `${context} landing lag`) : finite(landing[1] ?? "", context),
      lCancelledLandingLag: landing === null ? null : finite(landing[2] ?? "", context),
      autocancel: autocancel === null ? null : { before: finite(autocancel[1] ?? "", context), from: finite(autocancel[2] ?? "", context) },
      damage: numbers(row.Damage, `${context} damage`), angles: numbers(row.Angle, `${context} angle`),
      baseKnockback: numbers(row["Base Knockback"], `${context} base knockback`),
      knockbackGrowth: numbers(row["Knockback Growth"], `${context} growth`), setKnockback: numbers(row["Set Knockback"], `${context} set knockback`),
    };
  });
}

const ATTRIBUTE_COLUMNS = ["Walk Initial Velocity", "Walk Maximum Velocity", "Dash Initial Velocity", "Dash & Run Terminal Velocity", "Maximum Horizontal Velocity (on ground)", "JumpSquat Frames", "Gravity", "Terminal Velocity", "Air Speed", "Fast Fall Terminal Velocity", "Weight", "Normal Landing Lag"] as const;

export function readCharacterAttributesCsv(text: string): readonly CharacterAttributesRow[] {
  const [header, ...body] = parseCsv(text);
  if (header === undefined) throw new Error("Character attributes CSV has no header");
  for (const name of ATTRIBUTE_COLUMNS) if (!header.includes(name)) throw new Error(`Character attributes CSV is missing column ${JSON.stringify(name)}`);
  const rows = table(text, ATTRIBUTE_COLUMNS);
  const result = rows.map((row, index) => {
    const character = row[""] ?? "";
    if (character === "" || /^zz/i.test(character)) throw new Error(`Character attributes row ${index + 2} has no playable fighter name`);
    const value = (column: typeof ATTRIBUTE_COLUMNS[number]) => nullableNumber(row[column], `${character} ${column}`);
    return {
      character, walkInitialVelocity: value("Walk Initial Velocity"), walkMaximumVelocity: value("Walk Maximum Velocity"),
      dashInitialVelocity: value("Dash Initial Velocity"), dashAndRunTerminalVelocity: numbers(row["Dash & Run Terminal Velocity"], `${character} Dash & Run Terminal Velocity`),
      maximumGroundVelocity: value("Maximum Horizontal Velocity (on ground)"), jumpSquatFrames: value("JumpSquat Frames"),
      gravity: value("Gravity"), terminalVelocity: value("Terminal Velocity"), airSpeed: numbers(row["Air Speed"], `${character} Air Speed`),
      fastFallTerminalVelocity: value("Fast Fall Terminal Velocity"), weight: numbers(row.Weight, `${character} Weight`),
      normalLandingLag: value("Normal Landing Lag"),
    };
  });
  if (result.length !== 26) throw new Error(`Character attributes has ${result.length} fighters; expected 26`);
  if (new Set(result.map((row) => row.character)).size !== result.length) throw new Error("Character attributes has duplicate fighters");
  return result;
}
