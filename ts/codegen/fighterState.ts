import { FIGHTER_ARRAYS, FIGHTER_CONSTANTS, FIGHTER_FIELDS, FIGHTER_GROUPS, FIGHTER_SAME_ORDER } from "../src/game/sim/state/fighterSchema";
import type { FighterArray, FighterFieldRow, FighterGroup } from "../src/game/sim/state/fighterSchema";

export const output = "src/generated/state/fighterState.ts";
export const producer = "ts/codegen/fighterState.ts";

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const sourceLocal = (local: string) => `source${capitalize(local)}`;

const groupKey = (row: FighterFieldRow) => {
  if (row.path.startsWith("placed.") || row.path.startsWith("pack")) return "pack";
  if (row.path.startsWith("projectiles[]")) return "projectiles";
  const dot = row.path.indexOf(".");
  return dot < 0 ? "" : row.path.slice(0, dot);
};

const arrayOf = (row: FighterFieldRow): FighterArray | undefined => {
  const marker = row.path.lastIndexOf("[]");
  if (marker < 0) return undefined;
  const path = row.path.slice(0, marker);
  return FIGHTER_ARRAYS.find((array) => array.path === path);
};

const leaf = (row: FighterFieldRow, prefix: string) => row.path.slice(prefix.length);

const rowsOf = (group: FighterGroup) => FIGHTER_FIELDS.filter((row) => groupKey(row) === group.key && !row.path.startsWith("pack[]"));

const inSameOrder = (mode: "copy" | "same", group: string, rows: readonly FighterFieldRow[], prefix: string): readonly FighterFieldRow[] => {
  if (mode === "copy") return rows;
  const order = FIGHTER_SAME_ORDER[group] ?? [];
  const rank = (row: FighterFieldRow) => {
    const position = order.indexOf(leaf(row, prefix));
    return position < 0 ? order.length : position;
  };
  return rows.map((row, index) => ({ row, index })).sort((a, b) => rank(a.row) - rank(b.row) || a.index - b.index).map(({ row }) => row);
};

const sameTest = (row: FighterFieldRow, a: string, b: string): string => {
  switch (row.same) {
    case "signedZero": return `${a} !== ${b} || (${a} === 0 && 1 / ${a} !== 1 / ${b})`;
    case "signedZeroOptional": return `${a} !== ${b} || (${a} === 0 && ${b} === 0 && 1 / ${a} !== 1 / ${b})`;
    case "plain": return `${a} !== ${b}`;
    case "sameReal": return `!sameReal(${a}, ${b})`;
    case "none": throw new Error(`${row.path} has no same form`);
  }
};

const copyValue = (row: FighterFieldRow, value: string) => (row.copy === "retained" ? `retained(activeMask, ${value})` : value);

const used = new Set<string>();
const capacity = (array: FighterArray) => {
  used.add(array.capacity);
  return array.capacity;
};

type Walk = (lines: string[], indent: string, target: string, source: string, rows: readonly FighterFieldRow[], prefix: string, group: string) => void;

const scalarArray = (mode: "copy" | "same", lines: string[], indent: string, target: string, source: string, row: FighterFieldRow, array: FighterArray) => {
  const index = array.index ?? "i";
  const name = array.path.slice(array.path.lastIndexOf(".") + 1);
  const to = `${target}.${name}`;
  const from = `${source}.${name}`;
  const fallback = array.fallback === undefined ? "" : ` ?? ${array.fallback}`;
  if (array.bound === "length") {
    lines.push(`${indent}const ${name} = ${to};`, `${indent}const ${sourceLocal(name)} = ${from};`);
    const loop = `${indent}for (let ${index} = 0; ${index} < ${name}.length; ${index}++)`;
    if (mode === "copy") lines.push(`${loop} ${name}[${index}] = ${copyValue(row, `${sourceLocal(name)}[${index}]${fallback}`)};`);
    else lines.push(`${loop} {`, `${indent}  const value = ${name}[${index}]${fallback};`, `${indent}  const other = ${sourceLocal(name)}[${index}]${fallback};`, `${indent}  if (${sameTest(row, "value", "other")}) return false;`, `${indent}}`);
    return;
  }
  const loop = `${indent}for (let ${index} = 0; ${index} < ${capacity(array)}; ${index}++)`;
  if (mode === "copy") lines.push(`${loop} ${to}[${index}] = ${copyValue(row, `${from}[${index}]${fallback}`)};`);
  else if (fallback === "") lines.push(`${loop} if (${sameTest(row, `${to}[${index}]`, `${from}[${index}]`)}) return false;`);
  else lines.push(`${loop} if (${sameTest(row, `(${to}[${index}]${fallback})`, `(${from}[${index}]${fallback})`)}) return false;`);
};

