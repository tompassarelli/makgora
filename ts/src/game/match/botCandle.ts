import { f32 } from "wisp/src/sim/f32";
import { floorDiv } from "wisp/src/sim/intMath";
import { type AttackBuffer, queueAttack } from "../input/attackBuffer";
import type { ParticipantSlot } from "../input/participants";
import { AttackStyle, CandleState, Character } from "../sim/codes";
import { canAttack } from "../sim/conditions";
import type { Fighter } from "../sim/fighter";
import { candleLoose } from "../fighters/kobold/candle";
import type { Controls } from "../sim/roster";
import { mainDeckLeft, mainDeckRight } from "../sim/stage";
import { botChance } from "./botRandom";
import type { CpuSkill } from "./cpuSkill";

type Approach = (f: Readonly<Fighter>, stage: number, x: number, z: number, frame: number, input: Controls) => void;

const PLAN_FRAMES = 40;
const CANDLE_CROWD = 60.0;
const CANDLE_SNUFF_HEAT = 150;
const CANDLE_STRIKE_GAP = 30.0;
export const CandlePlay = { none: 0, fetch: 1, wait: 2, snuff: 3, kick: 4 } as const;
export type CandlePlay = (typeof CandlePlay)[keyof typeof CandlePlay];

export function candleContest(training: boolean, fighter: Readonly<Fighter>, target: Readonly<Fighter>, slot: ParticipantSlot, skill: CpuSkill, frame: number): CandlePlay {
  const own = fighter.character === Character.kobold && candleLoose(fighter);
  if (training || !own && (target.character !== Character.kobold || !candleLoose(target))) return CandlePlay.none;
  if (!botChance(floorDiv(frame, PLAN_FRAMES), slot * 31 + fighter.character, skill.contestTenths, 10)) return CandlePlay.none;
  if (!own) return target.candle.heat >= CANDLE_SNUFF_HEAT ? CandlePlay.snuff : CandlePlay.kick;
  const { candle } = fighter;
  const crowded = Math.abs(f32(target.motion.x - candle.x)) <= CANDLE_CROWD && Math.abs(f32(target.motion.z - candle.z)) <= CANDLE_CROWD;
  return crowded && candle.heat === 0 ? CandlePlay.wait : CandlePlay.fetch;
}

function inCandleReach(fighter: Readonly<Fighter>, candle: Readonly<Fighter["candle"]>, side: number): boolean {
  const gap = f32(f32(candle.x - fighter.motion.x) * side);
  return candle.state === CandleState.resting && fighter.motion.grounded && gap >= 20.0 && gap <= 40.0
    && Math.abs(f32(candle.z - fighter.motion.z)) <= 20.0 && fighter.attack.style === undefined && canAttack(fighter);
}

export function pressCandleContest(training: boolean, stage: number, fighter: Readonly<Fighter>, target: Readonly<Fighter>, slot: ParticipantSlot, skill: CpuSkill, frame: number, input: Controls, commands: AttackBuffer, approachPoint: Approach): boolean {
  const play = candleContest(training, fighter, target, slot, skill, frame);
  if (play === CandlePlay.fetch) approachPoint(fighter, stage, fighter.candle.x, fighter.candle.z, frame, input);
  if (play === CandlePlay.none || play === CandlePlay.wait || play === CandlePlay.fetch) return play !== CandlePlay.none;
  const { candle } = target;
  const side = candle.x < f32(f32(mainDeckLeft(stage) + mainDeckRight(stage)) * 0.5) ? -1 : 1;
  if (inCandleReach(fighter, candle, side)) {
    queueAttack(commands, { style: play === CandlePlay.snuff ? AttackStyle.downTilt : AttackStyle.jab, facing: side, frame, mayCharge: false });
  } else approachPoint(fighter, stage, f32(candle.x - f32(side * CANDLE_STRIKE_GAP)), candle.state === CandleState.resting ? candle.z : fighter.motion.z, frame, input);
  return true;
}
