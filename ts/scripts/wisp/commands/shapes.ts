import { parseArgs } from "node:util";
import { Console, Effect, Schema } from "effect";
import { type Command, UsageFailure, describeCause } from "wisp/scripts/wisp/command";
import type { Row, Shape } from "../../moveShapes";
import type { RadiusRow } from "../../moveRadius";
import type { DashAttackRow } from "../../dashAttackShapes";

class ShapesFailure extends Schema.TaggedError<ShapesFailure>()("ShapesFailure", { problems: Schema.Array(Schema.String) }) {
  override get message(): string {
    return this.problems.join("\n");
  }
}

const n = (v: number): string => (Number.isInteger(v) ? `${v}` : v.toFixed(1));
const cell = (s: Shape, t: Shape, pick: (x: Shape) => number | boolean): string => {
  const show = (v: number | boolean): string => (typeof v === "boolean" ? (v ? "yes" : "no") : n(v));
  return `${show(pick(s))}/${show(pick(t))}`;
};

const linked = (row: Row): string =>
  row.links === undefined
    ? "d launcher, e early kill, g launch angle, k shield pressure: no link table, run bun wisp combos --links"
    : row.links.map((l) => `${l.option}${l.won ? "+" : "-"} (${l.value}; row ${l.row ?? "none"})`).join(" ");

const describe = (row: Row, options: readonly string[]): string => {
  const { smash: s, tilt: t } = row;
  const won = options.map((o) => `${o}${row.won.some((w) => w === o) ? "+" : "-"}`).join(" ");
  const verdicts = row.verdicts.map((v) => `${v.rule} ${v.pass ? "pass" : "FAIL"} (${v.detail})`).join("; ");
  return `${row.fighter} ${row.direction}: startup ${cell(s, t, (x) => x.startup)}, total ${cell(s, t, (x) => x.total)}, active ${cell(s, t, (x) => x.active)}, reach ${cell(s, t, (x) => x.reach)}, height ${cell(s, t, (x) => x.height)}, behind ${cell(s, t, (x) => x.behind)}, disjoint ${cell(s, t, (x) => x.disjoint)}, damage ${cell(s, t, (x) => x.damage)}, strong÷weak ${cell(s, t, (x) => x.sweetspot)}, intangible ${cell(s, t, (x) => x.intangible)}, out of shield ${cell(s, t, (x) => x.outOfShield)} | ${won} | ${linked(row)} | ${verdicts}`;
};

const describeRadius = (r: RadiusRow): string =>
  `${r.fighter} ${r.move}: radius ${n(r.radius)} ÷ shield ${n(r.shield)} = ${r.relative.toFixed(3)}, Melee band ${r.band.low.toFixed(3)} to ${r.band.high.toFixed(3)} ${r.pass ? "pass" : "FAIL"}`;

const describeDashAttack = (row: DashAttackRow): string =>
  `${row.fighter} dash attack: ${row.measures.map((m) => `${m.measure.label.toLowerCase()} ${m.measure.format(m.value)} (${m.measure.format(m.least)} to ${m.measure.format(m.greatest)}) ${m.pass ? "pass" : "FAIL"}`).join(", ")}`;

