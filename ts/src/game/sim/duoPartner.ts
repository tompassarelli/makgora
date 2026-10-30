import { blastFighterFields } from "../../generated/state/fighterState";
import { inGrabContext } from "./conditions";
import { DownState, DuoOrder, DuoRole, LedgeState } from "./codes";
import { type Fighter, type MeleeMotionValue, mutableDuo } from "./fighter";
import { setWorldMotionValue } from "./motion";
import { type Controls, type Roster, fighterAt, isActive } from "./roster";
import { floorSurfaceBelow, surfaceZAt } from "./stage";
import { respawnFighter } from "./respawn";
import { clearGrabLinks, clearOwnedFreezeTrap, clearSpecialOnStock } from "./transitions";

export function partnerDeparts(world: Roster, slot: number): void {
  const f = fighterAt(world, slot);
  if (f.status.out) return;
  clearGrabLinks(world, slot);
  clearSpecialOnStock(f);
  clearOwnedFreezeTrap(f);
  blastFighterFields(f);
  f.status.stocks = 0;
  f.status.respawn = 0;
}

export function partnerReturns(world: Roster, slot: number, x: number): void {
  respawnFighter(world, slot, x);
  fighterAt(world, slot).status.stocks = 1;
}

export type ReviveSpec = { readonly frame: number; readonly offsetX: number } | undefined;

export type OrderSpec = { readonly frame: number } | undefined;

/** A cast that calls the partner needs a linked partner either in the match, to be ordered, or out of it with the revive unspent. */
export function partnerCallBlocked(world: Roster | undefined, leader: Readonly<Fighter>, move: { readonly order?: OrderSpec; readonly revive?: ReviveSpec; readonly swapHold?: SwapHoldSpec }): boolean {
  if (move.order === undefined && move.revive === undefined) return move.swapHold !== undefined && (world === undefined || !swapReady(world, leader));
  return world === undefined || !(orderReady(world, leader) || reviveReady(world, leader));
}

/** The first variant of a calling cast is the revive, taken when the partner is out. */
export function callVariant(world: Roster | undefined, leader: Readonly<Fighter>, move: { readonly order?: OrderSpec }): number | undefined {
  return move.order !== undefined && world !== undefined && reviveReady(world, leader) ? 1 : undefined;
}

/** Whether the leader has a linked partner in the match to order. */
export function orderReady(world: Roster, leader: Readonly<Fighter>): boolean {
  const { duo } = leader;
  return duo !== undefined && duo.role === DuoRole.leader && isActive(world, duo.link) && !fighterAt(world, duo.link).status.out;
}

function orderOnFrame(world: Roster | undefined, leader: Readonly<Fighter>, order: OrderSpec, frame: number, held: boolean): void {
  if (order?.frame === frame && !held && world !== undefined && orderReady(world, leader)) toggleOrder(world, leader);
}

/** Hold becomes Regroup; Copy, Regroup and Separated become Hold. A tossed or fainted partner takes no order. */
function toggleOrder(world: Roster, leader: Readonly<Fighter>): void {
  const duo = mutableDuo(fighterAt(world, leader.duo?.link ?? -1));
  if (duo.order === DuoOrder.tossed || duo.order === DuoOrder.fainted) return;
  duo.order = duo.order === DuoOrder.hold ? DuoOrder.regroup : DuoOrder.hold;
  duo.orderFrame = 0;
}

export function reviveOnFrame(world: Roster | undefined, leader: Fighter, revive: ReviveSpec, frame: number, stage: number, matchFrame: number): void {
  if (revive?.frame === frame && world !== undefined) revivePartner(world, leader, revive.offsetX, stage, matchFrame);
}

/** Whether a leader who has not spent its revive has a linked partner that is out of the match. */
export function reviveReady(world: Roster, leader: Readonly<Fighter>): boolean {
  const { duo } = leader;
  if (duo === undefined || duo.role !== DuoRole.leader || duo.reviveSpent || !isActive(world, duo.link)) return false;
  return fighterAt(world, duo.link).status.out;
}

