import { ATTRIBUTE_ROWS, sharedRecordNote } from "./attributes";
import { DEFENCE_ROWS } from "./defence";
import { HIT_ROWS } from "./hits";
import { MOVEMENT_ROWS } from "./movement";
import { type Anchor, FAMILY_TITLES, type Family, type FamilyNote, type LedgerRow, type Melee, type ReadSource, type Status, type Value, sameValue, shortNumber, showValue } from "./row";

export const LEDGER_ROWS: readonly LedgerRow[] = [...HIT_ROWS, ...DEFENCE_ROWS, ...MOVEMENT_ROWS, ...ATTRIBUTE_ROWS];

export const PAGE_PATH = "docs/design/melee-parity.md";

export interface Evaluated {
  readonly row: LedgerRow;
  readonly ours: Value | Error;
  readonly line: number | undefined;
  readonly checkLine: number | undefined;
}

export const familyNotes = (read: ReadSource): FamilyNote[] => [sharedRecordNote(read)];

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function anchorLine(anchor: Anchor, read: ReadSource): number | undefined {
  const text = read(anchor.file);
  if (text === undefined) return undefined;
  const symbol = escapeRegExp(anchor.symbol);
  const declaration = new RegExp(`^\\s*(export\\s+)?(const|let|function|interface|type|class|enum)\\s+${symbol}\\b`);
  const index = text.split("\n").findIndex((line) => declaration.test(line));
  return index < 0 ? undefined : index + 1;
}

function readOurs(row: LedgerRow): Value | Error {
  try {
    return row.ours();
  } catch (cause) {
    return cause instanceof Error ? cause : new Error(String(cause));
  }
}

export const evaluate = (rows: readonly LedgerRow[], read: ReadSource): Evaluated[] =>
  rows.map((row) => ({ row, ours: readOurs(row), line: anchorLine(row.anchor, read), checkLine: row.checkedBy === undefined ? undefined : anchorLine(row.checkedBy, read) }));

function rowProblems({ row, ours, line, checkLine }: Evaluated): string[] {
  const problems: string[] = [];
  if (!/^https:\/\/\S+$/.test(row.melee.source)) problems.push(`${row.id}: no public source`);
  if (line === undefined) problems.push(`${row.id}: anchor ${row.anchor.symbol} no longer resolves in ${row.anchor.file}`);
  if (row.checkedBy !== undefined && checkLine === undefined) problems.push(`${row.id}: check ${row.checkedBy.symbol} no longer resolves in ${row.checkedBy.file}`);
  if (row.status.kind === "deviation" && !/^\d{4}-\d{2}-\d{2}$/.test(row.status.decided)) problems.push(`${row.id}: deviation needs Tom's decision date as YYYY-MM-DD`);
  if (ours instanceof Error) return [...problems, `${row.id}: reading our value failed: ${ours.message}`];
  if ("spread" in row.melee) {
    const [low, high] = row.melee.spread;
    const inside = typeof ours === "number" && Math.fround(ours) >= Math.fround(low) && Math.fround(ours) <= Math.fround(high);
    if (inside && row.status.kind !== "parity") problems.push(`${row.id}: ${row.status.kind === "deviation" ? "deviation" : "open row"} is now inside Melee's spread; make it parity`);
    if (!inside && row.status.kind === "parity") problems.push(`${row.id}: ours ${showValue(ours)} is outside Melee's spread ${spreadText(row.melee.spread)} with no deviation row`);
    return problems;
  }
  if (!("value" in row.melee)) {
    if (row.status.kind === "parity") problems.push(`${row.id}: Melee's value is undocumented, so the row cannot be parity`);
    return problems;
  }
  const matches = sameValue(ours, row.melee.value);
  if (matches && row.status.kind !== "parity") problems.push(`${row.id}: ${row.status.kind === "deviation" ? "deviation" : "open row"} now matches Melee (${showValue(row.melee.value)}); make it parity`);
  if (!matches && row.status.kind === "parity") problems.push(`${row.id}: ours ${showValue(ours)} differs from Melee ${showValue(row.melee.value)} with no deviation row`);
  return problems;
}

