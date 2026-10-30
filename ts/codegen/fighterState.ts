import { FIGHTER_ARRAYS, FIGHTER_CONSTANTS, FIGHTER_FIELDS, FIGHTER_GROUPS, FIGHTER_SAME_ORDER } from "../src/game/sim/state/fighterSchema";
import type { CanonColumn, CanonKit, FighterArray, FighterFieldRow, FighterGroup, Guard } from "../src/game/sim/state/fighterSchema";
import { UNROLLED, sameLine, arrayOf, copyHalf, copyPart, copyValue, groupKey, inSameOrder, keeps, leaf, packWalk, restWalk, retainedSlots, rowsOf, sameTest, sourceLocal } from "./fighterStateRows";
import { respawnWalk } from "./fighterRespawn";

export const output = "src/generated/state/fighterState.ts";
export const producer = "ts/codegen/fighterState.ts";


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
  const unrolled = UNROLLED[array.capacity];
  if (unrolled !== undefined) {
    const local = `${name}Copy`;
    lines.push(`${indent}const ${local} = ${to};`, `${indent}const ${sourceLocal(local)} = ${from};`);
    for (let element = 0; element < unrolled; element++) {
      if (mode === "copy") lines.push(`${indent}${local}[${element}] = ${copyValue(row, `${sourceLocal(local)}[${element}]${fallback}`)};`);
      else lines.push(sameLine(row, indent, fallback === "" ? `${local}[${element}]` : `(${local}[${element}]${fallback})`, fallback === "" ? `${sourceLocal(local)}[${element}]` : `(${sourceLocal(local)}[${element}]${fallback})`));
    }
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
  const hoisted = new Set<string>();
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
    const dot = field.indexOf(".");
    if (dot > 0) {
      const record = field.slice(0, dot);
      const local = `${record}Copy`;
      if (!hoisted.has(record)) {
        hoisted.add(record);
        lines.push(`${indent}const ${local} = ${target}.${record};`, `${indent}const ${sourceLocal(local)} = ${source}.${record};`);
      }
      const rest = field.slice(dot + 1);
      if (mode === "copy") lines.push(`${indent}${local}.${rest} = ${copyValue(row, `${sourceLocal(local)}.${rest}`)};`);
      else lines.push(sameLine(row, indent, `${local}.${rest}`, `${sourceLocal(local)}.${rest}`));
    } else if (mode === "copy") lines.push(`${indent}${target}.${field} = ${copyValue(row, `${source}.${field}`)};`);
    else lines.push(sameLine(row, indent, `${target}.${field}`, `${source}.${field}`));
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
  used.add(array.capacity);
  const last = `${array.capacity} - 1`;
  const copy = [
    "function copyFighterProjectiles(target: Fighter, source: Readonly<Fighter>): void {",
    "  const targets = target.projectiles;",
    "  const sources = source.projectiles;",
    "  const slots = source.projectileSlots;",
    "  const live = target.projectileSlots > slots ? target.projectileSlots : slots;",
    `  for (let ${index} = 0; ${index} < live; ${index}++) {`,
    `    const from = sources[${index}];`,
    `    const to: Projectile | undefined = targets[${index}];`,
    `    if (from === undefined || to === undefined) throw new Error(\`no projectiles entry \${${index}} to copy\`);`,
    ...rows.map((row) => `    to.${field(row)} = ${copyValue(row, `from.${field(row)}`)};`),
    "  }",
    `  const rest = sources[${last}];`,
    `  if (live < ${array.capacity} && rest !== undefined && targets[${last}]?.visualFamily !== rest.visualFamily) {`,
    `    for (let ${index} = live; ${index} < ${array.capacity}; ${index}++) {`,
    `      const to: Projectile | undefined = targets[${index}];`,
    `      if (to === undefined) throw new Error(\`no projectiles entry \${${index}} to copy\`);`,
    "      to.visualFamily = rest.visualFamily;",
    "    }",
    "  }",
    "  target.projectileSlots = slots;",
    "}",
  ];
  const same = [
    "function sameFighterProjectiles(target: Readonly<Fighter>, source: Readonly<Fighter>): boolean {",
    "  const targets = target.projectiles;",
    "  const sources = source.projectiles;",
    "  if (targets.length !== sources.length) return false;",
    "  const live = target.projectileSlots > source.projectileSlots ? target.projectileSlots : source.projectileSlots;",
    `  for (let ${index} = 0; ${index} < live; ${index}++) {`,
    `    const a = targets[${index}];`,
    `    const b = sources[${index}];`,
    "    if (a === undefined || b === undefined) return false;",
    "    if (a === b) continue;",
    `    if (${plain.join(" || ")}) return false;`,
    `    if (${reals.join(" || ")}) return false;`,
    "  }",
    `  return live >= ${array.capacity} || targets[${last}]?.visualFamily === sources[${last}]?.visualFamily;`,
    "}",
    "",
    "const sameReal = (a: number, b: number) => a === b && (a !== 0 || 1 / a === 1 / b);",
  ];
  return { copy, same };
};

