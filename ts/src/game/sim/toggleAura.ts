import { f32 } from "wisp/src/sim/f32";
import { addFloat32, roundToFloat32 } from "wisp/src/sim/binary32";
import { floorMod } from "wisp/src/sim/intMath";
import { PARTICIPANT_CAPACITY } from "../input/participants";
import { isIntangible } from "./conditions";
import type { Fighter } from "./fighter";
import { hurtCapsule } from "./geometry/contactGeometry";
import { capPercent } from "./percent";
import { type Roster, fighterAt, isActive } from "./roster";
import { SpecialSlot, specialKit, type ToggleAura } from "./specials/schema";
import { canHit } from "./teams";

export function toggleAuraOf(f: Readonly<Fighter>): ToggleAura | undefined {
  const specials = f.tuning.specials;
  if (specials === undefined) return undefined;
  for (let slot = SpecialSlot.neutral; slot <= SpecialSlot.down; slot++) {
    const kit = specialKit(specials, slot);
    const aura = kit.ground.toggleAura ?? kit.air?.toggleAura;
    if (aura !== undefined) return aura;
  }
  return undefined;
}

export function toggleAuraOnFrame(f: Fighter, aura: Readonly<ToggleAura> | undefined, frame: number): void {
  if (aura?.frame !== frame) return;
  f.status.aura = !f.status.aura;
  f.status.auraFrames = 0;
}

function wound(target: Fighter, damage: number): void {
  target.status.damage = capPercent(addFloat32(roundToFloat32(target.status.damage), damage));
}

function inCloud(owner: Readonly<Fighter>, target: Readonly<Fighter>, radius: number): boolean {
  const own = hurtCapsule(owner.character);
  const other = hurtCapsule(target.character);
  const across = f32(f32(radius + own.radius) + other.radius);
  const dz = f32(f32(target.motion.z + other.z1) - f32(owner.motion.z + own.z1));
  return Math.abs(f32(target.motion.x - owner.motion.x)) <= across && Math.abs(dz) <= across;
}

function poisonCloud(world: Roster, slot: number, owner: Readonly<Fighter>, aura: Readonly<ToggleAura>): void {
  for (let target = 0; target < PARTICIPANT_CAPACITY; target++) {
    if (!isActive(world, target) || !canHit(world, slot, target)) continue;
    const foe = fighterAt(world, target);
    if (foe.status.out || isIntangible(foe) || !inCloud(owner, foe, aura.radius)) continue;
    wound(foe, aura.damage);
    foe.status.struckBy = slot;
    foe.status.slowFrames = aura.slowFrames;
    foe.status.slowScale = aura.slowScale;
  }
}

/** While its aura is on, a fighter wounds and slows foes in it and bleeds itself on the aura's clocks; a foe's slow wears off. */
export function advanceAura(world: Roster, slot: number): void {
  const f = fighterAt(world, slot);
  const { status } = f;
  if (status.slowFrames > 0) status.slowFrames--;
  if (!status.aura || status.out) return;
  const aura = toggleAuraOf(f);
  if (aura === undefined) {
    status.aura = false;
    return;
  }
  status.auraFrames++;
  if (floorMod(status.auraFrames, aura.selfEvery) === 0) wound(f, aura.selfDamage);
  if (floorMod(status.auraFrames, aura.every) === 0) poisonCloud(world, slot, f, aura);
}
