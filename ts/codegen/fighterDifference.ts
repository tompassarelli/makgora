import { FIGHTER_CONSTANTS, FIGHTER_DIFF_ORDER, FIGHTER_FIELDS, FIGHTER_GROUPS, fighterDiffName } from "../src/game/sim/state/fighterSchema";
import type { CanonKit, FighterFieldRow } from "../src/game/sim/state/fighterSchema";
import { arrayOf, groupKey, leaf } from "./fighterStateRows";

export const output = "src/generated/state/fighterDifference.ts";
export const producer = "ts/codegen/fighterDifference.ts";

const PACK_ANIMAL = "${animalName}";
const DIFF_KITS: Readonly<Partial<Record<CanonKit, string>>> = { moves: "fighterMovesCanonical", specials: "fighterSpecialsCanonical" };

type Need = (name: string, module: string) => string;

const reportingRows = (): ReadonlyMap<string, readonly FighterFieldRow[]> => {
  const named = new Map<string, FighterFieldRow[]>();
  for (const row of FIGHTER_FIELDS) {
    const name = fighterDiffName(row);
    if (name === undefined || row.path.startsWith("pack[]")) continue;
    named.set(name, [...(named.get(name) ?? []), row]);
  }
  for (const name of named.keys()) if (!FIGHTER_DIFF_ORDER.includes(name)) throw new Error(`${name} has no place in FIGHTER_DIFF_ORDER`);
  if (new Set(FIGHTER_DIFF_ORDER).size !== FIGHTER_DIFF_ORDER.length) throw new Error("FIGHTER_DIFF_ORDER repeats a name");
  return named;
};

const recordCheck = (rows: readonly FighterFieldRow[], name: string, reported: string): string => {
  const first = rows[0];
  if (first === undefined) throw new Error(`no row reports ${name}`);
  const base = first.path.slice(0, first.path.lastIndexOf("."));
  if (rows.some((row) => row.path.slice(0, row.path.lastIndexOf(".")) !== base || typeof row.diff !== "object")) throw new Error(`${name} rows share no record`);
  const keys = rows.map((row) => row.path.slice(base.length + 1));
  return `if (expected.${base} !== actual.${base} && (${keys.map((key) => `expected.${base}.${key} !== actual.${base}.${key}`).join(" || ")})) return ${reported};`;
};

const owner = (row: FighterFieldRow, fighter: "expected" | "actual", need: Need): string => {
  const key = groupKey(row);
  const lazy = FIGHTER_GROUPS.find((group) => group.key === key)?.lazy;
  return lazy === undefined ? `${fighter}.${key}` : `(${fighter}.${key} ?? ${need(lazy.resting, "sim/fighter")})`;
};

const operand = (row: FighterFieldRow, fighter: "expected" | "actual", animal: boolean, need: Need): string => {
  const array = arrayOf(row);
  const within = (path: string) => `${owner(row, fighter, need)}${path.slice(groupKey(row).length)}`;
  if (array === undefined) return animal ? `${fighter}Placed.${row.path.slice("placed.".length)}` : within(row.path);
  const prefix = animal ? `${fighter}Placed.${array.path.slice("placed.".length)}` : within(array.path);
  const module = FIGHTER_CONSTANTS[array.capacity];
  if (module === undefined) throw new Error(`no module for ${array.capacity}`);
  need(array.capacity, module);
  if (array.layout === "fieldMajor") return `${need("at", "wisp/src/runtime/lookup")}(${prefix}, i).${leaf(row, `${array.path}[].`)}`;
  if (array.bound === "length") return `${need("at", "wisp/src/runtime/lookup")}(${prefix}, i)`;
  return array.fallback === undefined ? `${prefix}[i]` : `(${prefix}[i] ?? ${array.fallback})`;
};

