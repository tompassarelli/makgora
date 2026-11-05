import { assertEquals } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { sweep } from "../core/sweep";
import { gatedFighters } from "../roster/forge";
import { AttackStyle, Character } from "./codes";
import { type Fighter, createFighter } from "./fighter";
import { groundState } from "./groundMovement";
import { attackDurationFramesForGrounding } from "./moves";
import { type Roster } from "./roster";
import { surfaceLeft, surfaceRight } from "./stage";
import { GroundState } from "./stickZones";
import { controls } from "./testWorld";
import { duelPair, queueDuelAttack, stepDuel } from "./testDuel";

const STAGE = 0;
const MAIN = 0;
const START = 300.0;
const TARGET = 560.0;
const GAPS = [2.0, 30.0, 90.0, 180.0] as const;
const RUN_LIMIT = 120;

interface DashAttackRun { readonly onStage: boolean; readonly fullAnimation: boolean; readonly endX: number; readonly edge: number }

function edgeOf(side: 1 | -1): number {
  return side > 0 ? surfaceRight(STAGE, MAIN, 0) : surfaceLeft(STAGE, MAIN, 0);
}

function onMain(f: Readonly<Fighter>, edge: number, side: number): boolean {
  return f.motion.grounded && f.motion.surface === MAIN && f32(f.motion.x * side) <= f32(edge * side);
}

function dashAttackAtLedge(character: Character, side: 1 | -1, gap: number): DashAttackRun {
  const edge = edgeOf(side);
  const { world, owner: f } = duelPair(createFighter(character, f32(-side * START), side), createFighter(Character.rifleman, f32(-side * TARGET), side), 3, STAGE);
  const toward = controls({ direction: side });
  runUntil(world, f, edge, side, gap);
  queueDuelAttack(world, AttackStyle.jab, side);
  stepDuel(world, toward, controls(), STAGE);
  const style = f.attack.style;
  assertEquals(style, f.tuning.moves?.dashAttack ?? AttackStyle.dashAttack, `fighter ${character} started ${style} grounded ${f.motion.grounded} x ${f.motion.x}`);
  const total = attackDurationFramesForGrounding(style ?? AttackStyle.dashAttack, true, f.tuning.moves);
  let onStage = onMain(f, edge, side);
  let frames = 1;
  while (f.attack.style === style && frames < total + 30) {
    stepDuel(world, toward, controls(), STAGE);
    onStage = onStage && onMain(f, edge, side);
    frames++;
  }
  return { onStage: onStage && onMain(f, edge, side), fullAnimation: frames >= total, endX: f.motion.x, edge };
}

function runUntil(world: Roster, f: Fighter, edge: number, side: number, gap: number): void {
  const toward = controls({ direction: side });
  let before = Number.NaN;
  for (let frame = 0; frame < RUN_LIMIT && (groundState(f) !== GroundState.run || f.motion.vx !== before); frame++) {
    before = f.motion.vx;
    stepDuel(world, toward, controls(), STAGE);
  }
  assertEquals(groundState(f), GroundState.run);
  assertEquals(f.motion.vx, before);
  f.motion.x = f32(edge - f32(side * f32(gap + Math.abs(f.motion.vx))));
}


function checkDashAttack(fighter: Character, side: 1 | -1, gap: number): void {
  const run = dashAttackAtLedge(fighter, side, gap);
  assertEquals(run.onStage, true, `fighter ${fighter} facing ${side} from ${gap} left the stage`);
  assertEquals(run.fullAnimation, true, `fighter ${fighter} facing ${side} from ${gap} cut its dash attack short`);
  if (gap <= GAPS[1]) assertEquals(run.endX, run.edge);
}

sweep("Dash attack ledge: every fighter's dash attack from a full run toward either ledge at 2, 30, 90 and 180 units, stick held toward it, plays its whole animation and ends on stage, at the ledge from the two nearest [k1 scenario]", () => {
  for (const fighter of gatedFighters()) {
    for (const side of [1, -1] as const) {
      for (const gap of GAPS) checkDashAttack(fighter, side, gap);
    }
  }
});