export const shapes: Command = (args) => Effect.gen(function*() {
  const { values } = yield* Effect.try({
    try: () => parseArgs({ args: [...args], options: { check: { type: "boolean" } }, strict: true }),
    catch: (cause) => new UsageFailure({ problem: describeCause(cause) }),
  });
  const { OPTIONS, check, readExceptions, rosterShapes } = yield* Effect.promise(() => import("../../moveShapes"));
  const failure = (cause: unknown): ShapesFailure => new ShapesFailure({ problems: [describeCause(cause)] });
  const rows = yield* Effect.try({ try: rosterShapes, catch: failure });
  const exceptions = yield* Effect.try({ try: () => readExceptions(), catch: failure });
  const result = check(rows, exceptions);
  const { bandsTable, checkRadii, documentedBands, meleeBands, readRadiusExceptions, rosterRadii } = yield* Effect.promise(() => import("../../moveRadius"));
  const bands = yield* Effect.try({ try: () => meleeBands(), catch: failure });
  const radii = yield* Effect.try({ try: () => rosterRadii(bands), catch: failure });
  const documented = yield* Effect.try({ try: () => documentedBands(), catch: failure });
  const radiusExceptions = yield* Effect.try({ try: () => readRadiusExceptions(), catch: failure });
  const radiusResult = checkRadii(radii, radiusExceptions);
  const { rosterDashAttacks } = yield* Effect.promise(() => import("../../dashAttackShapes"));
  const dashAttacks = yield* Effect.try({ try: rosterDashAttacks, catch: failure });
  const outside = dashAttacks.filter((r) => r.measures.some((m) => !m.pass));
  if (values.check !== true) {
    yield* Console.log("Each cell is smash/tilt; startup is the first hit frame, reach and disjoint in game units, an option ends + when the smash wins it. Launcher, early kill, launch angle and shield pressure come from the link table against a Fox-weight victim (75), each naming its row as opener, region, percent, weight and follow-up.");
    for (const row of rows) yield* Console.log(describe(row, OPTIONS));
    yield* Console.log("Largest hitbox radius over shield radius, against Melee's interquartile range for the move type (docs/design/melee/attacks.md, \"Hitbox size\").");
    for (const row of radii) yield* Console.log(describeRadius(row));
    yield* Console.log("Each dash attack against Melee's range across its 26 fighters (docs/design/melee/attacks.md, \"Dash attacks\"); travel is in Melee units, entering from a full run.");
    for (const row of dashAttacks) yield* Console.log(describeDashAttack(row));
  }
  yield* Console.log(`${rows.length} smash/tilt pairs, ${result.excused.length} recorded exceptions, ${result.failures.length} unexcused failures, ${result.stale.length} stale exceptions.`);
  yield* Console.log(`${dashAttacks.length} dash attacks, ${outside.length} outside Melee's rule: ${outside.map((r) => r.fighter).join(", ") || "none"}; reported for the retunes, not gated.`);
  yield* Console.log(`${radii.length} hitbox radii, ${radiusResult.excused.length} recorded exceptions, ${radiusResult.failures.length} unexcused failures, ${radiusResult.stale.length} stale exceptions.`);
  const problems = [
    ...result.failures.map((v) => `${v.fighter} ${v.direction} ${v.rule}: ${v.detail}; retune it or record Tom's reason in tools/move-data/move-shape-exceptions.json`),
    ...result.stale.map((e) => `${e.fighter} ${e.direction} ${e.rule}: the exception no longer matches a failing move; remove it`),
    ...radiusResult.failures.map((r) => `${describeRadius(r)}; resize it or record the reason in tools/move-data/move-radius-exceptions.json`),
    ...(documented === bandsTable(bands) ? [] : ["docs/design/melee/attacks.md \"Hitbox size\" table differs from the data; replace it with the output of bun scripts/moveRadius.ts"]),
    ...radiusResult.stale.map((e) => `${e.fighter} ${e.move} hitbox radius: the exception no longer matches an out-of-band move; remove it`),
  ];
  if (problems.length > 0) return yield* new ShapesFailure({ problems });
});

export const shapesEntry = { usage: "shapes [--check]   (move shapes per fighter: the range triangle and the smash budget against tilts, with recorded exceptions in tools/move-data/move-shape-exceptions.json: docs/gameplay-design.md, \"Smash attacks against tilts\"; each move's largest hitbox radius against Melee's band, with exceptions in tools/move-data/move-radius-exceptions.json: docs/design/melee/attacks.md, \"Hitbox size\"; and each dash attack against Melee's dash-attack rule: docs/design/melee/attacks.md, \"Dash attacks\")", load: async () => shapes };
