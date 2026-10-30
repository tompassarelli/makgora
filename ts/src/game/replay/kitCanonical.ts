import { writeStrikeTraits } from "./strikeCanonical";
import { writeWindow } from "./windowCanonical";
import { writeEmpowered } from "./empowerCanonical";
import { canonicalInt } from "./canonicalNumbers";
import { bit, fieldWriters, hitEffectCanonical, specialPlacementCanonical, specialProjectileCanonical } from "./specialCanonical";
import { at } from "wisp/src/runtime/lookup";
import { GrabAction, LAST_ATTACK_STYLE } from "../sim/codes";
import { type AuthoredMove, type FighterMoves, travelStopFlags } from "../sim/heroMoves";
import type { AuthoredSpecial, FighterSpecials } from "../sim/specials/schema";
import { type FighterHurtboxes, type HurtPart, HurtState } from "../sim/hurtboxes";
import { writeSelfHeal } from "../sim/specials/selfHeal";

export function fighterMovesCanonical(moves: FighterMoves | undefined, prefix = "moves"): string {
  if (moves === undefined) return "";
  const result: string[] = [canonicalInt(`${prefix}.dashAttack`, moves.dashAttack)];
  for (let style = 0; style <= LAST_ATTACK_STYLE; style++) {
    const move = moves.normals[style];
    if (move === undefined) continue;
    writeNormalMove(move, `normal[${style}]`, prefix, result);
  }
  const { int, effect } = fieldWriters(prefix, result);
  for (let action = GrabAction.pummel; action <= GrabAction.cargoThrowDown; action++) {
    const move = moves.throws[action];
    if (move === undefined) continue;
    const name = `throw[${action}]`;
    int(`${name}.contact`, move.contactFrame);
    int(`${name}.total`, move.totalFrames);
    effect(name, move.effect);
  }
  writeHurtboxes(moves.hurtboxes, prefix, result);
  return result.join("");
}

function writeNormalMove(move: Readonly<AuthoredMove>, name: string, prefix: string, result: string[]): void {
  const { int, real } = fieldWriters(prefix, result);
  int(`${name}.startup`, move.startupFrames);
  int(`${name}.active`, move.activeFrames);
  int(`${name}.total`, move.totalFrames);
  int(`${name}.landingLag`, move.landingLag);
  real(`${name}.travel`, move.travelX ?? 0.0);
  int(`${name}.stopsAtBody`, travelStopFlags(move));
  if (move.travelFrames !== undefined) int(`${name}.travelFrames`, move.travelFrames);
  if (move.chainsFrom !== undefined) int(`${name}.chainsFrom`, move.chainsFrom);
  if (move.chargeFrame !== undefined) int(`${name}.chargeFrame`, move.chargeFrame);
  if (move.release !== undefined) {
    int(`${name}.release.to`, move.release.to);
    for (let gate = 0; gate < move.release.gates.length; gate++) int(`${name}.release.gate${gate}`, move.release.gates[gate] ?? 0);
  }
  writeFallPhases(move.fall ?? [], name, prefix, result);
  if (move.landingHit !== undefined) {
    int(`${name}.landingHit.first`, move.landingHit.firstFrame);
    int(`${name}.landingHit.total`, move.landingHit.totalFrames);
  }
  int(`${name}.regions`, move.regions.length);
  writeNormalRegions(move.regions, name, prefix, result);
}

function writeFallPhases(phases: NonNullable<AuthoredMove["fall"]>, name: string, prefix: string, result: string[]): void {
  const { int, real } = fieldWriters(prefix, result);
  for (let index = 0; index < phases.length; index++) {
    const phase = at(phases, index);
    const part = `${name}.fall[${index}]`;
    int(`${part}.first`, phase.firstFrame);
    int(`${part}.last`, phase.lastFrame);
    if (phase.speedZ !== undefined) real(`${part}.speedZ`, phase.speedZ);
  }
}

