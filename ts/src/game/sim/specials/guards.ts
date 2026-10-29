import { canHit } from "../teams";
import { max, min } from "../../core/numbers";
import { f32 } from "wisp/src/sim/f32";
import { AttackStyle } from "../codes";
import type { Fighter } from "../fighter";
import { FOLLOW_UP_FORM, type FrameWindow, type SpecialGuard } from "./schema";
import { authoredHitRegion, authoredHitRegionCount, emptyHitRegion } from "../hitRegions";
import { type Roster, fighterAt, isActive } from "../roster";
import { attackCapsule, emptyCapsule, placeCapsule } from "../geometry/contactGeometry";
import { HurtContact, strikeHurtContact } from "../hurtboxes";
import { PARTICIPANT_CAPACITY } from "../../input/participants";
import { currentTraits } from "../identityTraits";
import { clearMotionValue } from "../motion";
import { enterFollowUp } from "./heroForms";
import { heroRegionOrigin, placeHeroStrike } from "./heroContact";
import { runningHeroSpecial } from "./runningMove";

const inWindow = (window: Readonly<FrameWindow>, frame: number): boolean => frame >= window.first && frame <= window.last;

const guardRegion = emptyHitRegion();
const guardStrike = emptyCapsule();

const ORIGINAL_PROJECTILE_RADIUS = 24.0;

const Threat = { none: 0, strike: 1, projectile: 2 } as const;
type Threat = (typeof Threat)[keyof typeof Threat];

function attackThreatens(attacker: Readonly<Fighter>, target: Readonly<Fighter>): boolean {
  const { attack } = attacker;
  if (attack.style === undefined || attack.style === AttackStyle.grab) return false;
  const moves = attacker.tuning.moves;
  for (let index = 0; index < authoredHitRegionCount(attack.style, moves); index++) {
    authoredHitRegion(guardRegion, attacker.character, attack.style, attack.frame, attack.smashChargeFrames, index, moves);
    if (guardRegion.window <= 0 || guardRegion.effect.damage <= 0) continue;
    attackCapsule(guardStrike, attack.style, guardRegion);
    placeCapsule(guardStrike, guardStrike, attacker.motion.x, attacker.motion.z, attacker.facing);
    if (strikeHurtContact(guardStrike, target) !== HurtContact.none) return true;
  }
  return false;
}

function specialThreatens(attacker: Readonly<Fighter>, target: Readonly<Fighter>): boolean {
  const special = runningHeroSpecial(attacker);
  const origin = heroRegionOrigin(attacker);
  for (const region of special?.regions ?? []) {
    const strike = region.hit.strike;
    if (strike === undefined || attacker.special.frame < region.firstFrame || attacker.special.frame > region.lastFrame || region.hit.effect.damage <= 0) continue;
    placeHeroStrike(guardStrike, attacker, strike, origin.x, origin.z);
    if (strikeHurtContact(guardStrike, target) !== HurtContact.none) return true;
  }
  return false;
}

function projectileThreatens(attacker: Readonly<Fighter>, target: Readonly<Fighter>): boolean {
  for (const projectile of attacker.projectiles) {
    if (projectile.life <= 0) continue;
    guardStrike.x1 = projectile.x;
    guardStrike.z1 = projectile.z;
    guardStrike.x2 = f32(projectile.x + projectile.velocityX);
    guardStrike.z2 = f32(projectile.z + projectile.velocityZ);
    guardStrike.radius = projectile.spec?.radius ?? ORIGINAL_PROJECTILE_RADIUS;
    if (strikeHurtContact(guardStrike, target) !== HurtContact.none) return true;
  }
  return false;
}

function threatensBody(attacker: Readonly<Fighter>, target: Readonly<Fighter>): Threat {
  if (attacker.status.out) return Threat.none;
  if (attackThreatens(attacker, target) || specialThreatens(attacker, target)) return Threat.strike;
  return projectileThreatens(attacker, target) ? Threat.projectile : Threat.none;
}

function stopMotion(f: Fighter): void {
  const { motion } = f;
  motion.vx = 0.0;
  motion.vz = 0.0;
  motion.fastFalling = false;
  clearMotionValue(motion.meleeVelocityZ);
}

function guardSucceeds(f: Fighter, guard: Readonly<SpecialGuard>, attacker: Fighter, attackerSlot: number, threat: Threat): void {
  const { status } = f;
  f.special.guarded = true;
  if (guard.counter === true) {
    const next = runningHeroSpecial(f)?.followUps?.[0]?.special;
    if (next !== undefined) {
      if (threat === Threat.strike && guard.freezeFrames !== undefined) {
        f.special.seekTarget = attackerSlot + 1;
        attacker.launch.hitlag = max(attacker.launch.hitlag, guard.freezeFrames);
        stopMotion(attacker);
      }
      f.special.form += FOLLOW_UP_FORM;
      enterFollowUp(f, next);
      status.invincible = max(status.invincible, 2);
      return;
    }
  }
  if (currentTraits(f).heal === true) {
    const heal = min(guard.heal, max(0.0, status.damage));
    status.damage = f32(status.damage - heal);
  }
  if (guard.shieldFrames !== undefined) {
    status.invincible = max(status.invincible, guard.shieldFrames);
    status.divineFrames = guard.shieldFrames;
  }
}

export function resolveHeroGuards(world: Roster): void {
  for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) {
    if (!isActive(world, slot)) continue;
    const f = fighterAt(world, slot);
    const guard = runningHeroSpecial(f)?.guard;
    if (guard === undefined || f.special.guarded || !inWindow(guard, f.special.frame + 1)) continue;
    for (let other = 0; other < PARTICIPANT_CAPACITY; other++) {
      if (!canHit(world, other, slot) || !isActive(world, other)) continue;
      const attacker = fighterAt(world, other);
      const threat = threatensBody(attacker, f);
      if (threat === Threat.none) continue;
      guardSucceeds(f, guard, attacker, other, threat);
      break;
    }
  }
}
