









import { join } from "node:path";
import { parseArgs } from "node:util";
import { Console, Effect, Schema } from "effect";
import { type Command, UsageFailure, describeCause } from "wisp/scripts/wisp/command";
import { step } from "wisp/scripts/wisp/timings";
import { Action } from "../../../src/game/input/actions";
import { playComboRoute } from "../../../src/game/match/comboRoute";
import { Character } from "../../../src/game/sim/codes";
import { SELECTABLE_CHARACTERS, fighterName } from "../../../src/game/roster/kits";
import { type FighterSummary, MAX_CONVERSIONS, OPENERS, OPPONENTS, PERCENTS, POSITIONS, type RouteRecord, type UnitReport, fighterNamed, summarize } from "../../comboExplorer";
import { type AdvantageRow, TARGETS, type ZeroToDeath, advantagePage, unmet } from "../../advantageState";
import { admit } from "../../heavyCapacity";
import { type ComboObjective, ComboObjectivesSchema, objectiveMisses, objectiveName, throwDeclarations } from "../../comboObjectives";
import type { LinkCell, LinkRow, LinkUnit } from "../../comboLinks";
import { ATTRIBUTION_PERCENTS, linkGains } from "../../comboLinkGains";
import { linksPage } from "../../comboLinksPage";
import { LINKS_DIR, linkSlug } from "../../linkTable";
import { meleeSwitchRefusal, switchableRows } from "../../ledger/meleeSwitches";
import { FOX_CASES, FOX_FIXTURE, caseLine, judge } from "../../comboValidation";
import { foxFixture } from "../../ledger/fixtures/fox";
import { FIXTURE_FIGHTERS } from "../../ledger/fixtures/fighters";
import { edgeShieldPage } from "../../edgeShieldPressure";
import { type EdgeGuardObjective, type EdgeGuardUnit, checkEdgeGuard } from "../../edgeGuardObjectives";
import { type ThrowDeclaration, type ThrowRoleResult, type ThrowRoleUnit, VICTIM, VICTIM_WEIGHT, coverageProblems } from "../../throwRoleObjectives";

const moveData = join(import.meta.dir, "../../../../tools/move-data");
const unitsFile = join(moveData, "combos/units.jsonl");
const summaryFile = join(moveData, "combo-potential.json");
const pageFile = join(moveData, "combo-potential.md");
const advantageFile = join(moveData, "advantage-state.jsonl");
const advantagePageFile = join(moveData, "advantage-state.md");
const objectivesFile = join(moveData, "combo-objectives.json");
const meleeLinksDir = join(import.meta.dir, "../../../../build/links-melee");

class CombosFailure extends Schema.TaggedError<CombosFailure>()("CombosFailure", { problem: Schema.String }) {
  override get message(): string {
    return this.problem;
  }
}

const failure = (cause: unknown) => new CombosFailure({ problem: describeCause(cause) });

interface Unit {
  readonly attacker: number;
  readonly opponent: number;
  readonly position: (typeof POSITIONS)[number];
}

const ComboSetupSchema = Schema.Struct({
  stage: Schema.Finite, attacker: Schema.Enum(Character), defender: Schema.Enum(Character),
  attackerX: Schema.Finite, defenderX: Schema.Finite, facing: Schema.Finite,
  attackerZ: Schema.Finite, defenderZ: Schema.Finite, percent: Schema.Finite,
});
const DiSchema = Schema.Literals(["out", "up", "down", "in", "none"]);
const RouteRecordSchema = Schema.Struct({
  opener: Schema.String, percent: Schema.Finite, moves: Schema.Array(Schema.String),
  damage: Schema.Finite, ko: Schema.Boolean, di: DiSchema,
  route: Schema.Struct({ setup: ComboSetupSchema, held: Schema.Array(Schema.Finite) }),
});
const UnitReportSchema = Schema.Struct({
  attacker: Schema.String, opponent: Schema.String, position: Schema.Literals(POSITIONS),
  cells: Schema.Array(Schema.Struct({
    opener: Schema.String, percent: Schema.Finite, damage: Schema.Finite, ko: Schema.Boolean,
    hits: Schema.Finite, di: DiSchema, situation: Schema.Literals(["none", "tech chase", "ledge"]),
    moves: Schema.Array(Schema.String),
  })),
  killPercent: Schema.optionalKey(Schema.Finite),
  conversions: Schema.Array(Schema.Struct({
    percent: Schema.Finite, moves: Schema.Array(Schema.String), damage: Schema.Finite,
    hits: Schema.Finite, reads: Schema.Finite, ko: Schema.Boolean,
  })),
  kills: Schema.Boolean, routes: Schema.Array(RouteRecordSchema), frames: Schema.Finite,
});


