import { canonicalInt, canonicalRealField } from "./canonicalNumbers";
import { writePierce } from "./empowerCanonical";
import { at } from "wisp/src/runtime/lookup";
import type { HitEffect } from "../sim/hitRegions";
import type { SpecialCompanion, SpecialPlacement, SpecialProjectile } from "../sim/specials/schema";
import type { AppliedStatus } from "../sim/appliedStatus";

export const bit = (flag: boolean | undefined): number => (flag === true ? 1 : 0);

export function fieldWriters(name: string, result: string[]) {
  return {
    int: (field: string, value: number) => { result.push(canonicalInt(`${name}.${field}`, value)); },
    real: (field: string, value: number) => { result.push(canonicalRealField(`${name}.${field}`, value)); },
    effect: (field: string, hit: Readonly<HitEffect>) => { result.push(hitEffectCanonical(hit, `${name}.${field}`)); },
  };
}

const downVelocityCanonical = (spec: Readonly<SpecialProjectile>, prefix: string): readonly string[] => [
  canonicalRealField(`${prefix}.downVelocityX`, spec.downVelocity?.velocityX ?? 0.0),
  canonicalRealField(`${prefix}.downVelocityZ`, spec.downVelocity?.velocityZ ?? 0.0),
];

const ledgeLatchCanonical = (spec: Readonly<SpecialProjectile>, prefix: string): readonly string[] =>
  spec.latchesLedge === true ? [canonicalInt(`${prefix}.latchesLedge`, 1)] : [];

function appliedStatusCanonical(status: Readonly<AppliedStatus>, prefix: string): readonly string[] {
  const result: string[] = [];
  const int = (name: string, value: number) => { result.push(canonicalInt(`${prefix}.status.${name}`, value)); };
  const real = (name: string, value: number) => { result.push(canonicalRealField(`${prefix}.status.${name}`, value)); };
  int("kind", status.kind);
  int("frames", status.frames);
  int("group", status.group);
  int("immunityFrames", status.immunityFrames);
  if (status.hits !== undefined) int("hits", status.hits);
  if (status.perPercent !== undefined) {
    real("perPercent.frames", status.perPercent.frames);
    int("perPercent.cap", status.perPercent.cap);
  }
  if (status.tick !== undefined) {
    int("tick.every", status.tick.every);
    real("tick.damage", status.tick.damage);
  }
  return result;
}

export function specialProjectileCanonical(spec: Readonly<SpecialProjectile>, prefix: string): string {
  const result: string[] = [];
  const int = (name: string, value: number) => { result.push(canonicalInt(`${prefix}.${name}`, value)); };
  const real = (name: string, value: number) => { result.push(canonicalRealField(`${prefix}.${name}`, value)); };
  int("spawnFrame", spec.spawnFrame);
  real("offsetX", spec.offsetX);
  real("offsetZ", spec.offsetZ);
  real("velocityX", spec.velocityX);
  real("velocityZ", spec.velocityZ);
  real("upVelocityX", spec.upVelocityX ?? 0.0);
  real("upVelocityZ", spec.upVelocityZ ?? 0.0);
  result.push(...downVelocityCanonical(spec, prefix));
  int("life", spec.life);
  real("radius", spec.radius);
  int("activeFrom", spec.activeFrom ?? 0);
  result.push(hitEffectCanonical(spec.effect, `${prefix}.effect`));
  int("reflectable", spec.reflectable ? 1 : 0);
  int("limit", spec.limit);
  int("cancelOnInterrupt", bit(spec.cancelOnInterrupt));
  if (spec.atStageCentre === true) int("atStageCentre", 1);
  if (spec.returnEffect !== undefined) result.push(hitEffectCanonical(spec.returnEffect, `${prefix}.returnEffect`));
  if (spec.catchHeal !== undefined) {
    real("catchHeal.heal", spec.catchHeal.heal);
  }
  if (spec.status !== undefined) result.push(...appliedStatusCanonical(spec.status, prefix));
  int("needsLineOfSight", bit(spec.needsLineOfSight));
  result.push(...ledgeLatchCanonical(spec, prefix));
  if (spec.returns !== undefined) {
    int("returns.age", spec.returns.age);
    real("returns.speed", spec.returns.speed);
  }
  if (spec.pool !== undefined) {
    int("pool.every", spec.pool.every);
    real("pool.growth", spec.pool.growth);
    real("pool.maxRadius", spec.pool.maxRadius);
  }
  if (spec.homing !== undefined) {
    real("homing.turn", spec.homing.turn);
    real("homing.maxRise", spec.homing.maxRise);
  }
  writePierce(int, spec);
  if (spec.burstInto !== undefined) result.push(specialProjectileCanonical(spec.burstInto, `${prefix}.burstInto`));
  if (spec.expiresInto !== undefined) result.push(specialProjectileCanonical(spec.expiresInto, `${prefix}.expiresInto`));
  return result.join("");
}


export function specialPlacementCanonical(spec: Readonly<SpecialPlacement>, prefix: string): string {
  const result: string[] = [];
  writePlacementShape(spec, prefix, result);
  writePlacementRules(spec, prefix, result);
  if (spec.companion !== undefined) writeCompanion(spec.companion, prefix, result);
  return result.join("");
}

