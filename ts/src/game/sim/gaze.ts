import { f32 } from "wisp/src/sim/f32";
import { addFloat32, subtractFloat32 } from "wisp/src/sim/binary32";
import { max, min } from "../core/numbers";
import { PARTICIPANT_CAPACITY } from "../input/participants";
import { isIntangible } from "./conditions";
import type { Fighter } from "./fighter";
import { applyHeroStatus } from "./heroStatus";
import { type Roster, fighterAt, isActive } from "./roster";
import type { SpecialGaze } from "./specials/volleys";
import { canHit, sameTeam } from "./teams";

export const PETRIFY_FRAMES = 60;
export const PETRIFY_DAMAGE_CAP = 26.0;
const GAZE_EYE_HEIGHT = 120.0;
const GAZE_NEAR_HALF_HEIGHT = 60.0;
const BODY_CENTRE = 45.0;

function caught(owner: Readonly<Fighter>, target: Readonly<Fighter>, gaze: Readonly<SpecialGaze>): boolean {
  const ahead = f32(f32(target.motion.x - owner.motion.x) * owner.facing);
  if (ahead < 0.0 || ahead > gaze.range) return false;
  const reach = max(GAZE_NEAR_HALF_HEIGHT, f32(f32(gaze.height * 0.5) * f32(ahead / gaze.range)));
  const rise = Math.abs(f32(f32(target.motion.z + BODY_CENTRE) - f32(owner.motion.z + GAZE_EYE_HEIGHT)));
  return rise <= reach && target.facing === -owner.facing;
}

export function gazeAt(world: Roster, owner: Readonly<Fighter>, gaze: Readonly<SpecialGaze>, frame: number): void {
  if (frame < gaze.window.first || frame > gaze.window.last) return;
  const ownerSlot = world.fighters.indexOf(owner);
  for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) {
    if (!isActive(world, slot) || slot === ownerSlot || !canHit(world, ownerSlot, slot) || sameTeam(world, ownerSlot, slot)) continue;
    const target = fighterAt(world, slot);
    const { status } = target;
    if (status.out || status.petrifyIn > 0 || status.petrified || status.frozenFrames > 0 || isIntangible(target) || !caught(owner, target, gaze)) continue;
    applyHeroStatus(target, gaze.slow);
    status.petrifyIn = gaze.slow.frames;
  }
}

export function advancePetrify(f: Fighter): void {
  const { status } = f;
  if (status.petrifyIn > 0) {
    status.petrifyIn--;
    if (status.petrifyIn > 0 || status.out) return;
    status.frozenFrames = PETRIFY_FRAMES;
    status.petrified = true;
    status.petrifyDamage = 0.0;
    return;
  }
  if (status.petrified && status.frozenFrames <= 0) {
    status.petrified = false;
    status.petrifyDamage = 0.0;
  }
}

export const isPetrified = (f: Readonly<Fighter>): boolean => f.status.petrified && f.status.frozenFrames > 0;

export function petrifiedDamage(f: Fighter, damage: number): number {
  if (!isPetrified(f) || damage <= 0.0) return damage;
  const taken = min(damage, max(0.0, subtractFloat32(PETRIFY_DAMAGE_CAP, f.status.petrifyDamage)));
  f.status.petrifyDamage = addFloat32(f.status.petrifyDamage, taken);
  return taken;
}
