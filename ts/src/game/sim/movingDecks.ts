
import { f32 } from "wisp/src/sim/f32";
import { PARTICIPANT_CAPACITY } from "../input/participants";
import type { Fighter } from "./fighter";
import { mutableProjectile } from "./fighterProjectiles";
import { at } from "wisp/src/runtime/lookup";
import { moveMeleeX, setWorldMotionValue } from "./motion";
import { type Roster, fighterAt, isActive } from "./roster";
import { surfaceCount, surfaceMoves, surfaceShiftX, surfaceShiftZ, surfaceZ } from "./stage";

function carryFighter(f: Fighter, deck: number, shiftX: number, z: number): void {
  const { motion } = f;
  if (f.status.out || !motion.grounded || motion.surface !== deck) return;
  moveMeleeX(f, shiftX);
  if (motion.z === z) return;
  motion.z = z;
  setWorldMotionValue(motion.meleeZ, z);
}

function carrySummons(f: Fighter, deck: number, shiftX: number, z: number): void {
  const { freezeTrap: trap, bear } = f;
  if (trap.life > 0 && trap.surface === deck) {
    trap.x = f32(trap.x + shiftX);
    trap.z = z;
  }
  if (bear.life > 0 && bear.surface === deck) {
    bear.x = f32(bear.x + shiftX);
    bear.z = z;
  }
}

function carryMarks(f: Fighter, deck: number, shiftX: number, shiftZ: number): void {
  for (let index = 0; index < f.projectiles.length; index++) {
    const before = at(f.projectiles, index);
    if (before.life <= 0 || before.surface !== deck) continue;
    const projectile = mutableProjectile(f, index);
    projectile.x = f32(projectile.x + shiftX);
    projectile.z = f32(projectile.z + shiftZ);
  }
}









export function carryOnMovingDecks(world: Roster, stage: number, matchFrame: number): void {
  for (let deck = 1; deck < surfaceCount(stage); deck++) {
    if (!surfaceMoves(stage, deck)) continue;
    const shiftX = surfaceShiftX(stage, deck, matchFrame);
    const shiftZ = surfaceShiftZ(stage, deck, matchFrame);
    const z = surfaceZ(stage, deck, matchFrame);
    for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) {
      if (!isActive(world, slot)) continue;
      const f = fighterAt(world, slot);
      carryFighter(f, deck, shiftX, z);
      carrySummons(f, deck, shiftX, z);
      carryMarks(f, deck, shiftX, shiftZ);
    }
  }
}
