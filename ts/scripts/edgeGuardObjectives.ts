import { Schema } from "effect";
import { f32 } from "wisp/src/sim/f32";
import type { ComboSetup } from "../src/game/match/comboRoute";
import { type Character, LedgeState } from "../src/game/sim/codes";
import type { Fighter } from "../src/game/sim/fighter";
import { mainDeckLeft, mainDeckRight, mainDeckZ } from "../src/game/sim/stage";
import { DIS, type Defender, type Di, OPENERS, type Opener, PERCENTS, defenderMask, free, openerRoot, settled } from "./comboExplorer";
import { VICTIM } from "./throwRoleObjectives";

export const EDGE_GUARD_MOVES = ["back air", "down air", "down special"] as const;

export const EdgeGuardObjectiveSchema = Schema.Struct({
  fighter: Schema.String,
  move: Schema.Literals(EDGE_GUARD_MOVES),
  percent: Schema.Tuple([Schema.Finite, Schema.Finite]),
  weight: Schema.Finite,
  victim: Schema.Struct({ pastLedge: Schema.Finite, height: Schema.Finite }),
  di: Schema.Array(Schema.Literals(DIS)),
});
export type EdgeGuardObjective = typeof EdgeGuardObjectiveSchema.Type;

export interface EdgeGuardUnit {
  readonly attacker: Character;
  readonly objective: EdgeGuardObjective;
}

export interface EdgeGuardResult {
  readonly name: string;
  readonly passes: boolean;
  readonly measured: string;
  readonly problems: readonly string[];
}

const STAGE = 0;
const HORIZON = 600;
const REACHES = [0, 10, 20, 30, 40, 50, 60, 80] as const;
const HEIGHTS = [0, 20, 40, 60, 80, 100, 120, -20, -40, -60, -80] as const;

const edgeGuardName = (objective: EdgeGuardObjective): string =>
  `${objective.fighter} ${objective.move} at ${objective.percent[0]}-${objective.percent[1]}% on a weight-${objective.weight} victim ${objective.victim.pastLedge} past the ledge at height ${objective.victim.height}, kills against DI ${objective.di.join(", ")}`;

function openerFor(move: EdgeGuardObjective["move"]): Opener {
  const opener = OPENERS.find((candidate) => candidate.name === move);
  if (opener === undefined) throw new Error(`no ${move} opener`);
  return opener;
}

function placed(attacker: Character, objective: EdgeGuardObjective, percent: number, reach: number, height: number): ComboSetup {
  const defenderX = f32(mainDeckRight(STAGE) + objective.victim.pastLedge);
  const defenderZ = f32(mainDeckZ(STAGE) + objective.victim.height);
  return {
    stage: STAGE, attacker, defender: VICTIM, attackerX: f32(defenderX - reach), defenderX, facing: objective.move === "back air" ? -1 : 1,
    attackerZ: f32(defenderZ + height), defenderZ, percent, defenderWeight: objective.weight,
  };
}

function edgeSetup(attacker: Character, objective: EdgeGuardObjective, percent: number): ComboSetup | undefined {
  const opener = openerFor(objective.move);
  for (const height of HEIGHTS) for (const reach of REACHES) {
    const setup = placed(attacker, objective, percent, reach, height);
    const played = openerRoot(setup, opener, { name: "none", di: "none" });
    if (played === undefined) continue;
    free(played.root.saved);
    return setup;
  }
  return undefined;
}

type Outcome = "kill" | "ledge" | "stage" | "offstage";

const onStage = (b: Readonly<Fighter>): boolean => b.motion.grounded && b.motion.x >= mainDeckLeft(STAGE) && b.motion.x <= mainDeckRight(STAGE);

function recover(setup: ComboSetup, move: EdgeGuardObjective["move"], di: Di): Outcome | undefined {
  const d: Defender = { name: di, di };
  const played = openerRoot(setup, openerFor(move), d);
  if (played === undefined) return undefined;
  const { sim } = played;
  const stocks = sim.b.status.stocks;
  let freedAt: number | undefined;
  let outcome: Outcome = "offstage";
  for (let n = 1; n <= HORIZON; n++) {
    sim.step(0, defenderMask(d, n, freedAt, sim.b, sim.a));
    const b = sim.b;
    if (b.status.stocks < stocks) { outcome = "kill"; break; }
    if (b.ledge.state === LedgeState.hang) { outcome = "ledge"; break; }
    if (onStage(b)) { outcome = "stage"; break; }
    if (freedAt === undefined && settled(b)) freedAt = n;
  }
  free(played.root.saved);
  return outcome;
}

export function checkEdgeGuard({ attacker, objective }: EdgeGuardUnit): EdgeGuardResult {
  const [from, to] = objective.percent;
  const percents = PERCENTS.filter((percent) => percent >= from && percent <= to);
  const problems: string[] = percents.length === 0 ? [`the window holds none of ${PERCENTS.join(", ")}`] : [];
  const cells = percents.map((percent) => {
    const setup = edgeSetup(attacker, objective, percent);
    if (setup === undefined) {
      problems.push(`${objective.move} does not reach the victim at ${percent}%`);
      return `${percent}%: no hit`;
    }
    const outcomes = DIS.map((di) => [di, recover(setup, objective.move, di)] as const);
    const saved = outcomes.filter(([di, outcome]) => objective.di.includes(di) && outcome !== "kill");
    if (saved.length > 0) problems.push(`at ${percent}% ${saved.map(([di, outcome]) => `DI ${di} reaches ${outcome ?? "no hit"}`).join(", ")}`);
    const escapes = outcomes.filter(([, outcome]) => outcome !== "kill");
    return `${percent}%: ${escapes.length === 0 ? "kill" : escapes.map(([di, outcome]) => `${di} ${outcome ?? "no hit"}`).join(", ")}`;
  });
  return { name: edgeGuardName(objective), passes: problems.length === 0, measured: cells.join("; "), problems };
}
