import { f32 } from "wisp/src/sim/f32";
import { PARTICIPANT_CAPACITY } from "../../input/participants";
import { LedgeState } from "../codes";
import type { Fighter } from "../fighter";
import { capsulesIntersect, emptyCapsule, placeCapsule } from "../geometry/contactGeometry";
import { type Roster, fighterAt, isActive } from "../roster";
import { mainDeckLeft, mainDeckRight, mainDeckZ } from "../stage";
import { cancelSpecialState } from "../transitions";
import type { LedgeTether } from "./schema";

const reach = emptyCapsule();
const edge = emptyCapsule();

function ledgeTaken(world: Roster, side: number): boolean {
  for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) {
    if (isActive(world, slot) && fighterAt(world, slot).ledge.state !== LedgeState.none && fighterAt(world, slot).ledge.side === side) return true;
  }
  return false;
}

/** On a tether frame, a free ledge ahead inside the hook's reach catches it: the move ends and its user starts reeling to hang there. */
export function tetherToLedge(world: Roster | undefined, f: Fighter, tether: Readonly<LedgeTether> | undefined, frame: number, stage: number): boolean {
  if (world === undefined || tether === undefined || frame < tether.first || frame > tether.last || f.motion.grounded || f.launch.hitlag > 0 || f.ledge.regrab > 0) return false;
  const side = -f.facing;
  const edgeX = side < 0 ? mainDeckLeft(stage) : mainDeckRight(stage);
  if (f32(f32(f.motion.x - edgeX) * side) <= 0 || ledgeTaken(world, side)) return false;
  placeCapsule(reach, tether.reach, f.motion.x, f.motion.z, f.facing);
  edge.x1 = edgeX;
  edge.x2 = edgeX;
  edge.z1 = mainDeckZ(stage);
  edge.z2 = edge.z1;
  edge.radius = 1.0;
  if (!capsulesIntersect(reach, edge)) return false;
  cancelSpecialState(f);
  f.ledge.state = LedgeState.tether;
  f.ledge.side = side;
  f.ledge.frame = 0;
  f.motion.vx = 0.0;
  f.motion.vz = 0.0;
  f.launch.knockbackX = 0.0;
  f.launch.knockbackZ = 0.0;
  return true;
}