const inWorkers = <U, R>(script: URL, units: readonly U[], jobs: number, name: (unit: U) => string, progress: (unit: U, result: R) => string) => Effect.gen(function* () {
  let done = 0;
  const started = performance.now();
  return yield* Effect.forEach(units, (unit) => Effect.scoped(Effect.gen(function* () {
    const worker = yield* Effect.acquireRelease(
      Effect.sync(() => new Worker(script.href)),
      (thread) => Effect.sync(() => thread.terminate()),
    );
    const result = yield* Effect.callback<R, CombosFailure>((resume) => {
      worker.onmessage = (event: MessageEvent<R>) => resume(Effect.succeed(event.data));
      worker.onerror = (event) => resume(Effect.fail(failure(new Error(`${name(unit)}: ${event.message}`))));
      worker.postMessage(unit);
    });
    done++;
    yield* Console.error(`combos: ${done}/${units.length} ${progress(unit, result)}, ${((performance.now() - started) / 1000).toFixed(0)} s`);
    return result;
  })), { concurrency: jobs });
});

const unitName = (unit: Unit): string => `${fighterName(unit.attacker)} on ${fighterName(unit.opponent)} at ${unit.position}`;
const measureUnits = (units: readonly Unit[], jobs: number) =>
  inWorkers<Unit, UnitReport>(new URL("../../comboExplorerWorker.ts", import.meta.url), units, jobs, unitName, unitName);


function replayProblems(routes: readonly (RouteRecord & { readonly fighter: string; readonly opponent: string; readonly position: string })[]): string[] {
  const problems: string[] = [];
  for (const record of routes) {
    const played = playComboRoute(record.route);
    if (played.damage !== record.damage || (played.stocksLost > 0) !== record.ko) {
      problems.push(`${record.fighter} ${record.opener} at ${record.percent}% on ${record.opponent} (${record.position}): replay dealt ${played.damage}${played.stocksLost > 0 ? " and took the stock" : ""}, the search ${record.damage}${record.ko ? " and the stock" : ""}`);
    }
  }
  return problems;
}

const NAMES: Readonly<Record<number, string>> = {
  [Action.moveLeft]: "left", [Action.moveRight]: "right", [Action.moveDown]: "down", [Action.moveUp]: "up", [Action.jump]: "jump",
  [Action.attack]: "A", [Action.special]: "B", [Action.grab]: "Z", [Action.rightTrigger]: "R", [Action.cLeft]: "C-left",
  [Action.cRight]: "C-right", [Action.cUp]: "C-up", [Action.cDown]: "C-down", [Action.walk]: "walk",
};


export function describeInputs(held: readonly number[]): string {
  const runs: string[] = [];
  for (let run = 0; run + 2 < held.length; run += 3) {
    const mask = held[run] ?? 0;
    const count = held[run + 2] ?? 0;
    const names = Object.entries(NAMES).filter(([bit]) => (mask & (1 << Number(bit))) !== 0).map(([, name]) => name);
    const text = names.length === 0 ? "—" : names.join("+");
    const last = runs.length - 1;
    const previous = runs[last];
    const match = previous?.match(/^(.*) ×(\d+)$/);
    if (match !== null && match !== undefined && match[1] === text) runs[last] = `${text} ×${Number(match[2]) + count}`;
    else runs.push(`${text} ×${count}`);
  }
  return runs.join(", ");
}

const number = (value: number): string => String(Math.round(value * 10) / 10);
const percentText = (value: number | undefined): string => (value === undefined ? `>${PERCENTS.at(-1)}%` : `${value}%`);
const openingsText = (summary: FighterSummary, value: number): string => `${number(value)}${summary.complete ? "" : "+"}`;

function table(summaries: readonly FighterSummary[]): string[] {
  return [
    "| Fighter | Max true combo | Typical punish | Kill confirm | Openings per kill | Multi-hit openings | With reads as openings | Damage per opening | Best route |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...summaries.map((summary) => `| ${summary.fighter} | ${number(summary.maxDamage)}% | ${number(summary.typicalDamage)}% | ${percentText(summary.killPercent)} | ${openingsText(summary, summary.openingsPerKill)} | ${openingsText(summary, summary.multiHitOpeningsPerKill)} | ${openingsText(summary, summary.openingsWithReads)} | ${number(summary.damagePerOpening)}% | ${summary.bestRoute === undefined ? "—" : `${summary.bestRoute.moves.join(" → ")} (${number(summary.bestRoute.damage)}% at ${summary.bestRoute.percent}%)`} |`),
  ];
}