function writePlacementShape(spec: Readonly<SpecialPlacement>, prefix: string, result: string[]): void {
  const { int, real } = fieldWriters(prefix, result);
  int("frame", spec.frame);
  if (spec.slot !== undefined) int("slot", spec.slot);
  if (spec.offsetZ !== undefined) real("offsetZ", spec.offsetZ);
  if (spec.keepExisting === true) int("keepExisting", 1);
  real("offsetX", spec.offsetX);
  real("radius", spec.radius);
  real("height", spec.height);
  real("durability", spec.durability);
  int("life", spec.life);
  for (let index = 0; index < spec.fireAges.length; index++) int(`fireAge[${index}]`, at(spec.fireAges, index));
  if (spec.shot !== undefined) result.push(specialProjectileCanonical(spec.shot, `${prefix}.shot`));
  if (spec.finalShot !== undefined) result.push(specialProjectileCanonical(spec.finalShot, `${prefix}.finalShot`));
  if (spec.mark !== undefined) result.push(specialProjectileCanonical(spec.mark, `${prefix}.mark`));
}

function writePlacementRules(spec: Readonly<SpecialPlacement>, prefix: string, result: string[]): void {
  const { int, real } = fieldWriters(prefix, result);
  if (spec.outwardPair === true) int("outwardPair", 1);
  if (spec.channeled === true) int("channeled", 1);
  if (spec.spread !== undefined) {
    int("spread.every", spec.spread.every);
    for (let index = 0; index < spec.spread.offsets.length; index++) real(`spread.offset[${index}]`, at(spec.spread.offsets, index));
  }
  if (spec.aimed === true) int("aimed", 1);
  if (spec.crumble !== undefined) int("crumble", spec.crumble);
  result.push(optionalField(`${prefix}.taunt.radius`, spec.taunt?.radius, canonicalRealField), optionalField(`${prefix}.taunt.pull`, spec.taunt?.pull, canonicalRealField));
  result.push(optionalField(`${prefix}.windWalk.frames`, spec.windWalk?.frames, canonicalInt), optionalField(`${prefix}.windWalk.hop`, spec.windWalk?.hop, canonicalRealField));
}

function writeCompanion(partner: Readonly<SpecialCompanion>, prefix: string, result: string[]): void {
  const { int, real } = fieldWriters(prefix, result);
  if (partner.behavior !== undefined) int("companion.behavior", partner.behavior === "sentry" ? 1 : 2);
  if (partner.followHeight !== undefined) real("companion.followHeight", partner.followHeight);
  if (partner.lungeDrop !== undefined) real("companion.lungeDrop", partner.lungeDrop);
  for (let i = 0; i < (partner.volleyFrames?.length ?? 0); i++) int(`companion.volley[${i}]`, partner.volleyFrames?.[i] ?? 0);
  if (partner.waveFrame !== undefined) int("companion.waveFrame", partner.waveFrame);
  real("companion.followSpeed", partner.followSpeed);
  real("companion.followBehind", partner.followBehind);
  real("companion.returnSpeed", partner.returnSpeed);
  int("companion.lungeStartup", partner.lungeStartup);
  int("companion.lungeActive", partner.lungeActive);
  int("companion.lungeRecovery", partner.lungeRecovery);
  real("companion.lungeTravel", partner.lungeTravel);
  real("companion.bite.x1", partner.bite.x1);
  real("companion.bite.z1", partner.bite.z1);
  real("companion.bite.x2", partner.bite.x2);
  real("companion.bite.z2", partner.bite.z2);
  real("companion.bite.radius", partner.bite.radius);
  result.push(hitEffectCanonical(partner.biteEffect, `${prefix}.companion.biteEffect`));
  if (partner.biteStatus !== undefined) {
    int("companion.biteStatus.kind", partner.biteStatus.kind);
    int("companion.biteStatus.frames", partner.biteStatus.frames);
    int("companion.biteStatus.group", partner.biteStatus.group);
    int("companion.biteStatus.immunityFrames", partner.biteStatus.immunityFrames);
    if (partner.biteStatus.tick !== undefined) {
      int("companion.biteStatus.tick.every", partner.biteStatus.tick.every);
      real("companion.biteStatus.tick.damage", partner.biteStatus.tick.damage);
    }
  }
  int("companion.stunFrames", partner.stunFrames);
  real("companion.leash", partner.leash);
  int("companion.leashFrames", partner.leashFrames);
}

function optionalField(name: string, value: number | undefined, write: (name: string, value: number) => string): string {
  return value === undefined ? "" : write(name, value);
}

export function hitEffectCanonical(hit: Readonly<HitEffect>, prefix: string): string {
  return canonicalRealField(`${prefix}.damage`, hit.damage) + canonicalRealField(`${prefix}.growth`, hit.growth)
    + canonicalRealField(`${prefix}.base`, hit.base) + canonicalRealField(`${prefix}.launchX`, hit.launchX)
    + canonicalRealField(`${prefix}.launchZ`, hit.launchZ) + canonicalInt(`${prefix}.electric`, hit.electric ? 1 : 0)
    + canonicalInt(`${prefix}.element`, hit.element ?? 0) + (hit.carry === true ? canonicalInt(`${prefix}.carry`, 1) : "") + (hit.sakurai === true ? canonicalInt(`${prefix}.sakurai`, 1) : "") + (hit.flinchless === true ? canonicalInt(`${prefix}.flinchless`, 1) : "")
    + optionalField(`${prefix}.heal`, hit.heal, canonicalRealField) + optionalField(`${prefix}.healPerStock`, hit.healPerStock, canonicalRealField)
    + optionalField(`${prefix}.setKnockback`, hit.setKnockback, canonicalRealField)
    + optionalField(`${prefix}.shieldDamage`, hit.shieldDamage, canonicalRealField);
}


