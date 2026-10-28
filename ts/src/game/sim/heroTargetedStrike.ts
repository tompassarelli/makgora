import { canHit } from "./teams";
import { f32 } from "wisp/src/sim/f32";
import { ContactKind } from "./codes";
import { isIntangible } from "./conditions";
import { collectDamageContact } from "./contacts";
import { applyCurse } from "./curses";
import type { Fighter } from "./fighter";
import { mutableProjectile } from "./fighterProjectiles";
import { currentTraits } from "./identityTraits";
import { type Roster, fighterAt } from "./roster";
import { lockedTarget, runningHeroSpecial, seekTargetSlot, spawnHeroProjectileAt } from "./specials/engine";
import type { SpecialProjectile, TargetedStrike } from "./specials/schema";
import { repelSpell } from "./specials/spellImmunity";

function lockNearest(world: Roster, owner: Fighter, strike: Readonly<TargetedStrike>): Fighter | undefined {
  owner.special.seekTarget = seekTargetSlot(world, owner) + 1;
  const target = lockedTarget(world, owner, strike.range);
  if (target === undefined) owner.special.seekTarget = 0;
  return target;
}

function spawnOn(owner: Fighter, spec: Readonly<SpecialProjectile>, target: Readonly<Fighter>): void {
  spawnHeroProjectileAt(owner, spec, target.motion.x, f32(target.motion.z + spec.offsetZ), owner.facing, false, owner.attack.serial + 1);
}

function followWithGlyph(owner: Fighter, glyph: Readonly<SpecialProjectile>, target: Readonly<Fighter>): void {
  let index = -1;
  for (const projectile of owner.projectiles) {
    index++;
    if (projectile.life <= 0 || projectile.spec !== glyph) continue;
    const moved = mutableProjectile(owner, index);
    moved.x = target.motion.x;
    moved.z = f32(target.motion.z + glyph.offsetZ);
  }
}

function lockedFoe(world: Roster, owner: Readonly<Fighter>): Fighter | undefined {
  const slot = owner.special.seekTarget - 1;
  return slot < 0 ? undefined : fighterAt(world, slot);
}

function landBolt(world: Roster, slot: number, owner: Fighter, strike: Readonly<TargetedStrike>): void {
  const target = lockedTarget(world, owner, strike.range);
  if (target === undefined) return;
  spawnOn(owner, strike.bolt, target);
  const targetSlot = owner.special.seekTarget - 1;
  if (!canHit(world, slot, targetSlot) || isIntangible(target) || repelSpell(target)) return;
  const facing = target.motion.x < owner.motion.x ? -1 : 1;
  collectDamageContact(world, slot, targetSlot, strike.effect, facing, ContactKind.launch, false, undefined, false);
  if (strike.curse !== undefined && currentTraits(owner).status === true) applyCurse(target, slot);
}

export function advanceHeroTargetedStrike(world: Roster, slot: number): void {
  const owner = fighterAt(world, slot);
  const strike = runningHeroSpecial(owner)?.targetedStrike;
  if (strike === undefined || owner.launch.hitlag > 0) return;
  const frame = owner.special.frame;
  if (frame === 1) {
    const target = lockNearest(world, owner, strike);
    if (target !== undefined) spawnOn(owner, strike.glyph, target);
    return;
  }
  const target = lockedFoe(world, owner);
  if (target === undefined || frame > strike.frame) return;
  if (frame < strike.frame) followWithGlyph(owner, strike.glyph, target);
  else landBolt(world, slot, owner, strike);
}