function writeNormalRegions(regions: AuthoredMove["regions"], name: string, prefix: string, result: string[]): void {
  const { int, real, effect } = fieldWriters(prefix, result);
  for (let index = 0; index < regions.length; index++) {
    const region = at(regions, index);
    const part = `${name}.region[${index}]`;
    int(`${part}.first`, region.firstFrame);
    int(`${part}.last`, region.lastFrame);
    int(`${part}.window`, region.hit.window);
    real(`${part}.minX`, region.hit.minX);
    real(`${part}.maxX`, region.hit.maxX);
    real(`${part}.minZ`, region.hit.minZ);
    real(`${part}.maxZ`, region.hit.maxZ);
    effect(`${part}.hit`, region.hit.effect);
    const { strike, groundedEffect } = region.hit;
    int(`${part}.strike`, strike === undefined ? 0 : 1);
    if (strike !== undefined) {
      real(`${part}.strike.x1`, strike.x1);
      real(`${part}.strike.z1`, strike.z1);
      real(`${part}.strike.x2`, strike.x2);
      real(`${part}.strike.z2`, strike.z2);
      real(`${part}.strike.radius`, strike.radius);
    }
    int(`${part}.groundedHit`, groundedEffect === undefined ? 0 : 1);
    if (groundedEffect !== undefined) effect(`${part}.groundedHit`, groundedEffect);
  }
}

function writeHurtboxes(hurtboxes: Readonly<FighterHurtboxes> | undefined, prefix: string, result: string[]): void {
  if (hurtboxes === undefined) return;
  const { int, real } = fieldWriters(prefix, result);
  const parts = (name: string, list: readonly HurtPart[]) => {
    int(`${name}.parts`, list.length);
    for (let index = 0; index < list.length; index++) {
      const part = at(list, index);
      const prefix = `${name}.part[${index}]`;
      real(`${prefix}.x1`, part.x1);
      real(`${prefix}.z1`, part.z1);
      real(`${prefix}.x2`, part.x2);
      real(`${prefix}.z2`, part.z2);
      real(`${prefix}.radius`, part.radius);
      int(`${prefix}.state`, part.state ?? HurtState.normal);
    }
  };
  parts("hurt.stand", hurtboxes.stand);
  int("hurt.crouch", hurtboxes.crouch === undefined ? 0 : 1);
  if (hurtboxes.crouch !== undefined) parts("hurt.crouch", hurtboxes.crouch);
  for (let style = 0; style <= LAST_ATTACK_STYLE; style++) {
    const poses = hurtboxes.attacks[style];
    if (poses === undefined) continue;
    const name = `hurt.attack[${style}]`;
    int(`${name}.poses`, poses.length);
    for (let index = 0; index < poses.length; index++) {
      const pose = at(poses, index);
      int(`${name}.pose[${index}].first`, pose.firstFrame);
      int(`${name}.pose[${index}].last`, pose.lastFrame);
      parts(`${name}.pose[${index}]`, pose.parts);
    }
  }
}



export function fighterSpecialsCanonical(specials: Readonly<FighterSpecials> | undefined, prefix = "specials"): string {
  if (specials === undefined) return "";
  const result: string[] = [];
  const kits = [specials.neutral, specials.side, specials.up, specials.down];
  for (let slot = 0; slot < kits.length; slot++) {
    const kit = at(kits, slot);
    if (kit.recallGroundOnly === true) result.push(canonicalInt(`${prefix}.kit[${slot}].recallGroundOnly`, 1));
    if (kit.recallWhile !== undefined) result.push(canonicalInt(`${prefix}.kit[${slot}].recallWhile`, kit.recallWhile === "armor" ? 2 : 1));
    const forms = [kit.ground, kit.air, kit.recall];
    // Use the fixed count because Lua length skips undefined forms.
    for (let form = 0; form < 6; form++) {
      const move = forms[form];
      if (move === undefined) continue;
      const name = `${prefix}.kit[${slot}].form[${form}]`;
      result.push(specialMoveCanonical(move, name));
    }
  }
  return result.join("");
}