function page(summaries: readonly FighterSummary[], units: readonly UnitReport[]): string {
  return [
    "# Combo potential", "",
    `Generated by \`bun wisp combos\`; do not edit. The measure is defined in [balance](../../docs/design/balance.md#combo-potential). Openers at ${PERCENTS[0]}–${PERCENTS.at(-1)}% in ${PERCENTS[1] - PERCENTS[0]}% steps, against ${OPPONENTS.map(fighterName).join(", ")} at the stage's centre and ledge, each against its escape-optimal DI; a "+" means a chain hadn't killed after ${MAX_CONVERSIONS} conversions.`, "",
    ...table(summaries), "",
    "## Best routes", "",
    "Each fighter's most damaging true combo and every opener's first kill, with the attacker's inputs frame by frame from the setup (A attack, B special, Z grab, R shield, C the attack stick).", "",
    ...summaries.flatMap((summary) => {
      const own = units.filter((unit) => unit.attacker === summary.fighter);
      const kills = own.flatMap((unit) => unit.routes.filter((route) => route.ko).map((route) => ({ unit, route })));
      const firstKills = summary.openers.flatMap((opener) => {
        const found = kills.filter(({ route }) => route.opener === opener.opener).sort((x, y) => x.route.percent - y.route.percent)[0];
        return found === undefined ? [] : [found];
      });
      const best = summary.bestRoute;
      return [
        `### ${summary.fighter}`, "",
        ...(best === undefined ? [] : [`- Most damage: ${best.moves.join(" → ")}, ${number(best.damage)}% from ${best.percent}% (DI ${best.di}). Inputs: ${describeInputs(best.route.held)}.`]),
        ...firstKills.map(({ unit, route }) => `- ${route.opener} kills ${unit.opponent} from ${route.percent}% at the ${unit.position}: ${route.moves.join(" → ")} (DI ${route.di}).`),
        "",
      ];
    }),
  ].join("\n");
}


const AdvantageRowSchema = Schema.Struct({
  fighter: Schema.String, target: Schema.Literals(["light", "medium", "heavy"]), opponent: Schema.String,
  throws: Schema.Array(Schema.Struct({
    opener: Schema.String, percent: Schema.Finite, withoutDi: Schema.Finite, withDi: Schema.Finite, withDiDamage: Schema.Finite,
    withDiMoves: Schema.Array(Schema.String), diMixup: Schema.optionalKey(Schema.Struct({ in: Schema.String, out: Schema.String })),
    knockdown: Schema.Boolean, ko: Schema.Boolean,
  })),
  techChase: Schema.optionalKey(Schema.Struct({
    opener: Schema.String, percent: Schema.Finite,
    covered: Schema.Array(Schema.Struct({ option: Schema.String, read: Schema.optionalKey(Schema.String) })),
    trap: Schema.optionalKey(Schema.Struct({ read: Schema.String, options: Schema.Array(Schema.String) })),
  })),
  juggle: Schema.optionalKey(Schema.Struct({ launcher: Schema.String, percent: Schema.Finite, relaunch: Schema.String, dis: Schema.Finite })),
  targets: Schema.Struct({ grabs: Schema.Boolean, techChasing: Schema.Boolean, juggling: Schema.Boolean, diMixups: Schema.Boolean, techTraps: Schema.Boolean }),
  zeroToDeath: Schema.Array(Schema.String),
});

const measureAdvantage = (units: readonly AdvantageUnit[], jobs: number) =>
  inWorkers<AdvantageUnit, AdvantageRow>(new URL("../../advantageStateWorker.ts", import.meta.url), units, jobs,
    (unit) => `${fighterName(unit.attacker)} advantage state`, (_, row) => `${row.fighter} against the ${row.target} target`);

interface AdvantageUnit {
  readonly attacker: Character;
  readonly target: number;
}

