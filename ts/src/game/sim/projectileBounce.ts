import { f32 } from "wisp/src/sim/f32";
import { max, min } from "../core/numbers";
import { PARTICIPANT_CAPACITY } from "../input/participants";
import type { Projectile } from "./fighter";
import { METER } from "./meter";
import { type Roster, fighterAt, isActive } from "./roster";
import { canHit, sameTeam } from "./teams";

const CENTRE_HEIGHT = 45.0;

export function clearBounce(projectile: Projectile): void {
  projectile.bounces = 0;
  projectile.homeward = false;
  projectile.carriedEx = 0;
  projectile.lastStruck = undefined;
}

function nextTarget(world: Roster, ownerSlot: number, projectile: Readonly<Projectile>, range: number): number | undefined {
  let nearest: number | undefined;
  let distance = 0.0;
  for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) {
    if (!isActive(world, slot) || slot === projectile.lastStruck || !canHit(world, ownerSlot, slot) || sameTeam(world, ownerSlot, slot)) continue;
    const target = fighterAt(world, slot);
    if (target.status.out) continue;
    const apart = max(Math.abs(f32(target.motion.x - projectile.x)), Math.abs(f32(f32(target.motion.z + CENTRE_HEIGHT) - projectile.z)));
    if (apart > range || (nearest !== undefined && apart >= distance)) continue;
    nearest = slot;
    distance = apart;
  }
  return nearest;
}

function steer(projectile: Projectile, x: number, z: number, speed: number): void {
  const dx = f32(x - projectile.x);
  projectile.velocityX = dx < 0 ? -speed : speed;
  projectile.velocityZ = min(speed, max(-speed, f32(z - projectile.z)));
  projectile.direction = dx < 0 ? -1 : 1;
}

export function bounceAfterHit(world: Roster, ownerSlot: number, projectile: Projectile, struckSlot: number): boolean {
  const spec = projectile.spec;
  const bounce = spec?.bounce;
  if (spec === undefined || bounce === undefined) return false;
  const struck = fighterAt(world, struckSlot);
  const stolen = min(struck.meter.ex, bounce.steal);
  struck.meter.ex -= stolen;
  projectile.carriedEx += stolen;
  projectile.lastStruck = struckSlot;
  projectile.damageMultiplier = f32(projectile.damageMultiplier * bounce.falloff);
  if (projectile.bounces < bounce.count && nextTarget(world, ownerSlot, projectile, bounce.range) !== undefined) projectile.bounces++;
  else projectile.homeward = true;
  projectile.life = projectile.homeward ? spec.life * 2 : spec.life;
  return true;
}

export function steerBounce(world: Roster, ownerSlot: number, projectile: Projectile): boolean {
  const bounce = projectile.spec?.bounce;
  if (bounce === undefined || (projectile.bounces === 0 && !projectile.homeward)) return false;
  if (!projectile.homeward) {
    const next = nextTarget(world, ownerSlot, projectile, bounce.range);
    if (next !== undefined) {
      const target = fighterAt(world, next);
      steer(projectile, target.motion.x, f32(target.motion.z + CENTRE_HEIGHT), bounce.speed);
      return false;
    }
    projectile.homeward = true;
  }
  const owner = fighterAt(world, ownerSlot);
  const homeZ = f32(owner.motion.z + CENTRE_HEIGHT);
  if (owner.status.out || (Math.abs(f32(owner.motion.x - projectile.x)) <= bounce.speed && Math.abs(f32(homeZ - projectile.z)) <= bounce.speed)) {
    if (!owner.status.out) owner.meter.ex = min(METER.exFrames, owner.meter.ex + projectile.carriedEx);
    projectile.life = 0;
    return true;
  }
  steer(projectile, owner.motion.x, homeZ, bounce.speed);
  projectile.x = f32(projectile.x + projectile.velocityX);
  projectile.z = f32(projectile.z + projectile.velocityZ);
  projectile.life--;
  return true;
}