export function specialMoveCanonical(move: Readonly<AuthoredSpecial>, name: string): string {
  const result: string[] = [];
  const variants = move.variants ?? [];
  for (let index = 0; index < variants.length; index++) result.push(specialMoveCanonical(at(variants, index), `${name}.variant[${index + 1}]`));
  writeSpecialBase(move, name, result);
  writeSpecialArmor(move, name, result);
  writeSpecialEffects(move, name, result);
  writeSpecialPlacements(move, name, result);
  writeSpecialMotion(move, name, result);
  writeSpecialGrabs(move, name, result);
  writeSpecialHits(move, name, result);
  writeSpecialFollowUps(move, name, result);
  return result.join("");
}

function writeSpecialBase(move: Readonly<AuthoredSpecial>, name: string, result: string[]): void {
  const { int, real } = fieldWriters(name, result);
  int("end", move.endFrame);
  if (move.regionOrigin !== undefined) result.push(specialProjectileCanonical(move.regionOrigin, `${name}.regionOrigin`));
  if (move.beam !== undefined) {
    real("beam.originX", move.beam.originX);
    real("beam.originZ", move.beam.originZ);
    real("beam.range", move.beam.range);
    real("beam.track", move.beam.track);
  }
  int("groundOnly", bit(move.groundOnly));
  int("oncePerAirtime", bit(move.oncePerAirtime));
  int("helpless", bit(move.helpless));
  int("landingLag", move.landingLag ?? -1);
  if (move.fallLandingLag !== undefined) int("fallLandingLag", move.fallLandingLag);
  if (move.facesStick === true) int("facesStick", 1);
}

function writeSpecialArmor(move: Readonly<AuthoredSpecial>, name: string, result: string[]): void {
  const { int, real } = fieldWriters(name, result);
  int("intangible.first", move.intangible?.first ?? -1);
  int("intangible.last", move.intangible?.last ?? -1);
  int("armor.first", move.armor?.first ?? -1);
  int("armor.last", move.armor?.last ?? -1);
  real("armor.maxDamage", move.armor?.maxDamage ?? 0.0);
  if (move.armor?.knockback !== undefined) real("armor.knockback", move.armor.knockback);
  int("armor.shell", bit(move.armor?.shell));
  if (move.armor?.chillsStriker === true) int("armor.chillsStriker", 1);
}

function writeSpecialEffects(move: Readonly<AuthoredSpecial>, name: string, result: string[]): void {
  const { int, real } = fieldWriters(name, result);
  if (move.burst !== undefined) {
    int("burst.frame", move.burst.frame);
    result.push(specialProjectileCanonical(move.burst.from, `${name}.burst.from`), specialProjectileCanonical(move.burst.into, `${name}.burst.into`));
  }
  if (move.ritual !== undefined) {
    int("ritual.frame", move.ritual.frame);
  }
  if (move.cleanseFrame !== undefined) int("cleanseFrame", move.cleanseFrame);
  writeSelfHeal(int, real, move.selfHeal);
  if (move.revive !== undefined) {
    int("revive.frame", move.revive.frame);
    real("revive.offsetX", move.revive.offsetX);
  }
  if (move.order !== undefined) int("order.frame", move.order.frame);
  if (move.swapHold !== undefined) {
    int("swapHold.frame", move.swapHold.frame);
    int("swapHold.variant", move.swapHold.variant);
  }
  if (move.swap !== undefined) {
    int("swap.frame", move.swap.frame);
    int("swap.cooldown", move.swap.cooldown);
  }
  if (move.refreshesAir === true) int("refreshesAir", 1);
  if (move.jumpWindow !== undefined) {
    int("jumpWindow.first", move.jumpWindow.first);
    int("jumpWindow.last", move.jumpWindow.last);
  }
  writeWindow(int, "spellImmune", move.spellImmune);
  writeWindow(int, "reflects", move.reflects);
  writeEmpowered(int, move);
  if (move.shorten !== undefined) {
    int("shorten.first", move.shorten.first);
    int("shorten.last", move.shorten.last);
  }
}

