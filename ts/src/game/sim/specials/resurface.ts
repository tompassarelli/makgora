import { f32 } from "wisp/src/sim/f32";
import type { Fighter, Projectile } from "../fighter";
import { clearMotionValue, setWorldMotionValue } from "../motion";
import { floorSurfaceBelow, surfaceZAt } from "../stage";
import type { SpecialMotion, SpecialProjectile } from "./schema";

const RESURFACE_STEP = 12.0;

interface Spot { readonly x: number; readonly surface: number }

function newestFloored(f: Readonly<Fighter>, spec: Readonly<SpecialProjectile>, stage: number, matchFrame: number): Spot | undefined {
  let newest: Readonly<Projectile> | undefined;
  let surface = 0;
  for (const projectile of f.projectiles) {
    if (projectile.life <= 0 || projectile.spec !== spec || (newest !== undefined && projectile.life <= newest.life)) continue;
    const floor = floorSurfaceBelow(stage, matchFrame, projectile.x, projectile.z);
    if (floor === undefined) continue;
    newest = projectile;
    surface = floor;
  }
  return newest === undefined ? undefined : { x: newest.x, surface };
}

function levelFloorAhead(f: Readonly<Fighter>, reach: number, stage: number, matchFrame: number): Spot | undefined {
  const x = f32(f.motion.x + f32(f.facing * reach));
  const surface = floorSurfaceBelow(stage, matchFrame, x, f32(f.motion.z + RESURFACE_STEP));
  return surface === undefined || surfaceZAt(stage, surface, matchFrame, x) < f32(f.motion.z - RESURFACE_STEP) ? undefined : { x, surface };
}

function standAt(f: Fighter, spot: Spot, stage: number, matchFrame: number): void {
  const { motion } = f;
  motion.x = spot.x;
  motion.z = surfaceZAt(stage, spot.surface, matchFrame, spot.x);
  motion.vx = 0.0;
  motion.vz = 0.0;
  motion.fastFalling = false;
  motion.grounded = true;
  motion.surface = spot.surface;
  setWorldMotionValue(motion.meleeX, motion.x);
  setWorldMotionValue(motion.meleeZ, motion.z);
  clearMotionValue(motion.meleeVelocityZ);
}

export function resurfaceHeroSpecial(f: Fighter, resurface: NonNullable<SpecialMotion["resurface"]>, stage: number, matchFrame: number): void {
  const spot = newestFloored(f, resurface.at, stage, matchFrame) ?? levelFloorAhead(f, resurface.fallbackReach, stage, matchFrame);
  if (spot !== undefined) standAt(f, spot, stage, matchFrame);
}
