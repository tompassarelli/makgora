import { Schema } from "effect";
import { DIS } from "./comboExplorer";
import { LINK_PERCENTS, type LinkClass, type LinkRow, REGIONS } from "./comboLinks";
import { ROLE_PERCENTS, THROW_DIRECTIONS, THROW_ROLES, type ThrowDeclaration } from "./throwRoleObjectives";

export const ComboObjectiveSchema = Schema.Struct({
  fighter: Schema.String,
  opener: Schema.String,
  region: Schema.Literals(REGIONS),
  percent: Schema.Tuple([Schema.Finite, Schema.Finite]),
  weight: Schema.Finite,
  followUp: Schema.String,
  class: Schema.Literals(["true", "DI-dependent", "read"]),
  di: Schema.optionalKey(Schema.Array(Schema.Literals(DIS))),
});
export type ComboObjective = typeof ComboObjectiveSchema.Type;
const DeclaredThrowSchema = Schema.Union([Schema.Literals(THROW_ROLES), Schema.Struct({ role: Schema.Literals(THROW_ROLES), percents: Schema.Array(Schema.Finite) })]);
export const ComboObjectivesSchema = Schema.Struct({
  links: Schema.Array(ComboObjectiveSchema),
  throws: Schema.Record(Schema.String, Schema.Struct({ forward: DeclaredThrowSchema, back: DeclaredThrowSchema, up: DeclaredThrowSchema, down: DeclaredThrowSchema })),
});
export type ComboObjectives = typeof ComboObjectivesSchema.Type;

export const throwDeclarations = (objectives: ComboObjectives): ThrowDeclaration[] =>
  Object.entries(objectives.throws).flatMap(([fighter, throws]) => THROW_DIRECTIONS.map((direction): ThrowDeclaration => {
    const declared = throws[direction];
    return typeof declared === "string" ? { fighter, throw: direction, role: declared, percents: ROLE_PERCENTS[declared] } : { fighter, throw: direction, ...declared };
  }));

const STRENGTH: Readonly<Record<LinkClass, number>> = { none: 0, read: 1, "DI-dependent": 2, true: 3 };

export const objectiveName = (objective: ComboObjective): string =>
  `${objective.fighter} ${objective.opener} (${objective.region}) at ${objective.percent[0]}-${objective.percent[1]}% into ${objective.followUp} against weight ${objective.weight}, ${objective.class}${objective.di === undefined ? "" : ` with DI ${objective.di.join(" or ")}`}`;

function rowMiss(objective: ComboObjective, row: LinkRow | undefined): string | undefined {
  if (row === undefined) return "no link row";
  if (STRENGTH[row.class] < STRENGTH[objective.class]) return row.class;
  const escapes = (objective.di ?? []).filter((di) => row.diEscapes.includes(di));
  return escapes.length === 0 ? undefined : `DI ${escapes.join(" and ")} escapes`;
}

export function objectiveMisses(objective: ComboObjective, rows: readonly LinkRow[]): string[] {
  const [from, to] = objective.percent;
  const percents = LINK_PERCENTS.filter((percent) => percent >= from && percent <= to);
  if (percents.length === 0) return [`the window holds none of the link table's percents ${LINK_PERCENTS.join(", ")}`];
  return percents.flatMap((percent) => {
    const row = rows.find((own) => own.fighter === objective.fighter && own.opener === objective.opener && own.region === objective.region
      && own.percent === percent && own.weight === objective.weight && own.followUp === objective.followUp);
    const miss = rowMiss(objective, row);
    return miss === undefined ? [] : [`${percent}%: ${miss}`];
  });
}
