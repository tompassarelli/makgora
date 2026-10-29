import { f32 } from "wisp/src/sim/f32";
import { max, min } from "../core/numbers";
import { SpecialAction } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import { LEDGE_TETHER_SPENT } from "../sim/ledgeTetherAirtime";
import type { Controls } from "../sim/roster";
import { HOOK_LEDGE_RADIUS } from "../sim/specials/ledgeTether";
import { runningHeroSpecial } from "../sim/specials/runningMove";
import type { AuthoredSpecial, SpecialProjectile } from "../sim/specials/schema";
import { mainDeckLeft, mainDeckRight, mainDeckZ } from "../sim/stage";

const LATCH_MARGIN = 10.0;

const latchingHead = (move: Readonly<AuthoredSpecial> | undefined): Readonly<SpecialProjectile> | undefined =>
  move?.projectiles?.find((projectile) => projectile.latchesLedge === true);

function tapHook(f: Readonly<Fighter>): Readonly<SpecialProjectile> | undefined {
  for (const branch of f.tuning.specials?.neutral.air?.followUps ?? []) {
    const head = latchingHead(branch.special);
    if (head !== undefined) return head;
  }
  return undefined;
}

function crossesLedge(head: Readonly<SpecialProjectile>, toX: number, toZ: number, velocityX: number, velocityZ: number): boolean {
  const speed = f32(f32(velocityX * velocityX) + f32(velocityZ * velocityZ));
  const along = max(0.0, min(f32(head.life), f32(f32(f32(toX * velocityX) + f32(toZ * velocityZ)) / speed)));
  const missX = f32(toX - f32(along * velocityX));
  const missZ = f32(toZ - f32(along * velocityZ));
  const reach = f32(f32(HOOK_LEDGE_RADIUS + head.radius) - LATCH_MARGIN);
  return f32(f32(missX * missX) + f32(missZ * missZ)) <= f32(reach * reach);
}

function ledgeAim(f: Readonly<Fighter>, head: Readonly<SpecialProjectile>, stage: number, side: number, leadFrames: number): number | undefined {
  const edgeX = side < 0 ? mainDeckLeft(stage) : mainDeckRight(stage);
  const toX = f32(f32(f32(edgeX - f.motion.x) * f.facing) - head.offsetX);
  const toZ = f32(f32(mainDeckZ(stage) - f32(f.motion.z + f32(f.motion.vz * leadFrames))) - head.offsetZ);
  if (toX <= 0.0) return undefined;
  if (crossesLedge(head, toX, toZ, head.velocityX, head.velocityZ)) return 0;
  if (head.upVelocityX !== undefined && crossesLedge(head, toX, toZ, head.upVelocityX, head.upVelocityZ ?? head.velocityZ)) return 1;
  if (head.downVelocity !== undefined && crossesLedge(head, toX, toZ, head.downVelocity.velocityX, head.downVelocity.velocityZ)) return -1;
  return undefined;
}

export function aimLedgeHook(f: Readonly<Fighter>, stage: number, side: number, input: Controls): void {
  if (f.special.action !== SpecialAction.heroNeutral || tapHook(f) === undefined) return;
  const move = runningHeroSpecial(f);
  input.specialHeld = false;
  const head = latchingHead(move);
  if (head === undefined || move?.aimFrames === undefined || f.special.frame >= move.aimFrames) return;
  input.verticalDirection = ledgeAim(f, head, stage, side, move.aimFrames - f.special.frame) ?? 0;
}

export function throwsLedgeHook(f: Readonly<Fighter>, stage: number, side: number, input: Controls): boolean {
  const head = tapHook(f);
  if (head === undefined || f.special.fall || f.facing !== -side || (f.special.airtimeUses & LEDGE_TETHER_SPENT) !== 0) return false;
  if (ledgeAim(f, head, stage, side, head.spawnFrame + 2) === undefined) return false;
  input.specialPressed = true;
  input.specialHeld = false;
  input.specialX = 0;
  input.specialZ = 0;
  input.direction = -side;
  input.verticalDirection = 0;
  return true;
}