const ROW_SECONDS: Readonly<Record<string, number>> = { "Rifleman heavy": 11, "Illidan heavy": 11, "Illidan light": 13, "Rifleman medium": 16, "Rifleman light": 16, "Illidan medium": 17, "Blademaster heavy": 10, "Mountain King heavy": 22, "Blademaster medium": 30, "Blademaster light": 33, "Mountain King light": 33, "Mountain King medium": 33, "Warden heavy": 11, "Warden light": 35, "Lich heavy": 11, "Lich medium": 19, "Lich light": 25, "Uther heavy": 12, "Uther light": 25, "Warden medium": 39, "Dreadlord heavy": 7, "Uther medium": 35, "Shadow Hunter heavy": 17, "Shadow Hunter light": 25, "Shadow Hunter medium": 25, "Dreadlord light": 46, "Pit Lord heavy": 12, "Pit Lord light": 24, "Dreadlord medium": 48, "Pit Lord medium": 25, "Lich King light": 15, "Lich King medium": 15, "Lich King heavy": 11, "Beastmaster light": 30, "Beastmaster heavy": 24, "Beastmaster medium": 30, "Jaina Proudmoore heavy": 16, "Thrall heavy": 28, "Jaina Proudmoore light": 28, "Jaina Proudmoore medium": 25, "Thrall medium": 32, "Thrall light": 37, "Sylvanas Windrunner heavy": 19, "Cairne Bloodhoof heavy": 12, "Cairne Bloodhoof light": 18, "Cairne Bloodhoof medium": 18, "Sylvanas Windrunner light": 26, "Sylvanas Windrunner medium": 31, "Chen Stormstout light": 30, "Peon light": 28, "Peon heavy": 21, "Chen Stormstout heavy": 33, "Chen Stormstout medium": 35, "Peon medium": 32, "Kael'thas Sunstrider light": 12, "Goblin Tinker light": 17, "Kael'thas Sunstrider heavy": 11, "Goblin Tinker heavy": 17, "Kael'thas Sunstrider medium": 15, "Goblin Tinker medium": 20, "Murloc light": 31, "Grom Hellscream heavy": 31, "Murloc heavy": 34, "Murloc medium": 43, "Grom Hellscream medium": 45, "Grom Hellscream light": 47, "Malfurion Stormrage light": 15, "Malfurion Stormrage heavy": 14, "Malfurion Stormrage medium": 18, "Medivh light": 14, "Medivh medium": 14, "Medivh heavy": 15 };
const rowSeconds = (unit: AdvantageUnit): number => ROW_SECONDS[`${fighterName(unit.attacker)} ${TARGETS[unit.target]?.weight}`] ?? 20;
const longestFirst = (units: readonly AdvantageUnit[]): AdvantageUnit[] => units.map((unit, index) => ({ unit, index })).sort((x, y) => rowSeconds(y.unit) - rowSeconds(x.unit) || x.index - y.index).map(({ unit }) => unit);

function shardOf(units: readonly AdvantageUnit[], index: number, count: number): AdvantageUnit[] {
  const loads = Array.from({ length: count }, () => 0);
  const shards: AdvantageUnit[][] = Array.from({ length: count }, () => []);
  for (const unit of longestFirst(units)) {
    const lightest = loads.indexOf(Math.min(...loads));
    loads[lightest] = (loads[lightest] ?? 0) + rowSeconds(unit);
    shards[lightest]?.push(unit);
  }
  return shards[index] ?? [];
}

const decodeRows = (text: string) => Effect.forEach(text.split("\n").filter((line) => line !== ""), (line) =>
  Schema.decodeEffect(Schema.fromJsonString(AdvantageRowSchema))(line).pipe(Effect.mapError(failure), Effect.as(JSON.parse(line) as AdvantageRow)));

const readText = (file: string) => Effect.tryPromise({ try: () => Bun.file(file).text(), catch: failure });

const writeAdvantage = (all: readonly AdvantageRow[], measured: readonly AdvantageRow[]) => Effect.gen(function* () {
  const order = SELECTABLE_CHARACTERS.map(fighterName);
  const weight = (row: AdvantageRow) => TARGETS.findIndex((target) => target.weight === row.target);
  const sorted = [...all].sort((x, y) => order.indexOf(x.fighter) - order.indexOf(y.fighter) || weight(x) - weight(y));
  yield* Effect.tryPromise({
    try: async () => {
      await Bun.write(advantageFile, sorted.map((row) => JSON.stringify(row)).join("\n") + "\n");
      await Bun.write(advantagePageFile, advantagePage(sorted) + "\n");
    },
    catch: failure,
  }).pipe(step("writing tools/move-data/advantage-state.jsonl and .md"));
  const misses = measured.flatMap((row) => unmet(row).map((problem) => `${row.fighter}: ${problem}`));
  yield* Console.log([`advantage state: ${measured.filter((row) => unmet(row).length === 0).length} of ${measured.length} fighter and target rows meet every target`, ...misses.map((miss) => `  ${miss}`)].join("\n"));
});

const advantage = (attackers: readonly Character[], jobs: number, partial: boolean, shard: { readonly index: number; readonly count: number; readonly rows: string } | undefined) => Effect.gen(function* () {
  const all = attackers.flatMap((attacker) => TARGETS.map((_, target) => ({ attacker, target })));
  const units = longestFirst(shard === undefined ? all : shardOf(all, shard.index, shard.count));
  const rows = yield* measureAdvantage(units, jobs).pipe(step(`${units.length} fighter and target advantage rows on ${jobs} threads`));
  if (shard !== undefined) {
    yield* Effect.tryPromise({ try: () => Bun.write(shard.rows, rows.map((row) => JSON.stringify(row)).join("\n") + "\n"), catch: failure });
    return;
  }
  const previous = yield* Effect.tryPromise({
    try: async () => !partial || !(await Bun.file(advantageFile).exists()) ? "" : await Bun.file(advantageFile).text(),
    catch: failure,
  });
  const decoded = yield* decodeRows(previous);
  const kept: AdvantageRow[] = decoded.filter((row) => !rows.some((own) => own.fighter === row.fighter));
  yield* writeAdvantage([...kept, ...rows], rows);
});