const differs = (row: FighterFieldRow, left: string, right: string, need: Need): string => {
  const diff = row.diff;
  if (row.type === "ref") {
    const kit = row.canon === "none" || row.canon.kit === undefined ? undefined : DIFF_KITS[row.canon.kit];
    if (kit === undefined) throw new Error(`${row.path}: a reference reports through a record or a canonical kit`);
    return `${left} !== ${right} && ${need(kit, "replay/kitCanonical")}(${left}) !== ${kit}(${right})`;
  }
  if (row.canon !== "none" && row.canon.writer === "slotRef") return `${need("differentSlot", "")}(${left}, ${right}, expectedMask, actualMask)`;
  if (typeof diff === "object" && "absent" in diff) return `(${left} ?? ${diff.absent}) !== (${right} ?? ${diff.absent})`;
  return `${left} !== ${right}`;
};

const fieldCheck = (rows: readonly FighterFieldRow[], name: string, reported: string, animal: boolean, need: Need): string => {
  const [row] = rows;
  if (row === undefined || rows.length !== 1) throw new Error(`${name} names ${rows.length} rows`);
  const check = `if (${differs(row, operand(row, "expected", animal, need), operand(row, "actual", animal, need), need)}) return ${reported};`;
  const array = arrayOf(row);
  return array === undefined ? check : `for (let i = 0; i < ${array.capacity}; i++) ${check}`;
};

const checks = (need: Need): string[] => {
  const named = reportingRows();
  const lines: string[] = [];
  let pack = false;
  for (const name of FIGHTER_DIFF_ORDER) {
    const rows = named.get(name);
    if (rows === undefined) throw new Error(`no row reports ${name}`);
    const animal = name.startsWith(PACK_ANIMAL);
    if (animal && !pack) {
      lines.push(
        "  const animals = Math.min(expected.pack.length, actual.pack.length);",
        "  for (let animal = 0; animal <= animals; animal++) {",
        `    const expectedPlaced = ${need("placedObject", "sim/fighter")}(expected, animal);`,
        "    const actualPlaced = placedObject(actual, animal);",
      );
    } else if (!animal && pack) lines.push("  }");
    pack = animal;
    const reported = name.includes("${") ? `\`${name.replace(PACK_ANIMAL, "${animalName(animal)}")}\`` : JSON.stringify(name);
    const diff = rows[0]?.diff;
    const check = typeof diff === "object" && "record" in diff ? recordCheck(rows, name, reported) : fieldCheck(rows, name, reported, animal, need);
    lines.push(`${pack ? "    " : "  "}${check}`);
  }
  if (pack) lines.push("  }");
  return lines;
};

const DIFFERENT_SLOT = [
  "function differentSlot(left: number | undefined, right: number | undefined, expectedMask: number, actualMask: number): boolean {",
  "  const leftSlot = canonicalSlot(left, expectedMask);",
  "  const rightSlot = canonicalSlot(right, actualMask);",
  "  return leftSlot !== rightSlot || leftSlot === -2 || rightSlot === -2;",
  "}",
  "",
];

export function renderFighterDifference(): string {
  const modules = new Map<string, Set<string>>();
  const need: Need = (name, module) => {
    modules.set(module, (modules.get(module) ?? new Set<string>()).add(name));
    return name;
  };
  const lines = checks(need);
  const slots = modules.get("")?.has("differentSlot") === true;
  modules.delete("");
  if (slots) need("canonicalSlot", "replay/canonical");
  const specifier = (module: string) => (module.startsWith("wisp/") ? module : `../../game/${module}`);
  const imports = [...modules].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([module, names]) => `import { ${[...names].sort().join(", ")} } from "${specifier(module)}";`);
  return [
    `// Generated by ${producer}; regenerate instead of editing.`,
    'import type { Fighter } from "../../game/sim/fighter";',
    ...imports,
    "",
    ...(slots ? DIFFERENT_SLOT : []),
    ...(FIGHTER_DIFF_ORDER.some((name) => name.startsWith(PACK_ANIMAL)) ? ['const animalName = (animal: number) => (animal === 0 ? "placed" : `pack[${animal - 1}]`);', ""] : []),
    "export function firstFighterDifference(expected: Readonly<Fighter>, actual: Readonly<Fighter>, expectedMask: number, actualMask: number): string | undefined {",
    ...lines,
    "  return undefined;",
    "}",
    "",
  ].join("\n");
}
