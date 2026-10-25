import { parseArgs } from "node:util";
import { Console, Effect, Schema } from "effect";
import { type Command, UsageFailure, describeCause } from "wisp/scripts/wisp/command";
import type { Row, Shape } from "../../moveShapes";

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

const describe = (row: Row, options: readonly string[]): string => {
  const { smash: s, tilt: t } = row;
  const won = options.map((o) => `${o}${row.won.some((w) => w === o) ? "+" : "-"}`).join(" ");
  const verdicts = row.verdicts.map((v) => `${v.rule} ${v.pass ? "pass" : "FAIL"} (${v.detail})`).join("; ");
  return `${row.fighter} ${row.direction}: startup ${cell(s, t, (x) => x.startup)}, total ${cell(s, t, (x) => x.total)}, active ${cell(s, t, (x) => x.active)}, reach ${cell(s, t, (x) => x.reach)}, height ${cell(s, t, (x) => x.height)}, behind ${cell(s, t, (x) => x.behind)}, disjoint ${cell(s, t, (x) => x.disjoint)}, damage ${cell(s, t, (x) => x.damage)}, strong÷weak ${cell(s, t, (x) => x.sweetspot)}, intangible ${cell(s, t, (x) => x.intangible)}, out of shield ${cell(s, t, (x) => x.outOfShield)} | ${won} | ${verdicts}`;
};

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
  if (values.check !== true) {
    yield* Console.log("Each cell is smash/tilt; startup is the first hit frame, reach and disjoint in game units, an option ends + when the smash wins it.");
    for (const row of rows) yield* Console.log(describe(row, OPTIONS));
  }
  yield* Console.log(`${rows.length} smash/tilt pairs, ${result.excused.length} recorded exceptions, ${result.failures.length} unexcused failures, ${result.stale.length} stale exceptions.`);
  const problems = [
    ...result.failures.map((v) => `${v.fighter} ${v.direction} ${v.rule}: ${v.detail}; retune it or record Tom's reason in tools/move-data/move-shape-exceptions.json`),
    ...result.stale.map((e) => `${e.fighter} ${e.direction} ${e.rule}: the exception no longer matches a failing move; remove it`),
  ];
  if (problems.length > 0) return yield* new ShapesFailure({ problems });
});

export const shapesEntry = { usage: "shapes [--check]   (move shapes per fighter: the range triangle and the smash budget against tilts, with recorded exceptions in tools/move-data/move-shape-exceptions.json: docs/gameplay-design.md, \"Smash attacks against tilts\")", load: async () => shapes };
