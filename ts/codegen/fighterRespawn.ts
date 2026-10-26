import { FIGHTER_CONSTANTS, FIGHTER_FIELDS, FIGHTER_GROUPS } from "../src/game/sim/state/fighterSchema";
import type { FighterArray, FighterFieldRow } from "../src/game/sim/state/fighterSchema";
import { arrayOf, groupKey, leaf } from "./fighterStateRows";

export interface RespawnEmit {
  readonly use: (name: string, module: string) => string;
  readonly capacity: (array: FighterArray) => string;
  readonly groupLocal: (key: string) => string;
}

export const respawnWalk = (phase: "blast" | "respawn", { use, capacity, groupLocal }: RespawnEmit): { readonly locals: readonly string[]; readonly body: readonly string[] } => {
  const lines: string[] = [];
  const locals = new Set<string>();
  let entries: FighterArray | undefined;
  const local = (key: string) => {
    locals.add(key);
    return groupLocal(key);
  };
  const close = () => {
    if (entries === undefined) return;
    lines.push("  }");
    entries = undefined;
  };
  // Values are emitted verbatim: Lua 5.3 keeps the integer 0 and the float 0.0 apart.
  const expression = (row: FighterFieldRow, value: string) => value.replace(/(^|[^.\w])([A-Za-z_]\w*)/g, (_, before: string, name: string) => {
    if (["undefined", "true", "false", "f"].includes(name) || (name === "startX" && phase === "respawn")) return `${before}${name}`;
    if (FIGHTER_GROUPS.some((group) => group.key === name)) return `${before}${local(name)}`;
    const module = FIGHTER_CONSTANTS[name];
    if (module === undefined) throw new Error(`${row.path}: ${phase} value ${value} names unknown ${name}`);
    return `${before}${use(name, module)}`;
  });
  for (const row of FIGHTER_FIELDS) {
    if (row.respawn === "keep" || row.respawn.helper !== undefined) continue;
    const value = row.respawn[phase];
    if (value === undefined) continue;
    if (FIGHTER_GROUPS.some((group) => group.key === groupKey(row) && group.rest !== undefined)) throw new Error(`${row.path} sits in a resting group, so its ${phase} reset needs that group's rest helper`);
    const array = arrayOf(row);
    const assigned = expression(row, value);
    if (array !== entries) close();
    if (array === undefined) {
      const dot = row.path.indexOf(".");
      if (dot < 0 || groupKey(row) === "pack" || groupKey(row) === "projectiles") throw new Error(`${row.path} needs a helper to respawn`);
      lines.push(`  ${local(row.path.slice(0, dot))}.${row.path.slice(dot + 1)} = ${assigned};`);
      continue;
    }
    const owner = array.path.slice(0, array.path.indexOf("."));
    const container = `${local(owner)}.${array.path.slice(owner.length + 1)}`;
    if (array.layout === "scalarArray" && array.bound === "capacity") {
      lines.push(`  for (let i = 0; i < ${capacity(array)}; i++) ${container}[i] = ${assigned};`);
      continue;
    }
    if (array.layout !== "fieldMajor" || array.mirror !== "inline") throw new Error(`${row.path} needs a helper to respawn`);
    if (entries !== array) {
      lines.push(`  for (let i = 0; i < ${capacity(array)}; i++) {`, `    const entry = ${use("at", "wisp/src/runtime/lookup")}(${container}, i);`);
      entries = array;
    }
    lines.push(`    entry.${leaf(row, `${array.path}[].`)} = ${assigned};`);
  }
  close();
  const declared = FIGHTER_GROUPS.filter((group) => locals.has(group.key)).map((group) => `  const ${group.local} = f.${group.key};`);
  return { locals: declared, body: lines };
};
