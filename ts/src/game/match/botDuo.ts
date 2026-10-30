import { f32 } from "wisp/src/sim/f32";
import { floorDiv } from "wisp/src/sim/intMath";
import { type AttackBuffer, queueAttack } from "../input/attackBuffer";
import { AttackStyle, DuoOrder, DuoRole, LedgeState, SpecialAction } from "../sim/codes";
import { canAttack } from "../sim/conditions";
import { reviveReady, swapReady } from "../sim/duoPartner";
import { TOSS } from "../sim/duoToss";
import type { Fighter } from "../sim/fighter";
import { type Controls, type Roster, fighterAt, isActive } from "../sim/roster";
import { mainDeckLeft, mainDeckRight } from "../sim/stage";
import { insideLip } from "./botCorner";
import { recoveringBelow } from "./botEdgeGuard";
import { botChance } from "./botRandom";
import type { CpuSkill } from "./cpuSkill";

export const REVIVE_FOE_GAP = 400.0;
const PINCER_REACH = 300.0;
const PINCER_MIN = 60.0;
const PINCER_LEDGE = 260.0;
const PINCER_FRAMES = 240;
const SWAP_HOLD_FRAMES = 20;
const TOSS_FOE_REACH = 320.0;
const TOSS_PARTNER_REACH = 40.0;
const TOSS_LIP_BAND = 200.0;
const ORDER_CHANCE_FRAMES = 20;

const expert = (skill: CpuSkill): boolean => skill.tier === "expert";

function partnerOf(world: Readonly<Roster>, leader: Readonly<Fighter>): Fighter | undefined {
  const { duo } = leader;
  if (duo === undefined || duo.role !== DuoRole.leader || !isActive(world, duo.link)) return undefined;
  return fighterAt(world, duo.link);
}

export function holdsPartner(leader: Readonly<Fighter>): boolean {
  return leader.duo?.role === DuoRole.leader && leader.grab.target !== undefined && leader.grab.target === leader.duo.link;
}

export function tossToward(leader: Readonly<Fighter>, foe: Readonly<Fighter>, input: Controls): void {
  input.grabThrowX = foe.motion.x < leader.motion.x ? -1 : 1;
}

function pressDown(input: Controls, held: boolean): void {
  input.specialPressed = !held;
  input.specialHeld = held;
  input.specialX = 0;
  input.specialZ = -1;
  input.verticalDirection = -1;
}

const offstage = (f: Readonly<Fighter>, stage: number): boolean => !f.motion.grounded && insideLip(stage, f.motion.x) < 0.0;

function foeBetweenAndLedge(f: Readonly<Fighter>, foe: Readonly<Fighter>, stage: number): boolean {
  const gap = f32(foe.motion.x - f.motion.x);
  if (Math.abs(gap) > PINCER_REACH || Math.abs(gap) < PINCER_MIN) return false;
  const lip = gap < 0 ? mainDeckLeft(stage) : mainDeckRight(stage);
  return Math.abs(f32(lip - foe.motion.x)) <= PINCER_LEDGE && Math.abs(f32(lip - f.motion.x)) > Math.abs(f32(lip - foe.motion.x));
}

function reviveOrSwap(world: Readonly<Roster>, f: Readonly<Fighter>, partner: Readonly<Fighter>, foe: Readonly<Fighter>, stage: number, skill: CpuSkill, input: Controls): boolean {
  if (partner.status.out) {
    if (!f.motion.grounded || Math.abs(f32(foe.motion.x - f.motion.x)) <= REVIVE_FOE_GAP || !reviveReady(world, f)) return false;
    pressDown(input, false);
    return true;
  }
  if (!expert(skill) || !offstage(f, stage) || f.ledge.state !== LedgeState.none || f.special.fall) return false;
  if (!partner.motion.grounded || insideLip(stage, partner.motion.x) <= 0.0 || !swapReady(world, f)) return false;
  pressDown(input, false);
  return true;
}

function pressOrder(f: Readonly<Fighter>, partner: Readonly<Fighter>, foe: Readonly<Fighter>, stage: number, frame: number, input: Controls): boolean {
  const order = partner.duo?.order;
  const pincer = foe.motion.grounded && foeBetweenAndLedge(f, foe, stage);
  const call = order === DuoOrder.hold ? (partner.duo?.orderFrame ?? 0) >= PINCER_FRAMES || !pincer
    : order === DuoOrder.copy && pincer && botChance(floorDiv(frame, ORDER_CHANCE_FRAMES), f.character * 5 + 3, 6, 10);
  if (call) pressDown(input, false);
  return call;
}

function pressToss(f: Readonly<Fighter>, partner: Readonly<Fighter>, foe: Readonly<Fighter>, stage: number, frame: number, commands: AttackBuffer): boolean {
  const order = partner.duo?.order;
  const gap = Math.abs(f32(foe.motion.x - f.motion.x));
  const ready = f.duo?.tossCooldown === 0 && partner.motion.grounded && partner.attack.style === undefined
    && Math.abs(f32(partner.motion.x - f.motion.x)) <= TOSS_PARTNER_REACH && (order === DuoOrder.copy || order === DuoOrder.hold);
  if (!ready || gap > TOSS_FOE_REACH || gap <= TOSS.liftReach || insideLip(stage, f.motion.x) >= TOSS_LIP_BAND) return false;
  if (!recoveringBelow(foe, stage) && !offstage(foe, stage)) return false;
  queueAttack(commands, { style: AttackStyle.grab, facing: foe.motion.x < f.motion.x ? -1 : 1, frame, mayCharge: false, cStick: false });
  return true;
}

export function pressDuoCall(world: Readonly<Roster>, f: Readonly<Fighter>, foe: Readonly<Fighter>, stage: number, skill: CpuSkill, frame: number, input: Controls, commands: AttackBuffer): boolean {
  const partner = partnerOf(world, f);
  if (partner === undefined) return false;
  if (f.special.action === SpecialAction.heroDown) {
    if (f.special.frame >= SWAP_HOLD_FRAMES || !expert(skill) || !offstage(f, stage)) return false;
    pressDown(input, true);
    return true;
  }
  if (!canAttack(f) || f.launch.hitstun > 0 || f.special.action !== SpecialAction.none) return false;
  if (reviveOrSwap(world, f, partner, foe, stage, skill, input)) return true;
  if (!expert(skill) || partner.status.out || !f.motion.grounded) return false;
  return pressOrder(f, partner, foe, stage, frame, input) || pressToss(f, partner, foe, stage, frame, commands);
}