/** Brings the leader's out partner back at 0% on the floor `offsetX` behind it, or ahead of it when nothing is under that spot, and spends the leader's revive. */
export function revivePartner(world: Roster, leader: Fighter, offsetX: number, stage: number, matchFrame: number): void {
  if (!reviveReady(world, leader)) return;
  const duo = mutableDuo(leader);
  const slot = duo.link;
  const behind = leader.motion.x - leader.facing * offsetX;
  const ahead = leader.motion.x + leader.facing * offsetX;
  const reach = leader.motion.z + 1.0;
  const x = floorSurfaceBelow(stage, matchFrame, behind, reach) !== undefined ? behind
    : floorSurfaceBelow(stage, matchFrame, ahead, reach) !== undefined ? ahead : leader.motion.x;
  partnerReturns(world, slot, x);
  const partner = fighterAt(world, slot);
  const surface = floorSurfaceBelow(stage, matchFrame, x, reach) ?? leader.motion.surface;
  partner.motion.grounded = true;
  partner.motion.surface = surface;
  partner.motion.z = surface === undefined ? leader.motion.z : surfaceZAt(stage, surface, matchFrame, x);
  setWorldMotionValue(partner.motion.meleeX, partner.motion.x);
  setWorldMotionValue(partner.motion.meleeZ, partner.motion.z);
  partner.status.invincible = 0;
  partner.facing = leader.facing;
  duo.reviveSpent = true;
}

export type SwapHoldSpec = { readonly frame: number; readonly variant: number } | undefined;

export type SwapSpec = { readonly frame: number; readonly cooldown: number } | undefined;

const swappable = (f: Readonly<Fighter>): boolean =>
  !f.status.out && f.launch.hitstun <= 0 && f.launch.hitlag <= 0 && !f.special.fall && !inGrabContext(f)
  && f.ledge.state === LedgeState.none && f.down.state === DownState.none && f.status.frozenFrames <= 0;

export function swapReady(world: Roster, leader: Readonly<Fighter>): boolean {
  const { duo } = leader;
  if (duo === undefined || duo.role !== DuoRole.leader || duo.swapCooldown > 0 || !isActive(world, duo.link)) return false;
  return swappable(leader) && swappable(fighterAt(world, duo.link));
}

function swapHoldOnFrame(world: Roster | undefined, leader: Fighter, hold: SwapHoldSpec, frame: number, held: boolean): void {
  if (hold?.frame === frame && held && world !== undefined && swapReady(world, leader)) leader.special.variant = hold.variant;
}

function swapMotionValue(a: MeleeMotionValue, b: MeleeMotionValue): void {
  const original = a.original;
  const published = a.published;
  a.original = b.original;
  a.published = b.published;
  b.original = original;
  b.published = published;
}

function swapOnFrame(world: Roster | undefined, leader: Fighter, swap: SwapSpec, frame: number): void {
  if (swap?.frame !== frame || world === undefined || !swapReady(world, leader)) return;
  const duo = mutableDuo(leader);
  const partner = fighterAt(world, duo.link);
  const a = leader.motion;
  const b = partner.motion;
  const { x, z, deltaX, deltaZ, vx, vz, grounded, surface, fastFalling } = a;
  const jumps = leader.jump.remaining;
  a.x = b.x;
  a.z = b.z;
  a.deltaX = b.deltaX;
  a.deltaZ = b.deltaZ;
  a.vx = b.vx;
  a.vz = b.vz;
  a.grounded = b.grounded;
  a.surface = b.surface;
  a.fastFalling = b.fastFalling;
  b.x = x;
  b.z = z;
  b.deltaX = deltaX;
  b.deltaZ = deltaZ;
  b.vx = vx;
  b.vz = vz;
  b.grounded = grounded;
  b.surface = surface;
  b.fastFalling = fastFalling;
  leader.jump.remaining = partner.jump.remaining;
  partner.jump.remaining = jumps;
  swapMotionValue(a.meleeX, b.meleeX);
  swapMotionValue(a.meleeZ, b.meleeZ);
  swapMotionValue(a.meleeVelocityZ, b.meleeVelocityZ);
  duo.swapCooldown = swap.cooldown;
  mutableDuo(partner).swapCooldown = swap.cooldown;
}

export function duoCastOnFrame(world: Roster | undefined, leader: Fighter, move: { readonly order?: OrderSpec; readonly swapHold?: SwapHoldSpec; readonly swap?: SwapSpec }, frame: number, input: Readonly<Controls> | undefined): void {
  const held = input?.specialHeld === true;
  orderOnFrame(world, leader, move.order, frame, held);
  swapHoldOnFrame(world, leader, move.swapHold, frame, held);
  swapOnFrame(world, leader, move.swap, frame);
}
