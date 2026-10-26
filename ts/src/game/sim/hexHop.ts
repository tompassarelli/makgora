import { min } from "../core/numbers";
import { f32 } from "wisp/src/sim/f32";
import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import { DownState } from "./codes";
import { inGrabContext } from "./conditions";
import type { Fighter } from "./fighter";
import { heroStatusHop } from "./heroStatus";
import { aerialJumps } from "./itemBuffs";
import { surfaceLeft, surfaceRight } from "./stage";

// Same scramble as the match's item draws: its prime's square fits Lua32 integers, so draws are exact in every runtime.
const HOP_PRIME = 46337;

function scramble(value: number): number {
  const square = floorMod(value * value + 12345, HOP_PRIME);
  return floorMod(square ^ floorDiv(square, 32), HOP_PRIME);
}

/** A hop side, -1 or 1, drawn from the fighter's slot, the frame and the frames left; snapshots hold all three. */
function hopSide(slot: number, frame: number, left: number): number {
  const mixed = scramble(floorMod(scramble(floorMod(frame, HOP_PRIME)) + floorMod(slot * 7919 + left, HOP_PRIME), HOP_PRIME));
  return floorMod(floorDiv(scramble(mixed), 3), 2) === 0 ? -1 : 1;
}

/** Starts a status's helpless hop on its beat; a hop that would land past its deck's edge turns back, and with no room either way it hops in place. */
export function hopHeroStatus(f: Fighter, slot: number, stage: number, frame: number): void {
  const hop = heroStatusHop(f);
  const { motion, launch, status } = f;
  if (hop === undefined || !motion.grounded || launch.hitstun > 0 || launch.hitlag > 0 || f.landing.lag > 0
    || f.down.state !== DownState.none || inGrabContext(f) || floorMod(status.conditionFrames, hop.every) !== 0) return;
  const physics = f.tuning.physics;
  const run = f32(physics.walkSpeed * hop.run);
  const rise = f32(physics.shortJumpSpeed * hop.rise);
  const reach = f32(run * f32(f32(rise * 2.0) / physics.gravity));
  const deck = motion.surface ?? 0;
  const fits = (side: number): boolean => {
    const x = f32(motion.x + f32(side * reach));
    return x >= surfaceLeft(stage, deck, frame) && x <= surfaceRight(stage, deck, frame);
  };
  const drawn = hopSide(slot, frame, status.conditionFrames);
  const side = fits(drawn) ? drawn : fits(-drawn) ? -drawn : 0;
  if (side !== 0) f.facing = side;
  motion.vx = f32(side * run);
  motion.vz = rise;
  motion.fastFalling = false;
  motion.grounded = false;
  motion.surface = undefined;
  f.jump.remaining = min(f.jump.remaining, aerialJumps(f));
}
