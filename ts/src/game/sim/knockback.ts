


import { max, min, toReal } from "../core/numbers";
import { addFloat32, divideFloat32, fusedMultiplyAddFloat32, multiplyFloat32, roundToFloat32, subtractFloat32, toInt } from "wisp/src/sim/binary32";
import { f32 } from "wisp/src/sim/f32";
import { meleeAtan2, meleeCos, meleeSin } from "../core/math/meleeScalarMath";
import { DamageLanding } from "./codes";
import type { Fighter } from "./fighter";
import { ownedInfluenceOperands } from "./influenceOperands";
import { aerialJumps } from "./itemBuffs";
export { influenceOperands } from "./influenceOperands";
import { AIR_KNOCKBACK_DECAY, AIR_KNOCKBACK_SQUARED_CUTOFF, decayedAirMotion, retainedOriginal, roundMeleeWorldValue, setMeleeKnockback, termsOfPhysics } from "./motion";
import type { Controls } from "./roster";
import { melee } from "./tuning";
import { squareRoot } from "./warcraftMath";

export const KNOCKBACK_LAUNCH_SPEED = 0.029999999329447746;
const KNOCKBACK_LAUNCH_SCALE = melee(KNOCKBACK_LAUNCH_SPEED);
export const HITSTUN_FRAMES_PER_KNOCKBACK = 0.4000000059604645;
const MEDIUM_DAMAGE_KNOCKBACK = 25.0;
const STRONG_DAMAGE_KNOCKBACK = 52.5;
export const TUMBLE_KNOCKBACK = 80.0;
export const KNOCKBACK_STACKING_FRAMES = 10;
export const KNOCKBACK_PERCENT_SCALE = 0.10000000149011612;
export const KNOCKBACK_DAMAGE_SCALE = 0.05000000074505806;
export const KNOCKBACK_GROWTH_SCALE = 1.399999976158142;
export const KNOCKBACK_GROWTH_ADDEND = 18.0;
export const KNOCKBACK_CAP = 2500.0;
export const THROW_KNOCKBACK_WEIGHT = 100.0;
export const CROUCH_CANCEL_KNOCKBACK_SCALE = 0.6666666865348816;
export const SMASH_CHARGE_VICTIM_KNOCKBACK_SCALE = 1.2000000476837158;
export const ELECTRIC_HITLAG_SCALE = 1.5;
export const HITLAG_CAP_FRAMES = 20;
export const DI_MAX_DEGREES = 18.0;
const GROUND_LAUNCH_BOUNCE_ANGLE = 0.1745329201221466;
const GROUND_LAUNCH_REBOUND = 0.800000011920929;
const RADIANS_TO_DEGREES = 57.295780181884766;
const DEGREES_TO_RADIANS = 0.01745329238474369;
export const SAKURAI_LOW_KNOCKBACK = 32.0;
export const SAKURAI_HIGH_KNOCKBACK = 32.099998474121094;
export const SAKURAI_GROUNDED_DEGREES = 44.0;
export const SAKURAI_AIRBORNE_DEGREES = 45.0;

export const ORDINARY_HIT_GROWTH_PERCENT: number = 100.0;
export const ORDINARY_HIT_BASE_KNOCKBACK: number = 20.0;
export const ORDINARY_HIT_CONTEXT_SCALE = 1.0;
export const DIAGONAL_UNIT = 0.7071067690849304;
/** upward knockback, not ordinary jump velocity. */
export const TOP_KO_MINIMUM_UPWARD_KNOCKBACK = melee(2.4000000953674316);
/**  max_grounded_kb_on_landing. */
export const MAX_GROUNDED_KNOCKBACK_ON_LANDING = melee(8.300000190734863);


export function integerHitPower(hitDamage: number): number {
  const damage = roundToFloat32(hitDamage);
  return damage > 0 ? max(1, toInt(damage)) : 0;
}

export function launchWeightFactor(victimWeight: number): number {
  const weight = multiplyFloat32(roundToFloat32(victimWeight), 0.009999999776482582);
  const fraction = divideFloat32(multiplyFloat32(weight, 2.0), addFloat32(weight, 1.0));
  return subtractFloat32(2.0, fraction);
}

