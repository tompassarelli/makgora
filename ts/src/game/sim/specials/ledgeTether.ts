import { f32 } from "wisp/src/sim/f32";
import { PARTICIPANT_CAPACITY } from "../../input/participants";
import { LedgeState } from "../codes";
import type { Fighter, Projectile } from "../fighter";
import { capsulesIntersect, emptyCapsule, placeCapsule } from "../geometry/contactGeometry";
import { LEDGE_TETHER_ARMED, LEDGE_TETHER_SPENT } from "../ledgeTetherAirtime";
import { type Roster, fighterAt, isActive } from "../roster";
import { mainDeckLeft, mainDeckRight, mainDeckZ } from "../stage";
import { cancelSpecialState } from "../transitions";
import type { LedgeTether, SpecialProjectile } from "./schema";

export const HOOK_LEDGE_RADIUS = 40.0;

const reach = emptyCapsule();
const edge = emptyCapsule();

function ledgeTaken(world: Roster, side: number): boolean {
  for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) {
    if (isActive(world, slot) && fighterAt(world, slot).ledge.state !== LedgeState.none && fighterAt(world, slot).ledge.side === side) return true;
  }
  return false;
}

function freeLedgeAhead(world: Roster, f: Readonly<Fighter>, side: number, stage: number): number | undefined {
  const edgeX = side < 0 ? mainDeckLeft(stage) : mainDeckRight(stage);
  return f32(f32(f.motion.x - edgeX) * side) <= 0 || ledgeTaken(world, side) ? undefined : edgeX;
}

function placeEdge(edgeX: number, stage: number, radius: number): void {
  edge.x1 = edgeX;
  edge.x2 = edgeX;
  edge.z1 = mainDeckZ(stage);
  edge.z2 = edge.z1;
  edge.radius = radius;
}

function startTether(f: Fighter, side: number): void {
  cancelSpecialState(f);
  f.ledge.state = LedgeState.tether;
  f.ledge.side = side;
  f.ledge.frame = 0;
  f.motion.vx = 0.0;
  f.motion.vz = 0.0;
  f.launch.knockbackX = 0.0;
  f.launch.knockbackZ = 0.0;
}

/** On a tether frame, a free ledge ahead inside the hook's reach catches it: the move ends and its user starts reeling to hang there. */
export function tetherToLedge(world: Roster | undefined, f: Fighter, tether: Readonly<LedgeTether> | undefined, frame: number, stage: number): boolean {
  if (world === undefined || tether === undefined || frame < tether.first || frame > tether.last || f.motion.grounded || f.launch.hitlag > 0 || f.ledge.regrab > 0) return false;
  const side = -f.facing;
  const edgeX = freeLedgeAhead(world, f, side, stage);
  if (edgeX === undefined) return false;
  placeCapsule(reach, tether.reach, f.motion.x, f.motion.z, f.facing);
  placeEdge(edgeX, stage, 1.0);
  if (!capsulesIntersect(reach, edge)) return false;
  startTether(f, side);
  return true;
}

export function armLedgeTether(f: Fighter, spec: Readonly<SpecialProjectile>): void {
  if (spec.latchesLedge !== true) return;
  const uses = f.special.airtimeUses;
  f.special.airtimeUses = f.motion.grounded || (uses & LEDGE_TETHER_SPENT) !== 0 ? uses & ~LEDGE_TETHER_ARMED : uses | LEDGE_TETHER_SPENT | LEDGE_TETHER_ARMED;
}

function canTether(f: Readonly<Fighter>): boolean {
  return (f.special.airtimeUses & LEDGE_TETHER_ARMED) !== 0 && !f.status.out && !f.motion.grounded && !f.special.fall
    && f.launch.hitlag <= 0 && f.launch.hitstun <= 0 && f.ledge.state === LedgeState.none && f.ledge.regrab <= 0;
}

export function hookLatchesLedge(world: Roster, ownerSlot: number, projectile: Readonly<Projectile>, fromX: number, fromZ: number, stage: number): boolean {
  const owner = fighterAt(world, ownerSlot);
  if (projectile.spec?.latchesLedge !== true || projectile.damageMultiplier !== 1.0 || !canTether(owner)) return false;
  const side = -projectile.direction;
  const edgeX = freeLedgeAhead(world, owner, side, stage);
  if (edgeX === undefined) return false;
  reach.x1 = fromX;
  reach.z1 = fromZ;
  reach.x2 = projectile.x;
  reach.z2 = projectile.z;
  reach.radius = projectile.spec.radius;
  placeEdge(edgeX, stage, HOOK_LEDGE_RADIUS);
  if (!capsulesIntersect(reach, edge)) return false;
  startTether(owner, side);
  return true;
}