const restTypes = new Set<string>();

const body = (mode: "copy" | "same", groups: readonly FighterGroup[] = FIGHTER_GROUPS): string[] => {
  const lines: string[] = [];
  for (const group of groups) {
    if (group.key === "projectiles") {
      lines.push(mode === "copy" ? "  copyFighterProjectiles(target, source);" : "  if (!sameFighterProjectiles(target, source)) return false;");
      continue;
    }
    if (group.key === "pack") {
      packWalk(mode, lines, group, use(group.rest ?? "", "sim/fighterRest"), (indent, local, source) => walk(mode)(lines, indent, local, source, FIGHTER_FIELDS.filter((row) => row.path.startsWith("placed.")), "placed.", group.key), used);
      continue;
    }
    const rows = rowsOf(group);
    if (group.key === "") {
      walk(mode)(lines, "  ", "target", "source", rows, "", group.key);
      continue;
    }
    if (group.rest !== undefined) {
      if (mode === "copy") restTypes.add(group.type);
      restWalk(mode, lines, group, rows, use(group.rest, "sim/fighterRest"), (indent) => walk(mode)(lines, indent, group.local, sourceLocal(group.local), rows, `${group.key}.`, group.key), used);
      continue;
    }
    lines.push(`  const ${group.local} = target.${group.key};`, `  const ${sourceLocal(group.local)} = source.${group.key};`);
    walk(mode)(lines, "  ", group.local, sourceLocal(group.local), rows, `${group.key}.`, group.key);
  }
  return lines;
};

const imported = new Map<string, string>();
const use = (name: string, module: string) => {
  imported.set(name, module);
  return name;
};

const FIELD_GUARDS: Readonly<Partial<Record<Guard, (value: string) => string>>> = {
  nonzero: (value) => `${value} !== 0`,
  nonzeroSigned: (value) => `${value} !== 0 || 1 / ${value} < 0`,
  cooldownSlot: (value) => `i < ${use("SpecialAction", "sim/codes")}.heroNeutral || ${value} !== 0`,
  defined: (value) => `${value} !== undefined`,
};

const GROUP_GUARDS: Readonly<Partial<Record<Guard, () => string>>> = {
  specials: () => "tuning.specials !== undefined",
  beamPair: () => "special.beamX !== 0 || special.beamZ !== 0 || 1 / special.beamX < 0 || 1 / special.beamZ < 0",
  buff: () => "status.buff !== 0 || status.buffFrames !== 0",
  condition: () => "status.condition !== 0 || anyNonzero(status.conditionImmunity)",
  poison: () => "status.poisonFrames !== 0",
  duo: () => "duo.role !== 0",
};

const ELEMENT_GUARDS: Readonly<Partial<Record<Guard, () => string>>> = {
  companion: () => "placed.spec?.companion !== undefined",
};

const KIT_TYPES: Readonly<Record<CanonKit, string>> = {
  moves: 'Readonly<Fighter>["tuning"]["moves"]',
  specials: 'Readonly<Fighter>["tuning"]["specials"]',
  placedSpec: 'Readonly<Fighter>["placed"]["spec"]',
  projectileSpec: 'NonNullable<Readonly<Fighter>["projectiles"][number]["spec"]>',
};

interface CanonScope {
  readonly key: string;
  readonly open: readonly string[];
}

const groupLocal = (key: string) => {
  const group = FIGHTER_GROUPS.find((candidate) => candidate.key === key);
  if (group === undefined) throw new Error(`no group ${key}`);
  return group.local;
};

const canonOf = (row: FighterFieldRow): CanonColumn => {
  if (row.canon === "none") throw new Error(`${row.path} is not canonical`);
  return row.canon;
};