const zeroToDeath = (attackers: readonly Character[], jobs: number) => Effect.gen(function* () {
  const units = attackers.flatMap((attacker) => TARGETS.flatMap((_, target) => POSITIONS.map((position) => ({ attacker, target, position }))));
  const found = (yield* inWorkers<(typeof units)[number], readonly ZeroToDeath[]>(new URL("../../zeroToDeathWorker.ts", import.meta.url), units, jobs,
    (unit) => `${fighterName(unit.attacker)} zero-to-death`,
    (unit, own) => `${fighterName(unit.attacker)} against the ${TARGETS[unit.target]?.weight} target at the ${unit.position}, ${own.length} found`,
  ).pipe(step(`${units.length} fighter, target and position zero-to-death searches on ${jobs} threads`))).flat();
  yield* Console.log([
    ...attackers.map((attacker) => `${fighterName(attacker)}: ${found.filter((own) => own.fighter === fighterName(attacker)).length} true zero-to-death`),
    ...found.map((own) => `  ${own.fighter} ${own.opener} takes the ${own.target} target's stock from 0% at the ${own.position} against DI ${own.di}: ${own.moves.join(" → ")}. Inputs: ${describeInputs(own.held)}.`),
  ].join("\n"));
  if (found.length > 0) return yield* new CombosFailure({ problem: `${found.length} true zero-to-death routes` });
});

const mergeAdvantage = (files: readonly string[]) => Effect.gen(function* () {
  const rows = (yield* Effect.forEach(files, (file) => readText(file).pipe(Effect.flatMap(decodeRows)))).flat();
  const expected = SELECTABLE_CHARACTERS.flatMap((attacker) => TARGETS.map((target) => `${fighterName(attacker)} ${target.weight}`)).sort();
  const found = rows.map((row) => `${row.fighter} ${row.target}`).sort();
  if (found.join("\n") !== expected.join("\n")) return yield* new CombosFailure({ problem: `the merged rows are ${found.length} of the ${expected.length} fighter and target rows, not each exactly once` });
  yield* writeAdvantage(rows, rows);
});

const linkRows = (attacker: Character, extra: Partial<LinkUnit>, jobs: number, label: string) => {
  const units: LinkUnit[] = OPENERS.map((_, opener) => ({ attacker, opener, ...extra }));
  return inWorkers<LinkUnit, readonly LinkRow[]>(new URL("../../comboLinksWorker.ts", import.meta.url), units, jobs,
    (unit) => `${fighterName(unit.attacker)} ${OPENERS[unit.opener]?.name} links${label}`,
    (unit, rows) => `${fighterName(unit.attacker)} ${OPENERS[unit.opener]?.name}${label}, ${rows.length} rows`,
  ).pipe(step(`${units.length} ${fighterName(attacker)} openers' links${label} on ${jobs} threads`), Effect.map((found) => found.flat()));
};

const links = (attackers: readonly Character[], jobs: number) => Effect.forEach(attackers, (attacker) => Effect.gen(function* () {
  const rows = yield* linkRows(attacker, {}, jobs, "");
  const file = join(LINKS_DIR, linkSlug(attacker));
  yield* Effect.tryPromise({
    try: async () => {
      await Bun.write(`${file}.jsonl`, rows.map((row) => JSON.stringify(row)).join("\n") + "\n");
      await Bun.write(`${file}.md`, linksPage(fighterName(attacker), rows) + "\n");
    },
    catch: failure,
  }).pipe(step(`writing tools/move-data/links/${linkSlug(attacker)}.jsonl and .md`));
  const count = (kind: LinkRow["class"]) => rows.filter((row) => row.class === kind).length;
  yield* Console.log(`${fighterName(attacker)} links: ${rows.length} rows, ${count("true")} true, ${count("DI-dependent")} DI-dependent, ${count("read")} read, ${count("none")} none`);
}), { discard: true });

const linkObjectives = (all: readonly ComboObjective[], attackers: readonly Character[]) => Effect.gen(function* () {
  const declared = all.filter((objective) => { const attacker = fighterNamed(objective.fighter); return attacker === undefined || attackers.includes(attacker); });
  const fighters = [...new Set(declared.map((objective) => objective.fighter))];
  const rows = (yield* Effect.forEach(fighters, (fighter) => {
    const attacker = fighterNamed(fighter);
    if (attacker === undefined) return Effect.fail(new CombosFailure({ problem: `combo objectives name ${fighter}, not a selectable fighter` }));
    return readText(join(LINKS_DIR, `${linkSlug(attacker)}.jsonl`)).pipe(
      Effect.map((text) => text.split("\n").filter((line) => line !== "").map((line) => JSON.parse(line) as LinkRow)));
  })).flat();
  const misses = declared.flatMap((objective) => {
    const own = objectiveMisses(objective, rows);
    return own.length === 0 ? [] : [`  ${objectiveName(objective)}: ${own.join("; ")}`];
  });
  yield* Console.log([`combo objectives: ${declared.length - misses.length} of ${declared.length} hold in tools/move-data/links against tools/move-data/combo-objectives.json`, ...misses].join("\n"));
  return misses.length;
});

