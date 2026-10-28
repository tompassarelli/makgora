import { f32 } from "wisp/src/sim/f32";
import { Character, ProjectileKind } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import { BLASTER_PROJECTILE_SPAWN_OFFSET } from "../sim/projectiles";
import { EYE_BEAM_EX_LIFETIME, EYE_BEAM_LIFETIME, EYE_BEAM_SPEED } from "../sim/eyeBeam";

export const EYE_BEAM_STREAK_LENGTH = 260.0;

export interface EyeBeamStreak {
  tailX: number;
  headX: number;
  z: number;
}

/** The newest live Eye Beam's streak: from his eyes (or a fixed length behind the head once it has flown past) to the head. */
export function eyeBeamStreak(fighter: Readonly<Fighter> | undefined, into: EyeBeamStreak): boolean {
  if (fighter === undefined || fighter.character !== Character.demonHunter || fighter.status.out) return false;
  let found = false;
  let youngest = 0;
  for (const projectile of fighter.projectiles) {
    if (projectile.life <= 0 || projectile.kind !== ProjectileKind.eyeBeam || projectile.visualFamily !== Character.demonHunter || projectile.life <= youngest) continue;
    youngest = projectile.life;
    const flown = f32(f32((projectile.exReach ? EYE_BEAM_EX_LIFETIME : EYE_BEAM_LIFETIME) - projectile.life) * EYE_BEAM_SPEED);
    const behind = Math.min(EYE_BEAM_STREAK_LENGTH, f32(flown + BLASTER_PROJECTILE_SPAWN_OFFSET));
    into.headX = projectile.x;
    into.tailX = f32(projectile.x - f32(projectile.direction * behind));
    into.z = projectile.z;
    found = true;
  }
  return found;
}