export const spreadText = ([low, high]: readonly [number, number]): string => `${shortNumber(low)}–${shortNumber(high)}`;

export function ledgerProblems(evaluated: readonly Evaluated[], notes: readonly FamilyNote[]): string[] {
  const seen = new Set<string>();
  const duplicates = evaluated.filter(({ row }) => (seen.has(row.id) ? true : (seen.add(row.id), false))).map(({ row }) => `${row.id}: duplicate row id`);
  return [...duplicates, ...evaluated.flatMap(rowProblems), ...notes.flatMap(({ problems }) => problems)];
}

export const openRows = (evaluated: readonly Evaluated[]): Evaluated[] => evaluated.filter(({ row }) => row.status.kind === "open");

const cell = (text: string): string => text.replaceAll("|", "\\|").replaceAll("\n", " ");

const issueLink = (issue: number | undefined): string => (issue === undefined ? "" : `, #${issue}`);

export function statusText(status: Status): string {
  if (status.kind === "parity") return "parity";
  if (status.kind === "deviation") return `deviation: ${status.reason} (Tom ${status.decided}${issueLink(status.issue)})`;
  return `open: ${status.reason}${status.issue === undefined ? "" : ` (#${status.issue})`}`;
}

const meleeText = (melee: Melee): string =>
  "value" in melee ? showValue(melee.value) : "spread" in melee ? `${spreadText(melee.spread)}${melee.note}` : `not documented: ${melee.undocumented}`;

const codeLink = (anchor: Anchor, line: number | undefined): string => {
  const file = anchor.file.split("/").at(-1) ?? anchor.file;
  return line === undefined ? `${anchor.symbol} unresolved` : `[${file}:${line}](../../${anchor.file}#L${line}) \`${anchor.symbol}\``;
};

function rowLine({ row, ours, line, checkLine }: Evaluated): string {
  const melee = meleeText(row.melee);
  const code = row.checkedBy === undefined ? codeLink(row.anchor, line) : `${codeLink(row.anchor, line)}; checked by ${codeLink(row.checkedBy, checkLine)}`;
  const value = ours instanceof Error ? `error: ${ours.message}` : showValue(ours);
  return `| ${cell(row.name)} \`${row.id}\` | ${cell(value)} | [${cell(melee)}](${row.melee.source}) | ${code} | ${cell(statusText(row.status))} |`;
}

export function ledgerPage(evaluated: readonly Evaluated[], notes: readonly FamilyNote[]): string {
  const count = (kind: Status["kind"]): number => evaluated.filter(({ row }) => row.status.kind === kind).length;
  const families = [...new Set(evaluated.map(({ row }) => row.family))] as Family[];
  const table = (rows: readonly Evaluated[]): string[] => ["", "| Row | Ours | Melee | Code | Status |", "|---|---|---|---|---|", ...rows.map(rowLine)];
  const sections = families.flatMap((family) => {
    const rows = evaluated.filter(({ row }) => row.family === family);
    const blocks = [...new Set(rows.map(({ row }) => row.block))];
    const note = notes.filter((entry) => entry.family === family).flatMap(({ lines }) => ["", ...lines]);
    return [
      "",
      `## ${FAMILY_TITLES[family]}`,
      ...note,
      ...blocks.flatMap((block) => [
        ...(block === undefined ? [] : ["", `### ${block}`]),
        ...table(rows.filter(({ row }) => row.block === block)),
      ]),
    ];
  });
  return [
    "# Melee parity",
    "",
    "Generated by `bun wisp ledger` from the rows in `ts/scripts/ledger/`; never edit it by hand.",
    "`bun wisp ledger --check`, part of `bun run check`, fails when this page is stale",
    "(Autoland regenerates it on each merged candidate), when our value differs from Melee's with no deviation row, when a deviation now matches Melee, when a code anchor no longer",
    "resolves or when a row has no public source. Ours is read from the exported constant or probed headless;",
    "each Melee value links its public source. The plan is [melee-parity-plan.md](melee-parity-plan.md).",
    "",
    `${evaluated.length} rows: ${count("parity")} parity, ${count("deviation")} deviations, ${count("open")} open.`,
    ...sections,
    "",
  ].join("\n");
}