function writeSpecialPlacements(move: Readonly<AuthoredSpecial>, name: string, result: string[]): void {
  const { int } = fieldWriters(name, result);
  if (move.placement !== undefined) result.push(specialPlacementCanonical(move.placement, `${name}.placement`));
  move.summons?.forEach((summon, index) => result.push(specialPlacementCanonical(summon, `${name}.summons[${index}]`)));
  if (move.recall === true) int("recall", 1);
  if (move.command !== undefined) {
    int("command.frame", move.command.frame);
    int("command.order", move.command.order);
    if (move.command.slot !== undefined) int("command.slot", move.command.slot);
  }
  if (move.recallsProjectiles === true) int("recallsProjectiles", 1);
}

function writeSpecialMotion(move: Readonly<AuthoredSpecial>, name: string, result: string[]): void {
  const { int, real } = fieldWriters(name, result);
  writeStrikeTraits(move, int, real);
  if (move.guard !== undefined) {
    int("guard.first", move.guard.first);
    int("guard.last", move.guard.last);
    real("guard.heal", move.guard.heal);
    if (move.guard.shieldFrames !== undefined) int("guard.shieldFrames", move.guard.shieldFrames);
  }
  const motion = move.motion ?? [];
  for (let index = 0; index < motion.length; index++) {
    const segment = at(motion, index);
    int(`motion[${index}].first`, segment.first);
    int(`motion[${index}].last`, segment.last);
    real(`motion[${index}].velocityX`, segment.velocityX);
    real(`motion[${index}].velocityZ`, segment.velocityZ);
    real(`motion[${index}].aimedSpeed`, segment.aimedSpeed ?? 0.0);
    if (segment.stopsAtBody === true) int(`motion[${index}].stopsAtBody`, 1);
    real(`motion[${index}].driftSpeed`, segment.driftSpeed ?? 0.0);
    if (segment.stopsAtShield === true) int(`motion[${index}].stopsAtShield`, 1);
    if (segment.relocate !== undefined) int(`motion[${index}].relocate`, segment.relocate);
    if (segment.relocateProjectile !== undefined) result.push(specialProjectileCanonical(segment.relocateProjectile, `${name}.motion[${index}].relocateProjectile`));
    if (segment.relocateReach !== undefined) real(`motion[${index}].relocateReach`, segment.relocateReach);
    if (segment.seek !== undefined) {
      real(`motion[${index}].seek.speed`, segment.seek.speed);
      real(`motion[${index}].seek.turnCos`, segment.seek.turnCos);
      real(`motion[${index}].seek.turnSin`, segment.seek.turnSin);
    }
    if (segment.stopsAtBody === true) int(`motion[${index}].stopsAtBody`, 1);
  }
}

function writeSpecialGrabs(move: Readonly<AuthoredSpecial>, name: string, result: string[]): void {
  const { int, real } = fieldWriters(name, result);
  const grab = move.commandGrab;
  if (grab !== undefined) {
    int("commandGrab.first", grab.first);
    int("commandGrab.last", grab.last);
    real("commandGrab.strike.x1", grab.strike.x1);
    real("commandGrab.strike.z1", grab.strike.z1);
    real("commandGrab.strike.x2", grab.strike.x2);
    real("commandGrab.strike.z2", grab.strike.z2);
    real("commandGrab.strike.radius", grab.strike.radius);
    int("commandGrab.hold", grab.holdFrames);
    int("commandGrab.recovery", grab.recovery);
    if (grab.heal !== undefined) {
      real("commandGrab.heal", grab.heal.heal);
    }
    result.push(hitEffectCanonical(grab.effect, `${name}.commandGrab.effect`));
  }
  const strike = move.targetedStrike;
  if (strike !== undefined) {
    real("targetedStrike.range", strike.range);
    int("targetedStrike.frame", strike.frame);
    result.push(specialProjectileCanonical(strike.glyph, `${name}.targetedStrike.glyph`));
    result.push(specialProjectileCanonical(strike.bolt, `${name}.targetedStrike.bolt`));
    if (strike.curse !== undefined) {
      int("targetedStrike.curse.every", strike.curse.every);
      real("targetedStrike.curse.damage", strike.curse.damage);
      int("targetedStrike.curse.summonDelay", strike.curse.summonDelay);
      result.push(specialProjectileCanonical(strike.curse.portal, `${name}.targetedStrike.curse.portal`));
      result.push(specialPlacementCanonical(strike.curse.summon, `${name}.targetedStrike.curse.summon`));
    }
    result.push(hitEffectCanonical(strike.effect, `${name}.targetedStrike.effect`));
  }
}