const throwRoles = (declarations: readonly ThrowDeclaration[], attackers: readonly Character[], jobs: number) => Effect.gen(function* () {
  const undeclared = SELECTABLE_CHARACTERS.map(fighterName).filter((name) => !declarations.some((declaration) => declaration.fighter === name));
  const unknown = [...new Set(declarations.map((declaration) => declaration.fighter).filter((fighter) => fighterNamed(fighter) === undefined))];
  const coverage = [...coverageProblems(declarations), ...undeclared.map((name) => `${name} declares no throw roles`), ...unknown.map((name) => `${name} is not a selectable fighter`)];
  const units: ThrowRoleUnit[] = declarations.flatMap((declaration) => {
    const attacker = fighterNamed(declaration.fighter);
    return attacker === undefined || !attackers.includes(attacker) ? [] : [{ attacker, declaration }];
  });
  const results = yield* inWorkers<ThrowRoleUnit, ThrowRoleResult>(new URL("../../throwRoleObjectivesWorker.ts", import.meta.url), units, jobs,
    (unit) => `${unit.declaration.fighter} ${unit.declaration.throw} throw as ${unit.declaration.role}`,
    (unit, result) => `${result.fighter} ${unit.declaration.throw} throw as ${result.role}: ${result.passes ? "pass" : "fail"}`,
  ).pipe(step(`${units.length} declared throw roles on ${jobs} threads`));
  const failed = results.filter((result) => !result.passes).length;
  yield* Console.log([
    `throw roles: ${results.length - failed} of ${results.length} declared throws do their role (victim ${fighterName(VICTIM)} at weight ${VICTIM_WEIGHT})`,
    ...results.map((result) => `  ${result.passes ? "pass" : "FAIL"} ${result.fighter} ${result.throw} throw, ${result.role} at ${result.percents.join("/")}%: ${result.measured}${result.passes ? "" : ` — ${result.problems.join("; ")}`}`),
    ...coverage.map((problem) => `  coverage: ${problem}`),
  ].join("\n"));
  return failed + coverage.length;
});

const edgeGuards = (declared: readonly EdgeGuardObjective[], attackers: readonly Character[]) => Effect.gen(function* () {
  const units = declared.flatMap((objective): EdgeGuardUnit[] => {
    const attacker = fighterNamed(objective.fighter);
    return attacker === undefined || !attackers.includes(attacker) ? [] : [{ attacker, objective }];
  });
  const unknown = declared.filter((objective) => fighterNamed(objective.fighter) === undefined).map((objective) => `  coverage: ${objective.fighter} is not a selectable fighter`);
  const results = yield* Effect.sync(() => units.map(checkEdgeGuard)).pipe(step(`${units.length} declared edge guards`));
  const failed = results.filter((result) => !result.passes).length;
  yield* Console.log([
    `edge guards: ${results.length - failed} of ${results.length} declared edge guards kill offstage (victim ${fighterName(VICTIM)})`,
    ...results.map((result) => `  ${result.passes ? "pass" : "FAIL"} ${result.name}: ${result.measured}${result.passes ? "" : ` — ${result.problems.join("; ")}`}`),
    ...unknown,
  ].join("\n"));
  return failed + unknown.length;
});

const objectives = (attackers: readonly Character[], jobs: number) => Effect.gen(function* () {
  const declared = yield* readText(objectivesFile).pipe(Effect.flatMap((text) => Schema.decodeEffect(Schema.fromJsonString(ComboObjectivesSchema))(text).pipe(Effect.mapError(failure))));
  const links = yield* linkObjectives(declared.links, attackers);
  const edges = yield* edgeGuards(declared.edgeGuards, attackers);
  const throws = yield* throwRoles(throwDeclarations(declared), attackers, jobs);
  if (links + edges + throws > 0) return yield* new CombosFailure({ problem: `${links} combo objectives, ${edges} edge guards and ${throws} throw-role rules miss` });
});

