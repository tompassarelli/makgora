import { f32 } from "wisp/src/sim/f32";
import { PARTICIPANT_CAPACITY } from "../input/participants";
import { max, min } from "../core/numbers";
import type { Fighter, PlacedObject } from "./fighter";
import { type Roster, fighterAt, isActive } from "./roster";
import { runningHeroSpecial } from "./specials/runningMove";
import { CompanionMode, type PlacementWalk, type SpecialMotion } from "./specials/schema";
import { surfaceLeft, surfaceRight, surfaceZAt } from "./stage";
import { canHit } from "./teams";

const STILL: readonly SpecialMotion[] = [];

export const PLACED_THROW_FRAMES = 8;

export function untouchable(placed: Readonly<Pick<PlacedObject, "mode">>): boolean {
  return placed.mode === CompanionMode.vanished || placed.mode === CompanionMode.burrowed || placed.mode === CompanionMode.rising;
}

function surfaceFrame(owner: Readonly<Fighter>): number {
  for (const segment of runningHeroSpecial(owner)?.motion ?? STILL) if (segment.resurface !== undefined) return segment.first;
  return -1;
}

function diving(owner: Readonly<Fighter>): boolean {
  const surfaces = surfaceFrame(owner);
  return surfaces >= 0 && owner.special.frame < surfaces;
}

function nearestFoeX(world: Roster, ownerSlot: number, x: number): number | undefined {
  let nearest: number | undefined;
  for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) {
    if (!isActive(world, slot) || !canHit(world, ownerSlot, slot)) continue;
    const foe = fighterAt(world, slot);
    if (foe.status.out) continue;
    if (nearest === undefined || Math.abs(f32(foe.motion.x - x)) < Math.abs(f32(nearest - x))) nearest = foe.motion.x;
  }
  return nearest;
}

function sign(value: number, otherwise: number): number {
  return value < 0.0 ? -1 : value > 0.0 ? 1 : otherwise < 0 ? -1 : 1;
}

function side(owner: Readonly<Fighter>, placed: Readonly<PlacedObject>, walk: Readonly<PlacementWalk>, foeX: number | undefined): number {
  if (foeX !== undefined && Math.abs(f32(foeX - owner.motion.x)) > walk.near) return sign(f32(foeX - owner.motion.x), owner.facing);
  return sign(f32(placed.x - owner.motion.x), owner.facing);
}

function onFloor(placed: PlacedObject, x: number, radius: number, stage: number, matchFrame: number): void {
  const surface = placed.surface;
  if (surface === undefined) return;
  placed.x = min(f32(surfaceRight(stage, surface, matchFrame) - radius), max(f32(surfaceLeft(stage, surface, matchFrame) + radius), x));
  placed.z = surfaceZAt(stage, surface, matchFrame, placed.x);
}

function goal(owner: Readonly<Fighter>, placed: Readonly<PlacedObject>, walk: Readonly<PlacementWalk>, spread: number, foeX: number | undefined): number {
  const toward = side(owner, placed, walk, foeX);
  const inner = f32(owner.motion.x + f32(toward * f32(walk.near + spread)));
  const outer = f32(owner.motion.x + f32(toward * f32(walk.far + spread)));
  const low = min(inner, outer);
  const high = max(inner, outer);
  let x = min(high, max(low, placed.x));
  if (foeX === undefined) return x;
  const excess = f32(Math.abs(f32(foeX - x)) - walk.range);
  if (excess > 0.0) x = min(high, max(low, f32(x + f32(sign(f32(foeX - x), 1) * excess))));
  return x;
}

function walkTo(placed: PlacedObject, target: number, walk: Readonly<PlacementWalk>, radius: number, stage: number, matchFrame: number, foeX: number | undefined): void {
  const dx = f32(target - placed.x);
  const stride = Math.abs(dx) <= walk.speed ? dx : f32(sign(dx, 1) * walk.speed);
  const from = placed.x;
  onFloor(placed, f32(placed.x + stride), radius, stage, matchFrame);
  if (placed.x !== from) placed.direction = placed.x < from ? -1 : 1;
  else if (foeX !== undefined && foeX !== placed.x) placed.direction = foeX < placed.x ? -1 : 1;
}

function goUnder(placed: PlacedObject): void {
  placed.mode = CompanionMode.burrowed;
  placed.modeFrame = 0;
  placed.apart = 0;
}

function comeUp(world: Roster, ownerSlot: number, owner: Readonly<Fighter>, placed: PlacedObject, walk: Readonly<PlacementWalk>, spread: number, radius: number, stage: number, matchFrame: number): void {
  const foeX = nearestFoeX(world, ownerSlot, owner.motion.x);
  const toward = foeX !== undefined && foeX !== owner.motion.x ? sign(f32(foeX - owner.motion.x), owner.facing) : sign(owner.facing, 1);
  placed.surface = owner.motion.surface;
  onFloor(placed, f32(owner.motion.x + f32(toward * f32(walk.near + spread))), radius, stage, matchFrame);
  placed.direction = toward;
  placed.mode = CompanionMode.rising;
  placed.modeFrame = 0;
}

function stranded(owner: Readonly<Fighter>, placed: PlacedObject, walk: Readonly<PlacementWalk>): boolean {
  const apart = owner.motion.grounded && owner.motion.surface !== undefined && owner.motion.surface !== placed.surface;
  placed.apart = apart ? placed.apart + 1 : 0;
  return placed.apart >= walk.strandedFrames;
}

export function walkPlaced(world: Roster, ownerSlot: number, placed: PlacedObject, slot: number, walk: Readonly<PlacementWalk>, radius: number, stage: number, matchFrame: number): void {
  const owner = fighterAt(world, ownerSlot);
  const spread = f32(slot * walk.spacing);
  if (placed.mode === CompanionMode.burrowed) {
    placed.modeFrame++;
    const ready = placed.modeFrame >= walk.underFrames && !diving(owner) && owner.motion.grounded && owner.motion.surface !== undefined && !owner.status.out;
    if (ready) comeUp(world, ownerSlot, owner, placed, walk, spread, radius, stage, matchFrame);
    return;
  }
  if (placed.mode === CompanionMode.rising) {
    if (++placed.modeFrame >= walk.riseFrames) {
      placed.mode = CompanionMode.follow;
      placed.modeFrame = 0;
    }
    return;
  }
  if (placed.mode === CompanionMode.throwing && ++placed.modeFrame >= PLACED_THROW_FRAMES) {
    placed.mode = CompanionMode.follow;
    placed.modeFrame = 0;
  }
  if (placed.mode !== CompanionMode.follow && placed.mode !== CompanionMode.throwing || owner.status.out) return;
  if (diving(owner) || stranded(owner, placed, walk)) {
    goUnder(placed);
    return;
  }
  if (placed.mode === CompanionMode.throwing) return;
  const foeX = nearestFoeX(world, ownerSlot, placed.x);
  walkTo(placed, goal(owner, placed, walk, spread, foeX), walk, radius, stage, matchFrame, foeX);
}