function scaledLaunchGrowth(contribution: number, victimWeight: number, growthPercent: number, baseKnockback: number): number {
  const weighted = multiplyFloat32(contribution, launchWeightFactor(victimWeight));
  const growth = fusedMultiplyAddFloat32(KNOCKBACK_GROWTH_SCALE, weighted, KNOCKBACK_GROWTH_ADDEND);
  const multiplier = multiplyFloat32(roundToFloat32(growthPercent), 0.009999999776482582);
  return min(KNOCKBACK_CAP, fusedMultiplyAddFloat32(multiplier, growth, roundToFloat32(baseKnockback)));
}


export function contactKnockback(postHitPercent: number, hitDamage: number, victimWeight: number, growthPercent: number, baseKnockback: number, contextScale: number): number {
  const percent = roundToFloat32(postHitPercent);
  const powered = multiplyFloat32(percent, toReal(integerHitPower(hitDamage)));
  const damageGrowth = multiplyFloat32(powered, KNOCKBACK_DAMAGE_SCALE);
  const contribution = fusedMultiplyAddFloat32(KNOCKBACK_PERCENT_SCALE, percent, damageGrowth);
  return multiplyFloat32(scaledLaunchGrowth(contribution, victimWeight, growthPercent, baseKnockback), roundToFloat32(contextScale));
}

export interface KnockbackTerms {
  readonly growth: number;
  readonly base: number;
  readonly setKnockback?: number | undefined;
  readonly fixedPower?: number | undefined;
}

export function effectKnockback(effect: KnockbackTerms, postHitPercent: number, hitDamage: number, victimWeight: number): number {
  if (effect.setKnockback !== undefined) return effect.setKnockback;
  return effect.fixedPower === undefined ? contactKnockback(postHitPercent, hitDamage, victimWeight, effect.growth, effect.base, 1.0)
    : fixedHitKnockback(effect.fixedPower, victimWeight, effect.growth, effect.base, 1.0);
}

export function fixedHitKnockback(fixedPower: number, victimWeight: number, growthPercent: number, baseKnockback: number, contextScale: number): number {
  const power = multiplyFloat32(toReal(fixedPower), 10.0);
  const damageGrowth = multiplyFloat32(power, KNOCKBACK_DAMAGE_SCALE);
  const contribution = fusedMultiplyAddFloat32(10.0, KNOCKBACK_PERCENT_SCALE, damageGrowth);
  return multiplyFloat32(scaledLaunchGrowth(contribution, victimWeight, growthPercent, baseKnockback), roundToFloat32(contextScale));
}


export function hitContextKnockback(knockback: number, crouching: boolean, smashCharging: boolean): number {
  let result = roundToFloat32(knockback);
  if (crouching) result = multiplyFloat32(result, CROUCH_CANCEL_KNOCKBACK_SCALE);
  if (smashCharging) result = multiplyFloat32(result, SMASH_CHARGE_VICTIM_KNOCKBACK_SCALE);
  return result;
}


export function ordinaryHitKnockback(preHitPercent: number, hitDamage: number, victimWeight: number, growthPercent: number, baseKnockback: number, contextScale: number): number {
  const postHitPercent = addFloat32(toReal(toInt(max(0.0, roundToFloat32(preHitPercent)))), roundToFloat32(hitDamage));
  return contactKnockback(postHitPercent, hitDamage, victimWeight, growthPercent, baseKnockback, contextScale);
}

export const STRONG_HIT_EXTRA_HITLAG = 3;

export function victimHitlagFrames(hitDamage: number, electric: boolean, crouching: boolean): number {
  if (hitDamage <= 0) return 0;
  const base = toInt(f32(f32(integerHitPower(hitDamage) / 3.0) + 3));
  const effectFrames = electric ? toInt(f32(base * ELECTRIC_HITLAG_SCALE)) : base;
  return min(HITLAG_CAP_FRAMES, crouching ? toInt(f32(f32(effectFrames * 2.0) / 3.0)) : effectFrames);
}

export function ordinaryHitlagFrames(hitDamage: number): number {
  return victimHitlagFrames(hitDamage, false, false);
}

export function ordinaryHitstunFrames(knockback: number): number {
  return max(1, toInt(f32(knockback * HITSTUN_FRAMES_PER_KNOCKBACK)));
}

export const STUN_KNOCKBACK = 10.0;
const STUN_FRAMES_PER_PERCENT = 0.10000000149011612;