const inlineRecords = (mode: "copy" | "same", lines: string[], indent: string, target: string, source: string, rows: readonly FighterFieldRow[], array: FighterArray) => {
  const index = array.index ?? "i";
  const name = array.path.slice(array.path.lastIndexOf(".") + 1);
  lines.push(`${indent}let ${index} = 0;`, `${indent}for (const to of ${target}.${name}) {`, `${indent}  const from = ${source}.${name}[${index}++];`);
  lines.push(mode === "copy" ? `${indent}  if (from === undefined) throw new Error(\`no ${array.path} entry \${${index} - 1} to copy\`);` : `${indent}  if (from === undefined) return false;`);
  for (const row of rows) {
    const field = leaf(row, `${array.path}[].`);
    lines.push(mode === "copy" ? `${indent}  to.${field} = ${copyValue(row, `from.${field}`)};` : `${indent}  if (${sameTest(row, `to.${field}`, `from.${field}`)}) return false;`);
  }
  lines.push(`${indent}}`);
};

const walk = (mode: "copy" | "same"): Walk => (lines, indent, target, source, unordered, prefix, group) => {
  const done = new Set<string>();
  const rows = inSameOrder(mode, group, unordered, prefix);
  for (const row of rows) {
    const array = arrayOf(row);
    if (array !== undefined) {
      if (done.has(array.path)) continue;
      done.add(array.path);
      const members = rows.filter((other) => arrayOf(other) === array);
      if (array.layout === "scalarArray") {
        const owner = array.path.slice(0, array.path.lastIndexOf("."));
        const ownerPrefix = prefix === "" ? owner : prefix.slice(0, -1);
        if (ownerPrefix !== owner) throw new Error(`${array.path} sits outside ${prefix}`);
        scalarArray(mode, lines, indent, target, source, row, array);
      } else if (array.mirror === "inline") inlineRecords(mode, lines, indent, target, source, members, array);
      else throw new Error(`${array.path} needs its own walk`);
      continue;
    }
    if (row[mode] === "none") continue;
    const field = leaf(row, prefix);
    if (mode === "copy") lines.push(`${indent}${target}.${field} = ${copyValue(row, `${source}.${field}`)};`);
    else lines.push(`${indent}if (${sameTest(row, `${target}.${field}`, `${source}.${field}`)}) return false;`);
  }
};

const projectileFunctions = (): { readonly copy: string[]; readonly same: string[] } => {
  const array = FIGHTER_ARRAYS.find((candidate) => candidate.path === "projectiles");
  if (array === undefined || array.mirror !== "function" || array.iterate !== "source") throw new Error("projectiles need a source-iterated function mirror");
  const index = array.index ?? "index";
  const rows = FIGHTER_FIELDS.filter((row) => row.path.startsWith("projectiles[]."));
  const ordered = inSameOrder("same", "projectiles", rows, "projectiles[].");
  const field = (row: FighterFieldRow) => leaf(row, "projectiles[].");
  const plain = ordered.filter((row) => row.same === "plain").map((row) => `a.${field(row)} !== b.${field(row)}`);
  const reals = ordered.filter((row) => row.same === "sameReal").map((row) => `!sameReal(a.${field(row)}, b.${field(row)})`);
  if (plain.length + reals.length !== rows.length) throw new Error("projectile fields compare plain or sameReal");
  const copy = [
    "function copyFighterProjectiles(target: Fighter, source: Readonly<Fighter>): void {",
    "  const targets = target.projectiles;",
    `  let ${index} = 0;`,
    "  for (const from of source.projectiles) {",
    `    const to = targets[${index}++];`,
    `    if (to === undefined) throw new Error(\`no projectiles entry \${${index} - 1} to copy\`);`,
    ...rows.map((row) => `    to.${field(row)} = ${copyValue(row, `from.${field(row)}`)};`),
    "  }",
    "}",
  ];
  const same = [
    "function sameFighterProjectiles(target: Readonly<Fighter>, source: Readonly<Fighter>): boolean {",
    "  const targets = target.projectiles;",
    "  if (targets.length !== source.projectiles.length) return false;",
    `  let ${index} = 0;`,
    "  for (const b of source.projectiles) {",
    `    const a = targets[${index}++];`,
    "    if (a === undefined) return false;",
    "    if (a === b) continue;",
    `    if (${plain.join(" || ")}) return false;`,
    `    if (${reals.join(" || ")}) return false;`,
    "  }",
    "  return true;",
    "}",
    "",
    "const sameReal = (a: number, b: number) => a === b && (a !== 0 || 1 / a === 1 / b);",
  ];
  return { copy, same };
};