const validate = (jobs: number) => Effect.gen(function* () {
  const fox = fighterNamed(FOX_FIXTURE);
  if (fox === undefined) return yield* new CombosFailure({ problem: `the sim has no ${FOX_FIXTURE} fighter to validate against (#296)` });
  const weight = foxFixture().attributes.weight.value[0];
  if (weight === undefined) return yield* new CombosFailure({ problem: "the Fox fixture has no weight" });
  const melee = switchableRows();
  const cells = yield* Effect.forEach(FOX_CASES, (kase) => {
    const opener = OPENERS.findIndex((own) => own.name === kase.opener);
    return opener < 0
      ? Effect.fail(new CombosFailure({ problem: `no opener named ${kase.opener}` }))
      : Effect.succeed<LinkCell>({ attacker: fox, victim: fox, opener, region: kase.region, percent: kase.percent, weight, melee });
  });
  const found = yield* inWorkers<LinkCell, readonly LinkRow[]>(new URL("../../comboLinkCellWorker.ts", import.meta.url), cells, jobs,
    (cell) => `${OPENERS[cell.opener]?.name} at ${cell.percent}%`,
    (cell, rows) => `${OPENERS[cell.opener]?.name} at ${cell.percent}%, ${rows.length} follow-ups`,
  ).pipe(step(`${cells.length} Fox cases on ${jobs} threads`));
  const results = FOX_CASES.map((kase, index) => judge(kase, found[index] ?? []));
  const passes = results.filter((result) => result.passed).length;
  const misses = results.filter((result) => !result.passed && result.explained === undefined).length;
  yield* Console.log([...results.map(caseLine), `${passes} of ${results.length} Fox cases come out in their Melee class and ${results.length - passes - misses} miss as their ledger row explains, with ${melee.join(", ")} on Melee's handling`].join("\n"));
  if (misses > 0) return yield* new CombosFailure({ problem: `${misses} Fox cases missed their Melee class` });
});

const signed = (value: number): string => (value > 0 ? `+${value}` : `${value}`);

const meleeLinks = (attackers: readonly Character[], meleeRows: readonly string[], jobs: number) => Effect.forEach(attackers, (attacker) => Effect.gen(function* () {
  const before = yield* linkRows(attacker, { percents: ATTRIBUTION_PERCENTS }, jobs, "");
  yield* Effect.forEach(meleeRows, (row) => Effect.gen(function* () {
    const after = yield* linkRows(attacker, { percents: ATTRIBUTION_PERCENTS, melee: [row] }, jobs, ` on Melee's ${row}`);
    const file = join(meleeLinksDir, row, `${linkSlug(attacker)}.jsonl`);
    yield* Effect.tryPromise({ try: () => Bun.write(file, after.map((own) => JSON.stringify(own)).join("\n") + "\n"), catch: failure });
    yield* Console.log([
      `${fighterName(attacker)} with ${row} on Melee's handling, ${ATTRIBUTION_PERCENTS[0]}-${ATTRIBUTION_PERCENTS.at(-1)}% (rows in ${file}):`,
      ...linkGains(before, after).map((gain) => `  ${gain.band} ${gain.class}: ${gain.before} -> ${gain.after} (${signed(gain.after - gain.before)}; ${gain.gained} gained, ${gain.lost} lost)`),
    ].join("\n"));
  }), { discard: true });
}), { discard: true });