function writeSpecialHits(move: Readonly<AuthoredSpecial>, name: string, result: string[]): void {
  const { int, real } = fieldWriters(name, result);
  const poses = move.hurt ?? [];
  for (let index = 0; index < poses.length; index++) {
    const pose = at(poses, index);
    int(`hurt[${index}].first`, pose.firstFrame);
    int(`hurt[${index}].last`, pose.lastFrame);
    for (let part = 0; part < pose.parts.length; part++) {
      const p = at(pose.parts, part);
      const name = `hurt[${index}].part[${part}]`;
      real(`${name}.x1`, p.x1);
      real(`${name}.z1`, p.z1);
      real(`${name}.x2`, p.x2);
      real(`${name}.z2`, p.z2);
      real(`${name}.radius`, p.radius);
      int(`${name}.state`, p.state ?? HurtState.normal);
    }
  }
  const projectiles = move.projectiles ?? [];
  for (let index = 0; index < projectiles.length; index++) result.push(specialProjectileCanonical(at(projectiles, index), `${name}.projectile[${index}]`));
  const regions = move.regions ?? [];
  for (let index = 0; index < regions.length; index++) {
    const region = at(regions, index);
    const part = `region[${index}]`;
    int(`${part}.first`, region.firstFrame);
    int(`${part}.last`, region.lastFrame);
    real(`${part}.minX`, region.hit.minX);
    real(`${part}.maxX`, region.hit.maxX);
    real(`${part}.minZ`, region.hit.minZ);
    real(`${part}.maxZ`, region.hit.maxZ);
    const { strike } = region.hit;
    if (strike !== undefined) {
      real(`${part}.strike.x1`, strike.x1);
      real(`${part}.strike.z1`, strike.z1);
      real(`${part}.strike.x2`, strike.x2);
      real(`${part}.strike.z2`, strike.z2);
      real(`${part}.strike.radius`, strike.radius);
    }
    result.push(hitEffectCanonical(region.hit.effect, `${name}.${part}.hit`));
    if (region.hit.groundedEffect !== undefined) result.push(hitEffectCanonical(region.hit.groundedEffect, `${name}.${part}.groundedHit`));
  }
}

function writeSpecialFollowUps(move: Readonly<AuthoredSpecial>, name: string, result: string[]): void {
  const { int } = fieldWriters(name, result);
  const followUps = move.followUps ?? [];
  for (let index = 0; index < followUps.length; index++) {
    const followUp = at(followUps, index);
    int(`followUp[${index}].first`, followUp.window.first);
    int(`followUp[${index}].last`, followUp.window.last);
    int(`followUp[${index}].input`, followUp.input ?? 0);
    int(`followUp[${index}].facesStick`, bit(followUp.facesStick));
    if (followUp.stick !== undefined) {
      int(`followUp[${index}].stickX`, followUp.stick.x);
      int(`followUp[${index}].stickZ`, followUp.stick.z);
    }
    result.push(specialMoveCanonical(followUp.special, `${name}.followUp[${index}]`));
  }
}

