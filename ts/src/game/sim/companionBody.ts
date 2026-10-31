import { f32 } from "wisp/src/sim/f32";
import { max, min } from "../core/numbers";
import type { PlacedObject } from "./fighter";
import type { HitEffect } from "./hitRegions";
import { KNOCKBACK_LAUNCH_SPEED, TUMBLE_KNOCKBACK, effectKnockback, ordinaryHitstunFrames } from "./knockback";
import { AIR_KNOCKBACK_DECAY } from "./motion";
import { capPercent } from "./percent";
import { CompanionMode, type CompanionBody } from "./specials/schema";
import { mainDeckLeft, mainDeckRight, mainDeckZAt, surfaceCount, surfaceLeft, surfaceRight, surfaceZAt } from "./stage";
import { stageBounds } from "./stageBounds";
import { melee } from "./tuning";

const LAUNCH_SCALE = melee(KNOCKBACK_LAUNCH_SPEED);
const DECAY = melee(AIR_KNOCKBACK_DECAY);

function towardZero(value: number, step: number): number {
  return value > 0.0 ? max(0.0, f32(value - step)) : min(0.0, f32(value + step));
}

export function restCompanionBody(placed: PlacedObject, body: Readonly<CompanionBody> | undefined): void {
  placed.percent = 0.0;
  placed.hitstun = 0;
  placed.velocityX = 0.0;
  placed.velocityZ = 0.0;
  placed.jumps = body?.airJumps ?? 0;
}

export function launchCompanionBody(placed: PlacedObject, body: Readonly<CompanionBody>, effect: Readonly<HitEffect>, direction: number, damage: number): void {
  placed.percent = capPercent(f32(placed.percent + damage));
  const knockback = effectKnockback(effect, placed.percent, damage, body.weight);
  const speed = f32(knockback * LAUNCH_SCALE);
  const rise = f32(speed * effect.launchZ);
  placed.hitstun = ordinaryHitstunFrames(knockback);
  placed.velocityX = f32(f32(speed * effect.launchX) * (direction < 0 ? -1 : 1));
  if (placed.surface === undefined || rise > 0.0 || knockback >= TUMBLE_KNOCKBACK) {
    placed.surface = undefined;
    placed.velocityZ = rise;
  } else {
    placed.velocityZ = 0.0;
  }
  placed.mode = CompanionMode.stunned;
  placed.modeFrame = 0;
}

function land(placed: PlacedObject, body: Readonly<CompanionBody>, previousZ: number, stage: number, matchFrame: number): void {
  let landing: number | undefined;
  let landingZ = 0.0;
  for (let surface = 0; surface < surfaceCount(stage); surface++) {
    if (placed.x < surfaceLeft(stage, surface, matchFrame) || placed.x > surfaceRight(stage, surface, matchFrame)) continue;
    const z = surfaceZAt(stage, surface, matchFrame, placed.x);
    if (previousZ < z || placed.z > z || (landing !== undefined && z <= landingZ)) continue;
    landing = surface;
    landingZ = z;
  }
  if (landing === undefined) return;
  placed.surface = landing;
  placed.z = landingZ;
  placed.velocityX = 0.0;
  placed.velocityZ = 0.0;
  placed.jumps = body.airJumps;
}

function recover(placed: PlacedObject, body: Readonly<CompanionBody>, stage: number): void {
  const left = mainDeckLeft(stage);
  const right = mainDeckRight(stage);
  if (placed.x >= left && placed.x <= right) return;
  const home = placed.x < left ? 1 : -1;
  placed.direction = home;
  placed.velocityX = f32(home * body.airDrift);
  if (placed.jumps > 0 && placed.velocityZ < 0.0 && placed.z < mainDeckZAt(stage, placed.x < left ? left : right)) {
    placed.jumps--;
    placed.velocityZ = body.hopSpeed;
  }
}

export function hopCompanionBody(placed: PlacedObject, body: Readonly<CompanionBody>, direction: number, rise: number): void {
  placed.surface = undefined;
  if (rise <= 0.0) placed.z = f32(placed.z - 1.0);
  placed.velocityZ = rise;
  placed.velocityX = f32(direction * body.airDrift);
  placed.direction = direction;
}

export function advanceCompanionBody(placed: PlacedObject, body: Readonly<CompanionBody>, stage: number, matchFrame: number): boolean {
  if (placed.hitstun > 0) placed.hitstun--;
  let busy = placed.hitstun > 0;
  if (placed.surface === undefined) {
    const previousZ = placed.z;
    placed.x = f32(placed.x + placed.velocityX);
    placed.z = f32(placed.z + placed.velocityZ);
    placed.velocityZ = placed.velocityZ < -body.fallSpeed ? placed.velocityZ : max(-body.fallSpeed, f32(placed.velocityZ - body.gravity));
    placed.velocityX = towardZero(placed.velocityX, DECAY);
    if (placed.z <= previousZ) land(placed, body, previousZ, stage, matchFrame);
    busy = busy || placed.surface === undefined;
  } else if (placed.velocityX !== 0.0) {
    const surface = placed.surface;
    placed.x = f32(placed.x + placed.velocityX);
    placed.velocityX = towardZero(placed.velocityX, DECAY);
    if (placed.x < surfaceLeft(stage, surface, matchFrame) || placed.x > surfaceRight(stage, surface, matchFrame)) placed.surface = undefined;
    else placed.z = surfaceZAt(stage, surface, matchFrame, placed.x);
    busy = true;
  }
  const { blast } = stageBounds(stage);
  if (placed.x < blast.left || placed.x > blast.right || placed.z < blast.bottom || placed.z > blast.top) {
    placed.life = 0;
    return true;
  }
  if (placed.surface === undefined && placed.hitstun === 0) recover(placed, body, stage);
  if (!busy && placed.mode === CompanionMode.stunned) {
    placed.mode = CompanionMode.follow;
    placed.modeFrame = 0;
  }
  return busy;
}