export function stunHitstunFrames(stunFrames: number, postHitPercent: number): number {
  return stunFrames + toInt(multiplyFloat32(STUN_FRAMES_PER_PERCENT, roundToFloat32(postHitPercent)));
}

export function damageLevelForKnockback(knockback: number): number {
  if (knockback >= TUMBLE_KNOCKBACK) return 3;
  if (knockback >= STRONG_DAMAGE_KNOCKBACK) return 2;
  return knockback >= MEDIUM_DAMAGE_KNOCKBACK ? 1 : 0;
}

export function sakuraiDegrees(knockback: number, grounded: boolean): number {
  if (!grounded) return SAKURAI_AIRBORNE_DEGREES;
  const magnitude = roundToFloat32(knockback);
  if (magnitude < SAKURAI_LOW_KNOCKBACK) return 0.0;
  if (magnitude >= SAKURAI_HIGH_KNOCKBACK) return SAKURAI_GROUNDED_DEGREES;
  const blend = divideFloat32(subtractFloat32(magnitude, SAKURAI_LOW_KNOCKBACK), subtractFloat32(SAKURAI_HIGH_KNOCKBACK, SAKURAI_LOW_KNOCKBACK));
  return multiplyFloat32(blend, SAKURAI_GROUNDED_DEGREES);
}

const sakuraiDirection = { x: 0.0, z: 0.0 };

export function sakuraiLaunchDirection(knockback: number, grounded: boolean): Readonly<{ x: number; z: number }> {
  const radians = multiplyFloat32(sakuraiDegrees(knockback, grounded), DEGREES_TO_RADIANS);
  sakuraiDirection.x = meleeCos(radians);
  sakuraiDirection.z = meleeSin(radians);
  return sakuraiDirection;
}

/** in Melee units per frame. */
export function airborneDamageLandingReaction(launchSpeed: number): DamageLanding {
  if (launchSpeed < 0.5) return DamageLanding.retainStun;
  if (launchSpeed < 5.0) return DamageLanding.normal;
  return DamageLanding.knockdown;
}

function mergeLaunchAxis(existing: number, incoming: number): number {
  if (existing === 0) return incoming;
  if (incoming === 0) return existing;
  if (existing < 0 !== incoming < 0) return f32(existing + incoming);
  return existing > 0 ? max(existing, incoming) : min(existing, incoming);
}


export function installDamageLaunch(target: Fighter, knockback: number, directionX: number, directionZ: number, wasGrounded: boolean): void {
  const { launch, motion } = target;
  launch.damageLevel = damageLevelForKnockback(knockback);
  const speed = f32(knockback * KNOCKBACK_LAUNCH_SCALE);
  const launchX = f32(speed * directionX);
  let launchZ = f32(speed * directionZ);
  motion.grounded = wasGrounded && launch.damageLevel < 3 && directionZ <= 0;
  if (motion.grounded) {
    launchZ = 0.0;
  } else if (wasGrounded && launch.damageLevel === 3 && directionZ < 0) {

    if (meleeAtan2(-directionZ, Math.abs(directionX)) > GROUND_LAUNCH_BOUNCE_ANGLE) launchZ = -f32(launchZ * GROUND_LAUNCH_REBOUND);
  }
  launch.groundKnockbackX = motion.grounded ? launchX : 0.0;
  if (!motion.grounded) {
    target.jump.remaining = aerialJumps(target);
    target.special.airtimeUses = 0;
  }
  if (launch.knockbackAge !== undefined && launch.knockbackAge >= KNOCKBACK_STACKING_FRAMES) {
    launch.knockbackX = mergeLaunchAxis(launch.knockbackX, launchX);
    launch.knockbackZ = mergeLaunchAxis(launch.knockbackZ, launchZ);
  } else {
    launch.knockbackX = launchX;
    launch.knockbackZ = launchZ;
  }
  launch.knockbackAge = 0;
  launch.diLaunchSpeed = speed;
}


export function ageKnockback(f: Fighter): void {
  const age = f.launch.knockbackAge;
  if (age !== undefined) f.launch.knockbackAge = min(KNOCKBACK_STACKING_FRAMES, age + 1);
}