const packWalk = (mode: "copy" | "same", lines: string[], group: FighterGroup) => {
  const array = FIGHTER_ARRAYS.find((candidate) => candidate.path === "pack");
  if (array === undefined || array.layout !== "animalMajor") throw new Error("pack needs an animalMajor layout");
  const length = FIGHTER_FIELDS.find((row) => row.path === "pack.length");
  if (length === undefined) throw new Error("pack.length row is missing");
  const index = array.index ?? "animal";
  const local = group.local;
  const source = sourceLocal(local);
  if (mode === "copy") {
    if (length.copy !== "plain") throw new Error("pack.length copies plain");
    lines.push(
      "  const pack = target.pack;",
      "  const spares = packSpares(target);",
      "  while (pack.length < source.pack.length) pack[pack.length] = spares?.[pack.length] ?? createPlacedObject();",
      "  pack.length = source.pack.length;",
    );
  } else lines.push(`  if (${sameTest(length, "target.pack.length", "source.pack.length")}) return false;`);
  lines.push(`  for (let ${index} = 0; ${index} <= source.pack.length; ${index}++) {`, `    const ${local} = placedObject(target, ${index});`, `    const ${source} = placedObject(source, ${index});`);
  walk(mode)(lines, "    ", local, source, FIGHTER_FIELDS.filter((row) => row.path.startsWith("placed.")), "placed.", group.key);
  lines.push("  }");
};

const body = (mode: "copy" | "same"): string[] => {
  const lines: string[] = [];
  for (const group of FIGHTER_GROUPS) {
    if (group.key === "projectiles") {
      lines.push(mode === "copy" ? "  copyFighterProjectiles(target, source);" : "  if (!sameFighterProjectiles(target, source)) return false;");
      continue;
    }
    if (group.key === "pack") {
      packWalk(mode, lines, group);
      continue;
    }
    const rows = rowsOf(group);
    if (group.key === "") {
      walk(mode)(lines, "  ", "target", "source", rows, "", group.key);
      continue;
    }
    lines.push(`  const ${group.local} = target.${group.key};`, `  const ${sourceLocal(group.local)} = source.${group.key};`);
    walk(mode)(lines, "  ", group.local, sourceLocal(group.local), rows, `${group.key}.`, group.key);
  }
  return lines;
};

const checkCoverage = () => {
  const known = new Set(FIGHTER_GROUPS.map((group) => group.key));
  for (const row of FIGHTER_FIELDS) {
    if (!known.has(groupKey(row))) throw new Error(`${row.path} belongs to no group`);
    if (row.path.includes("[]") && arrayOf(row) === undefined) throw new Error(`${row.path} belongs to no array`);
  }
  const placed = FIGHTER_FIELDS.filter((row) => row.path.startsWith("placed.")).map((row) => `${row.path.slice(7)}|${row.copy}|${row.same}`);
  const pack = FIGHTER_FIELDS.filter((row) => row.path.startsWith("pack[].")).map((row) => `${row.path.slice(7)}|${row.copy}|${row.same}`);
  if (placed.join() !== pack.join()) throw new Error("pack[] rows must mirror placed rows");
};

export function renderFighterState(): string {
  checkCoverage();
  used.clear();
  const copy = body("copy");
  const same = body("same");
  const projectiles = projectileFunctions();
  const constants = [...used].sort();
  const modules = new Map<string, string[]>();
  for (const name of constants) {
    const module = FIGHTER_CONSTANTS[name];
    if (module === undefined) throw new Error(`no module for ${name}`);
    modules.set(module, [...(modules.get(module) ?? []), name]);
  }
  return [
    `// Generated by ${producer}; regenerate instead of editing.`,
    'import { createPlacedObject, packSpares, placedObject } from "../../game/sim/fighter";',
    'import type { Fighter } from "../../game/sim/fighter";',
    ...[...modules].map(([module, names]) => `import { ${names.join(", ")} } from "../../game/${module}";`),
    "",
    "const retained = (activeMask: number, slot: number | undefined) =>",
    "  (slot !== undefined && activeMask > 0 && activeMask < 16 && slot >= 0 && slot < 4 && (activeMask & (1 << slot)) !== 0 ? slot : undefined);",
    "",
    ...projectiles.copy,
    "",
    "export function copyFighterState(target: Fighter, source: Readonly<Fighter>, activeMask: number): void {",
    ...copy,
    "}",
    "",
    ...projectiles.same,
    "",
    "export function sameFighterState(target: Readonly<Fighter>, source: Readonly<Fighter>): boolean {",
    ...same,
    "  return true;",
    "}",
    "",
  ].join("\n");
}