export const combos: Command = (args) => Effect.gen(function*() {
  const parsed = yield* Effect.try({
    try: () => parseArgs({ args: [...args], options: { fighter: { type: "string", multiple: true }, jobs: { type: "string" }, advantage: { type: "boolean" }, links: { type: "boolean" }, melee: { type: "string", multiple: true }, objectives: { type: "boolean" }, "edge-shield": { type: "boolean" }, validate: { type: "boolean" }, "zero-to-death": { type: "boolean" }, shard: { type: "string" }, rows: { type: "string" }, merge: { type: "string", multiple: true } }, strict: true }).values,
    catch: (cause) => new UsageFailure({ problem: describeCause(cause) }),
  });
  const names = parsed.fighter ?? [];
  const attackers = names.length === 0 ? SELECTABLE_CHARACTERS : names.map(fighterNamed);
  const unknown = names.filter((_, index) => attackers[index] === undefined);
  if (unknown.length > 0) return yield* new UsageFailure({ problem: `--fighter takes ${[...SELECTABLE_CHARACTERS, ...FIXTURE_FIGHTERS].map(fighterName).join(", ")}; not ${unknown.join(", ")}` });
  const jobs = Number(parsed.jobs ?? "6");
  if (!Number.isInteger(jobs) || jobs < 1) return yield* new UsageFailure({ problem: "--jobs takes a whole number of worker threads" });
  if (parsed.merge !== undefined) return yield* mergeAdvantage(parsed.merge);
  const shardMatch = parsed.shard?.match(/^(\d+)\/(\d+)$/);
  const shard = shardMatch === undefined || shardMatch === null ? undefined : { index: Number(shardMatch[1]), count: Number(shardMatch[2]), rows: parsed.rows ?? "" };
  if (parsed.shard !== undefined && (shard === undefined || shard.index >= shard.count || shard.rows === "" || parsed.advantage !== true || names.length > 0)) {
    return yield* new UsageFailure({ problem: "--shard I/N takes --advantage, --rows FILE and no --fighter, with I below N" });
  }
  if (parsed.melee !== undefined) {
    const refusals = parsed.links === true ? parsed.melee.flatMap((row) => meleeSwitchRefusal(row) ?? []) : ["--melee ROW takes --links"];
    if (refusals.length > 0) return yield* new UsageFailure({ problem: refusals.join("\n") });
  }
  const code = yield* admit("heavy", "smashcraft:combos", 3600);
  if (code !== undefined) {
    if (code !== 0) return yield* new CombosFailure({ problem: `the admitted run exited ${code}` });
    return;
  }
  if (parsed.validate === true) return yield* validate(jobs);
  if (parsed["edge-shield"] === true) return yield* Console.log(edgeShieldPage(attackers.filter((attacker): attacker is Character => attacker !== undefined)).join("\n"));
  if (parsed.objectives === true) return yield* objectives(attackers.filter((attacker): attacker is Character => attacker !== undefined), jobs);
  if (parsed.links === true && parsed.melee !== undefined) return yield* meleeLinks(attackers.filter((attacker): attacker is Character => attacker !== undefined), parsed.melee, jobs);
  if (parsed.links === true) return yield* links(attackers.filter((attacker): attacker is Character => attacker !== undefined), jobs);
  if (parsed["zero-to-death"] === true) return yield* zeroToDeath(attackers.filter((attacker): attacker is Character => attacker !== undefined), jobs);
  if (parsed.advantage === true) return yield* advantage(attackers.filter((attacker): attacker is Character => attacker !== undefined), jobs, names.length > 0, shard);
  const units: Unit[] = attackers.flatMap((attacker) => attacker === undefined ? [] : OPPONENTS.flatMap((opponent) => POSITIONS.map((position) => ({ attacker, opponent, position }))));
  const reports = yield* measureUnits(units, jobs).pipe(step(`${units.length} fighter, opponent and position cells on ${jobs} threads`));
  const summaries = [...new Set(reports.map((report) => report.attacker))].map((fighter) => summarize(fighter, reports.filter((report) => report.attacker === fighter)));
  const routes = reports.flatMap((report) => report.routes.map((route) => ({ ...route, fighter: report.attacker, opponent: report.opponent, position: report.position })));
  const problems = yield* Effect.sync(() => replayProblems(routes)).pipe(step(`replaying ${routes.length} routes from their setups`));
  const previous = yield* Effect.tryPromise({
    try: async () => names.length === 0 || !(await Bun.file(unitsFile).exists()) ? "" : await Bun.file(unitsFile).text(),
    catch: failure,
  });
  const decoded = yield* Effect.forEach(previous.split("\n").filter(line => line !== ""),
    line => Schema.decodeEffect(Schema.fromJsonString(UnitReportSchema))(line).pipe(Effect.mapError(failure)));
  const kept: UnitReport[] = decoded.filter(unit => !summaries.some(summary => summary.fighter === unit.attacker)).map(unit => ({ ...unit, killPercent: unit.killPercent }));
  yield* Effect.tryPromise({
    try: async () => {
      const allUnits = [...kept, ...reports];
      await Bun.write(unitsFile, allUnits.map((unit) => JSON.stringify(unit)).join("\n") + "\n");
      const all = [...new Set(allUnits.map((unit) => unit.attacker))].map((fighter) => summarize(fighter, allUnits.filter((unit) => unit.attacker === fighter)));
      const order = SELECTABLE_CHARACTERS.map(fighterName);
      all.sort((x, y) => order.indexOf(x.fighter) - order.indexOf(y.fighter));
      const compact = Object.fromEntries(all.map((summary) => [summary.fighter, {
        openingsPerKill: summary.openingsPerKill, multiHitOpeningsPerKill: summary.multiHitOpeningsPerKill, openingsWithReads: summary.openingsWithReads,
        killPercent: summary.killPercent ?? null, maxDamage: summary.maxDamage, typicalDamage: summary.typicalDamage, damagePerOpening: summary.damagePerOpening, complete: summary.complete,
        openers: summary.openers.map((opener) => ({ ...opener, killPercent: opener.killPercent ?? null })),
      }]));
      await Bun.write(summaryFile, JSON.stringify({ measure: "docs/design/balance.md#combo-potential", fighters: compact }, null, 2) + "\n");
      await Bun.write(pageFile, page(all, allUnits) + "\n");
    },
    catch: failure,
  }).pipe(step("writing tools/move-data/combo-potential.json and .md"));
  yield* Console.log([...table(summaries), "", `route replay: ${routes.length - problems.length} of ${routes.length} routes reproduce their damage from a new match`, ...problems.map((problem) => `  ${problem}`)].join("\n"));
  if (problems.length > 0) return yield* new CombosFailure({ problem: `${problems.length} routes replayed to a different result` });
});
