import { FIGHTER_ARRAYS, FIGHTER_FIELDS, FIGHTER_GROUPS, FIGHTER_SAME_ORDER } from "../src/game/sim/state/fighterSchema";
import type { FighterArray, FighterFieldRow, FighterGroup } from "../src/game/sim/state/fighterSchema";
import { PARTICIPANT_CAPACITY } from "../src/game/input/participants";
import { HERO_STATUS_GROUPS } from "../src/game/sim/codes";

export const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
export const sourceLocal = (local: string) => `source${capitalize(local)}`;

export const groupKey = (row: FighterFieldRow) => {
  if (row.path.startsWith("placed.") || row.path.startsWith("pack")) return "pack";
  if (row.path.startsWith("projectiles[]")) return "projectiles";
  const dot = row.path.indexOf(".");
  return dot < 0 ? "" : row.path.slice(0, dot);
};

export const arrayOf = (row: FighterFieldRow): FighterArray | undefined => {
  const marker = row.path.lastIndexOf("[]");
  if (marker < 0) return undefined;
  const path = row.path.slice(0, marker);
  return FIGHTER_ARRAYS.find((array) => array.path === path);
};

export const leaf = (row: FighterFieldRow, prefix: string) => row.path.slice(prefix.length);

export const rowsOf = (group: FighterGroup) => FIGHTER_FIELDS.filter((row) => groupKey(row) === group.key && !row.path.startsWith("pack[]"));

export const inSameOrder = (mode: "copy" | "same", group: string, rows: readonly FighterFieldRow[], prefix: string): readonly FighterFieldRow[] => {
  if (mode === "copy") return rows;
  const order = FIGHTER_SAME_ORDER[group] ?? [];
  const rank = (row: FighterFieldRow) => {
    const position = order.indexOf(leaf(row, prefix));
    return position < 0 ? order.length : position;
  };
  return rows.map((row, index) => ({ row, index })).sort((a, b) => rank(a.row) - rank(b.row) || a.index - b.index).map(({ row }) => row);
};

export const sameTest = (row: FighterFieldRow, a: string, b: string): string => {
  switch (row.same) {
    case "signedZero": return `${a} !== ${b} || (${a} === 0 && 1 / ${a} !== 1 / ${b})`;
    case "signedZeroOptional": return `${a} !== ${b} || (${a} === 0 && ${b} === 0 && 1 / ${a} !== 1 / ${b})`;
    case "plain": return `${a} !== ${b}`;
    case "sameReal": return `${a} !== ${b} || (${a} === 0 && 1 / ${a} !== 1 / ${b})`;
    case "none": throw new Error(`${row.path} has no same form`);
  }
};

export const sameLine = (row: FighterFieldRow, indent: string, a: string, b: string): string =>
  row.same === "plain" ? `${indent}if (${a} !== ${b}) return false;` : `${indent}{ const a = ${a}, b = ${b}; if (${sameTest(row, "a", "b")}) return false; }`;

export const copyValue = (row: FighterFieldRow, value: string) => (row.copy === "retained" ? `keep[${value} as number]` : value);

export const UNROLLED: Readonly<Record<string, number>> = { PARTICIPANT_CAPACITY, HERO_STATUS_GROUPS };

export const retainedSlots = () => {
  const masks: string[] = [];
  for (let mask = 1; mask < 1 << PARTICIPANT_CAPACITY; mask++) {
    const slots: string[] = [];
    for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) if ((mask & (1 << slot)) !== 0) slots.push(`${slot}: ${slot}`);
    masks.push(`${mask}: { ${slots.join(", ")} }`);
  }
  return masks.join(", ");
};

export const copyHalf = () => {
  const total = FIGHTER_GROUPS.reduce((sum, group) => sum + rowsOf(group).length, 0);
  let sum = 0;
  const index = FIGHTER_GROUPS.findIndex((group) => (sum += rowsOf(group).length) * 2 >= total);
  return index + 1;
};

export const keeps = (lines: readonly string[]) => (lines.some((line) => line.includes("keep[")) ? ", keep" : "");

export const copyPart = (name: string, lines: readonly string[]) => [
  `function ${name}(target: Fighter, source: Readonly<Fighter>${keeps(lines) === "" ? "" : ", keep: Readonly<Record<number, number | undefined>>"}): void {`,
  ...lines,
  "}",
];
