import { f32 } from "wisp/src/sim/f32";
import { canBeGrabbed, inGrabContext } from "./conditions";
import type { Fighter, Projectile } from "./fighter";
import { catchTarget } from "./hits";
import { GRAB_HOLD_DISTANCE } from "./moves";
import { type Roster, fighterAt } from "./roster";
import { cancelSpecialState } from "./transitions";

function canReel(owner: Readonly<Fighter>): boolean {
  return !owner.status.out && owner.motion.grounded && owner.launch.hitstun <= 0 && owner.launch.hitlag <= 0 && !inGrabContext(owner);
}

/** A latching hook that reaches a body, unshielded and in its first flight, catches it: its owner stops and holds, and the body is reeled in. */
export function latchesOn(world: Roster, ownerSlot: number, targetSlot: number, projectile: Readonly<Projectile>, shieldContact: boolean): boolean {
  const latch = projectile.spec?.latch;
  if (latch === undefined || shieldContact || projectile.damageMultiplier !== 1.0) return false;
  const owner = fighterAt(world, ownerSlot);
  const target = fighterAt(world, targetSlot);
  if (!canReel(owner) || !canBeGrabbed(target) || inGrabContext(target)) return false;
  cancelSpecialState(owner);
  catchTarget(world, ownerSlot, targetSlot);
  target.grab.grabbedFrames += latch.reelFrames;
  target.grab.reel = latch.reelFrames;
  return true;
}

/** Pulls a reeled body a share of the way to its holder's hand each frame, so it arrives on the last reel frame. */
export function reelHeld(owner: Readonly<Fighter>, target: Fighter): boolean {
  const { grab } = target;
  if (grab.reel <= 0) return false;
  const held = target.motion;
  const toX = f32(owner.motion.x + f32(owner.facing * GRAB_HOLD_DISTANCE));
  held.x = f32(held.x + f32(f32(toX - held.x) / grab.reel));
  held.z = f32(held.z + f32(f32(owner.motion.z - held.z) / grab.reel));
  grab.reel--;
  target.facing = -owner.facing;
  held.vx = 0.0;
  held.vz = 0.0;
  held.grounded = grab.reel === 0 && owner.motion.grounded;
  held.surface = held.grounded ? owner.motion.surface : undefined;
  return true;
}