const nameExpression = (name: string, animal: boolean) => {
  if (animal) {
    if (!name.startsWith("placed")) throw new Error(`${name} must start with placed`);
    return `\`\${animalName}${name.slice("placed".length)}\``;
  }
  return name.includes("${") ? `\`${name}\`` : JSON.stringify(name);
};

const canonWalk = (): { readonly locals: readonly string[]; readonly body: readonly string[] } => {
  const lines: string[] = [];
  const locals = new Set<string>();
  const open: CanonScope[] = [];
  let loops = 0;
  let lastLoop = "";
  const local = (key: string) => {
    locals.add(key);
    return groupLocal(key);
  };
  const indentOf = (depth: number) => "  ".repeat(depth + 1);
  for (const row of FIGHTER_FIELDS) {
    if (row.canon === "none" || row.path.startsWith("pack[]")) continue;
    const canon = canonOf(row);
    const when = canon.when ?? [];
    for (const guard of when) if (FIELD_GUARDS[guard] === undefined && GROUP_GUARDS[guard] === undefined && ELEMENT_GUARDS[guard] === undefined) throw new Error(`${row.path}: unknown guard ${guard}`);
    const scopes: CanonScope[] = [];
    for (const guard of when) {
      const expression = GROUP_GUARDS[guard];
      if (expression !== undefined) scopes.push({ key: `guard:${guard}`, open: [`if (${expression()}) {`] });
    }
    const animal = row.path.startsWith("placed.");
    if (animal) {
      scopes.push({
        key: "loop:pack",
        open: [
          "for (let animal = 0; animal <= fighter.pack.length; animal++) {",
          "  const placed = placedObject(fighter, animal);",
          '  const animalName = animal === 0 ? "placed" : `pack[${animal - 1}]`;',
        ],
      });
    }
    for (const guard of when) {
      const expression = ELEMENT_GUARDS[guard];
      if (expression === undefined) continue;
      if (!animal) throw new Error(`${row.path}: ${guard} guards a placed object`);
      scopes.push({ key: `guard:${guard}`, open: [`if (${expression()}) {`] });
    }
    const array = arrayOf(row);
    let value: string;
    if (array === undefined) {
      const dot = row.path.indexOf(".");
      if (animal) value = `placed.${row.path.slice("placed.".length)}`;
      else if (dot < 0) value = `fighter.${row.path}`;
      else value = `${local(row.path.slice(0, dot))}.${row.path.slice(dot + 1)}`;
    } else {
      const loop = canon.sharedLoop === true ? lastLoop : `loop:${array.path}#${loops++}`;
      if (canon.sharedLoop === true && !lastLoop.startsWith(`loop:${array.path}#`)) throw new Error(`${row.path} shares no ${array.path} loop`);
      lastLoop = loop;
      const owner = array.path.includes(".") ? array.path.slice(0, array.path.indexOf(".")) : "";
      const container = animal ? `placed.${array.path.slice(array.path.indexOf(".") + 1)}` : owner === "" ? `fighter.${array.path}` : `${local(owner)}.${array.path.slice(owner.length + 1)}`;
      const head = `for (let i = 0; i < ${capacity(array)}; i++) {`;
      if (array.layout === "fieldMajor") {
        const element = array.path === "projectiles" ? "projectile" : "entry";
        scopes.push({ key: loop, open: [head, `  const ${element} = ${use("at", "wisp/src/runtime/lookup")}(${container}, i);`] });
        value = `${element}.${leaf(row, `${array.path}[].`)}`;
      } else if (array.layout === "scalarArray") {
        scopes.push({ key: loop, open: [head] });
        value = `${container}[i]${array.fallback === undefined ? "" : ` ?? ${array.fallback}`}`;
      } else throw new Error(`${row.path}: ${array.layout} is not a canonical loop`);
    }
    let shared = 0;
    while (shared < open.length && shared < scopes.length && open[shared]?.key === scopes[shared]?.key) shared++;
    while (open.length > shared) {
      open.pop();
      lines.push(`${indentOf(open.length)}}`);
    }
    for (const scope of scopes.slice(shared)) {
      const indent = indentOf(open.length);
      for (const line of scope.open) lines.push(`${indent}${line}`);
      open.push(scope);
    }
    const indent = indentOf(open.length);
    const name = nameExpression(canon.name, animal);
    const fieldGuards = when.filter((guard) => FIELD_GUARDS[guard] !== undefined);
    if (fieldGuards.length > 1) throw new Error(`${row.path} has more than one field guard`);
    const fieldGuard = fieldGuards[0];
    let guarded = "";
    if (fieldGuard !== undefined) {
      if (!/^[\w.]+$/.test(value)) {
        lines.push(`${indent}const value = ${value};`);
        value = "value";
      }
      guarded = `if (${FIELD_GUARDS[fieldGuard]?.(value)}) `;
    }
    const kit = () => {
      if (canon.kit === undefined) throw new Error(`${row.path} names no kit`);
      return canon.kit;
    };
    const named = animal ? `\`\${prefix}.\${animalName}${canon.name.slice("placed".length)}\`` : `\`\${prefix}.${canon.name}\``;
    switch (canon.writer) {
      case "int": lines.push(`${indent}${guarded}sink.int(prefix, ${name}, ${value});`); break;
      case "real": lines.push(`${indent}${guarded}sink.real(prefix, ${name}, ${value});`); break;
      case "bool": lines.push(`${indent}${guarded}sink.bool(prefix, ${name}, ${value});`); break;
      case "boolAsInt": lines.push(`${indent}${guarded}sink.int(prefix, ${name}, ${value} ? 1 : 0);`); break;
      case "flagInt": lines.push(`${indent}if (${value}) sink.int(prefix, ${name}, 1);`); break;
      case "flagBool": lines.push(`${indent}if (${value}) sink.bool(prefix, ${name}, true);`); break;
      case "optionalInt": lines.push(`${indent}${guarded}sink.int(prefix, ${name}, ${value} ?? -1);`); break;
      case "slotRef": lines.push(`${indent}${guarded}sink.int(prefix, ${name}, kits.slot(${value}, participantMask));`); break;
      case "digest": lines.push(`${indent}${guarded}sink.text(kits.${kit()}(${named}, ${value}));`); break;
      case "specText": lines.push(`${indent}${guarded}sink.text(kits.${kit()}(${value}, ${named}));`); break;
    }
    if ((canon.writer === "flagInt" || canon.writer === "flagBool") && fieldGuard !== undefined) throw new Error(`${row.path}: a flag writer takes no field guard`);
    if ((canon.writer === "digest" || canon.writer === "specText") !== (canon.kit !== undefined)) throw new Error(`${row.path}: only digest and specText writers name a kit`);
  }
  while (open.length > 0) {
    open.pop();
    lines.push(`${indentOf(open.length)}}`);
  }
  const declared = FIGHTER_GROUPS.filter((group) => locals.has(group.key)).map((group) => `  const ${group.local} = fighter.${group.key};`);
  return { locals: declared, body: lines };
};

