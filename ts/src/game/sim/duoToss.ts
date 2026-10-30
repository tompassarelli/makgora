import { f32 } from "wisp/src/sim/f32";
import { canHit } from "./teams";
import { AttackStyle, ContactKind, DuoOrder, DuoRole, GrabAction, HitElement } from "./codes";
import { canStartAttack, isIntangible } from "./conditions";
import { queueDamageContact } from "./contacts";
import type { HitEffect } from "./hitRegions";
import { alreadyHitRegion, recordHitRegion } from "./hitEntries";
import { catchTarget } from "./hits";
import { type Fighter, mutableDuo } from "./fighter";
import { PARTICIPANT_CAPACITY } from "../input/participants";
import { emptyCapsule, placeCapsule } from "./geometry/contactGeometry";
import { HurtContact, fighterHurtParts, strikeHurtContact } from "./hurtboxes";
import { type Roster, fighterAt, isActive } from "./roster";

export const TOSS = {
  cooldownFrames: 150,
  liftReach: 60.0,
  contactDamage: 8.0,
  forwardSpeed: 16.0,
  forwardLift: 14.0,
  upSpeed: 3.0,
  upLift: 20.0,
  downSpeed: 4.0,
  downLift: -6.0,
} as const;

const TOSS_HIT: Readonly<HitEffect> = { damage: TOSS.contactDamage, growth: 40.0, base: 20.0, launchX: f32(0.766044443), launchZ: f32(0.64278761), electric: false, element: HitElement.normal };

const body = emptyCapsule();

/** A partner is free to be lifted when idle, or when the only thing it is doing is its copy of the leader's own grab. */
function actionable(partner: Readonly<Fighter>): boolean {
  if (partner.attack.style === undefined) return canStartAttack(partner);
  return partner.attack.style === AttackStyle.grab && partner.grab.target === undefined && partner.grab.grabbedFrames <= 0
    && partner.launch.hitlag <= 0 && partner.launch.hitstun <= 0 && partner.shield.stun <= 0;
}

/** The partner slot a leader's grab may lift: a live partner in the copy or hold order, actionable and within reach, while the leader's toss is ready. */
function liftablePartner(world: Roster, ownerSlot: number): number | undefined {
  const owner = fighterAt(world, ownerSlot);
  const { duo } = owner;
  if (duo === undefined || duo.role !== DuoRole.leader || duo.tossCooldown > 0 || !isActive(world, duo.link)) return undefined;
  const partner = fighterAt(world, duo.link);
  const order = partner.duo?.order;
  if (partner.status.out || !partner.motion.grounded || !actionable(partner)) return undefined;
  if (order === DuoOrder.tossed) return undefined;
  return Math.abs(f32(partner.motion.x - owner.motion.x)) <= TOSS.liftReach ? duo.link : undefined;
}

/** A grab that caught no foe lifts the leader's partner instead. */
export function liftPartner(world: Roster, ownerSlot: number): void {
  const slot = liftablePartner(world, ownerSlot);
  if (slot !== undefined) catchTarget(world, ownerSlot, slot);
}

/** Whether a throw releases the owner's own partner, who flies as a body projectile instead of being hurt. */
export function tossPartner(world: Roster, ownerSlot: number, targetSlot: number, action: GrabAction): boolean {
  if (world.linked[ownerSlot] !== targetSlot) return false;
  const owner = fighterAt(world, ownerSlot);
  const partner = fighterAt(world, targetSlot);
  const facing = owner.facing;
  const up = action === GrabAction.throwUp;
  const down = action === GrabAction.throwDown;
  const direction = action === GrabAction.throwBack ? -facing : facing;
  partner.motion.vx = f32(direction * (up ? TOSS.upSpeed : down ? TOSS.downSpeed : TOSS.forwardSpeed));
  partner.motion.vz = up ? TOSS.upLift : down ? TOSS.downLift : TOSS.forwardLift;
  partner.motion.grounded = false;
  partner.motion.surface = undefined;
  partner.attack.serial++;
  const duo = mutableDuo(partner);
  duo.order = DuoOrder.tossed;
  duo.orderFrame = 0;
  mutableDuo(owner).tossCooldown = TOSS.cooldownFrames;
  return true;
}

export function advanceTossCooldown(fighter: Fighter): void {
  const { duo } = fighter;
  if (duo !== undefined && duo.role === DuoRole.leader && duo.tossCooldown > 0) duo.tossCooldown--;
}

/** A tossed partner's body hits each foe it touches once per toss. */
export function strikeWithTossed(world: Roster): void {
  for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) {
    if (!isActive(world, slot)) continue;
    const partner = fighterAt(world, slot);
    if (partner.duo?.order !== DuoOrder.tossed || partner.duo.role !== DuoRole.partner || partner.launch.hitlag > 0) continue;
    for (let target = 0; target < PARTICIPANT_CAPACITY; target++) {
      if (!isActive(world, target) || !canHit(world, slot, target)) continue;
      const foe = fighterAt(world, target);
      if (foe.status.out || isIntangible(foe) || alreadyHitRegion(slot, partner, foe, 1) || !touches(partner, foe)) continue;
      recordHitRegion(slot, partner, foe, 1);
      queueDamageContact(world, slot, target, TOSS_HIT, foe.motion.x < partner.motion.x ? -1 : 1, ContactKind.launch, true, undefined);
    }
  }
}

function touches(partner: Readonly<Fighter>, foe: Readonly<Fighter>): boolean {
  for (const part of fighterHurtParts(partner)) {
    placeCapsule(body, part, partner.motion.x, partner.motion.z, partner.facing);
    if (strikeHurtContact(body, foe) === HurtContact.hit) return true;
  }
  return false;
}