export function decayKnockback(f: Fighter, friction = 1.0): void {
  const { launch } = f;
  if (f.motion.grounded) {
    if (launch.groundKnockbackX === 0) launch.groundKnockbackX = launch.knockbackX;
    const ordinary = termsOfPhysics(f.tuning.physics).knockbackFriction;
    const decay = friction === 1.0 ? ordinary : roundMeleeWorldValue(f32(ordinary * friction));
    const sliding = launch.groundKnockbackX;
    launch.groundKnockbackX = roundMeleeWorldValue(sliding > 0 ? max(0.0, f32(sliding - decay)) : min(0.0, f32(sliding + decay)));
    launch.knockbackX = launch.groundKnockbackX;
    launch.knockbackZ = 0.0;
    return;
  }
  launch.groundKnockbackX = 0.0;
  const decayed = decayedAirMotion(
    retainedOriginal(launch.meleeKnockbackX, launch.knockbackX),
    retainedOriginal(launch.meleeKnockbackZ, launch.knockbackZ),
    AIR_KNOCKBACK_DECAY, AIR_KNOCKBACK_SQUARED_CUTOFF,
  );
  setMeleeKnockback(f, decayed.x, decayed.z);
}

interface DirectionalInfluence {
  velocityX: number;
  velocityZ: number;
  degrees: number;
  angleRadians: number;
}


const influence: DirectionalInfluence = { velocityX: 0.0, velocityZ: 0.0, degrees: 0.0, angleRadians: 0.0 };









export function directionalInfluenceVector(x: number, z: number, stickX: number, stickZ: number): Readonly<DirectionalInfluence> {
  const horizontal = roundToFloat32(x);
  const vertical = roundToFloat32(z);
  const inputX = roundToFloat32(stickX);
  const inputZ = roundToFloat32(stickZ);
  const square = fusedMultiplyAddFloat32(horizontal, horizontal, multiplyFloat32(vertical, vertical));
  if (square < 0.000009999999747378752 || (inputX === 0 && inputZ === 0)) {
    influence.velocityX = horizontal;
    influence.velocityZ = vertical;
    influence.degrees = 0.0;
    influence.angleRadians = 0.0;
    return influence;
  }
  const speed = roundToFloat32(squareRoot(square));
  const cross = -fusedMultiplyAddFloat32(vertical, inputX, -multiplyFloat32(horizontal, inputZ));
  const fraction = divideFloat32(multiplyFloat32(cross, cross), square);
  const degrees = f32(multiplyFloat32(fraction, DI_MAX_DEGREES) * (cross < 0 ? -1 : 1));
  const angle = fusedMultiplyAddFloat32(degrees, 0.01745329238474369, meleeAtan2(vertical, horizontal));
  influence.velocityX = multiplyFloat32(speed, meleeCos(angle));
  influence.velocityZ = multiplyFloat32(speed, meleeSin(angle));
  influence.degrees = degrees;
  influence.angleRadians = multiplyFloat32(degrees, 0.01745329238474369);
  return influence;
}

const sign = (value: number) => (value === 0 ? 0 : value > 0 ? 1 : -1);


export function applyDirectionalInfluence(target: Fighter, input: Readonly<Controls>): void {
  const { launch } = target;
  if (!launch.diPending) return;
  launch.diPending = false;
  launch.diLaunchSpeed = 0.0;
  if (target.motion.grounded) return;
  const dx = sign(input.direction);
  const dz = sign(input.verticalDirection);
  const inputScale = dx !== 0 && dz !== 0 ? DIAGONAL_UNIT : 1.0;
  const inputX = input.diStickValid ? input.diStickX : f32(dx * inputScale);
  const inputZ = input.diStickValid ? input.diStickZ : f32(dz * inputScale);
  const x = retainedOriginal(launch.meleeKnockbackX, launch.knockbackX);
  const z = retainedOriginal(launch.meleeKnockbackZ, launch.knockbackZ);
  const result = directionalInfluenceVector(x, z, inputX, inputZ);
  setMeleeKnockback(target, result.velocityX, result.velocityZ);
  if (result.angleRadians !== 0) {
    launch.diAngleDegrees = f32(result.angleRadians * RADIANS_TO_DEGREES);
    launch.diSerial++;
    const operands = ownedInfluenceOperands(target);
    operands.recorded = true;
    operands.x = x;
    operands.z = z;
    operands.stickX = inputX;
    operands.stickZ = inputZ;
    operands.degrees = result.degrees;
    operands.angleRadians = result.angleRadians;
  }
}