const kitInterface = (): string[] => [
  "export interface FighterFieldSink {",
  "  int(prefix: string, name: string, value: number): void;",
  "  bool(prefix: string, name: string, value: boolean): void;",
  "  real(prefix: string, name: string, value: number): void;",
  "  text(fragment: string): void;",
  "}",
  "",
  "export interface FighterKitText {",
  "  slot(slot: number | undefined, participantMask: number): number;",
  ...(Object.keys(KIT_TYPES) as CanonKit[]).map((kit) =>
    kit === "projectileSpec" ? `  ${kit}(spec: ${KIT_TYPES[kit]}, prefix: string): string;` : `  ${kit}(name: string, kit: ${KIT_TYPES[kit]}): string;`),
  "}",
  "",
  "function anyNonzero(values: readonly number[]): boolean {",
  "  for (let i = 0; i < values.length; i++) if (values[i] !== 0) return true;",
  "  return false;",
  "}",
];

const checkPackCanon = () => {
  for (const row of FIGHTER_FIELDS.filter((candidate) => candidate.path.startsWith("pack[]."))) {
    const placed = FIGHTER_FIELDS.find((candidate) => candidate.path === `placed.${row.path.slice("pack[].".length)}`);
    if (placed === undefined) throw new Error(`${row.path} has no placed row`);
    if (row.canon === "none" || placed.canon === "none") {
      if (row.canon !== placed.canon) throw new Error(`${row.path} and its placed row disagree on canon`);
      continue;
    }
    const expected = `pack[\${animal-1}]${placed.canon.name.slice("placed".length)}`;
    if (row.canon.name !== expected || row.canon.writer !== placed.canon.writer || (row.canon.when ?? []).join() !== (placed.canon.when ?? []).join() || row.canon.kit !== placed.canon.kit) {
      throw new Error(`${row.path} canon must mirror ${placed.path} as ${expected}`);
    }
  }
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
  checkPackCanon();
  used.clear();
  imported.clear();
  restTypes.clear();
  const half = copyHalf();
  const copyHead = body("copy", FIGHTER_GROUPS.slice(0, half));
  const copyTail = body("copy", FIGHTER_GROUPS.slice(half));
  const sameHead = body("same", FIGHTER_GROUPS.slice(0, half));
  const sameTail = body("same", FIGHTER_GROUPS.slice(half));
  const projectiles = projectileFunctions();
  const canon = canonWalk();
  const blast = respawnWalk("blast", { use, capacity, groupLocal });
  const respawn = respawnWalk("respawn", { use, capacity, groupLocal });
  for (const name of used) {
    const module = FIGHTER_CONSTANTS[name];
    if (module === undefined) throw new Error(`no module for ${name}`);
    use(name, module);
  }
  const modules = new Map<string, string[]>();
  for (const name of [...imported.keys()].sort()) {
    const module = imported.get(name) ?? "";
    modules.set(module, [...(modules.get(module) ?? []), name]);
  }
  const specifier = (module: string) => (module.startsWith("wisp/") ? module : `../../game/${module}`);
  const fighterNames = ["createPlacedObject", "packSpares", "placedObject", ...(modules.get("sim/fighter") ?? [])].sort();
  modules.delete("sim/fighter");
  return [
    `// Generated by ${producer}; regenerate instead of editing.`,
    `import { ${fighterNames.join(", ")} } from "../../game/sim/fighter";`,
    'import type { Fighter, PlacedObject, Projectile } from "../../game/sim/fighter";',
    ...(restTypes.size > 0 ? [`import type { ${[...restTypes].sort().join(", ")} } from "../../game/sim/fighterRest";`] : []),
    ...[...modules].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([module, names]) => `import { ${names.join(", ")} } from "${specifier(module)}";`),
    "",
    "const NO_SLOTS: Readonly<Record<number, number | undefined>> = {};",
    `const RETAINED_SLOTS: Readonly<Record<number, Readonly<Record<number, number | undefined>>>> = { ${retainedSlots()} };`,
    "",
    ...projectiles.copy,
    "",
    ...copyPart("copyFighterHead", copyHead),
    "",
    ...copyPart("copyFighterTail", copyTail),
    "",
    "export function copyFighterState(target: Fighter, source: Readonly<Fighter>, activeMask: number): void {",
    "  const keep = RETAINED_SLOTS[activeMask] ?? NO_SLOTS;",
    `  copyFighterHead(target, source${keeps(copyHead)});`,
    `  copyFighterTail(target, source${keeps(copyTail)});`,
    ...(restTypes.size > 0 ? ["  target.restingGroups = source.restingGroups;"] : []),
    "}",
    "",
    ...projectiles.same,
    "",
    "function sameFighterHead(target: Readonly<Fighter>, source: Readonly<Fighter>): boolean {",
    ...sameHead,
    "  return true;",
    "}",
    "",
    "function sameFighterTail(target: Readonly<Fighter>, source: Readonly<Fighter>): boolean {",
    ...sameTail,
    "  return true;",
    "}",
    "",
    "export function sameFighterState(target: Readonly<Fighter>, source: Readonly<Fighter>): boolean {",
    "  return sameFighterHead(target, source) && sameFighterTail(target, source);",
    "}",
    "",
    ...kitInterface(),
    "",
    "export function writeFighterFields(sink: FighterFieldSink, prefix: string, fighter: Readonly<Fighter>, participantMask: number, kits: FighterKitText): void {",
    ...canon.locals,
    ...canon.body,
    "}",
    "",
    "export function blastFighterFields(f: Fighter): void {",
    ...blast.locals,
    ...blast.body,
    "}",
    "",
    "export function respawnFighterFields(f: Fighter, startX: number): void {",
    ...respawn.locals,
    ...respawn.body,
    "}",
    "",
  ].join("\n");
}
