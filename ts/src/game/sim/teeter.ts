import { f32 } from "wisp/src/sim/f32";
import { DownState, GroundAction, SpecialAction } from "./codes";
import type { Fighter } from "./fighter";
import { clearDash } from "./groundMovement";
import { WALK_MIDDLE_STICK_THRESHOLD } from "./stickZones";
import * as stageSurfaces from "./stage";

export function canTeeter(f: Readonly<Fighter>): boolean {
  const { motion, launch, shield } = f;
  return motion.grounded && !motion.crouching && f.attack.style === undefined && f.special.action === SpecialAction.none
    && f.ground.action !== GroundAction.turnRun && f.ground.pivotGraceFrames === 0
    && launch.hitstun <= 0 && f.down.state === DownState.none && f.jump.squat <= 0
    && launch.knockbackX === 0 && shield.pushbackX === 0 && shield.recoilX === 0;
}

export function teeterAtEdge(f: Fighter, stage: number, matchFrame: number, horizontalStick: number): boolean {
  const { motion } = f;
  const deck = motion.surface ?? 0;
  const left = stageSurfaces.surfaceLeft(stage, deck, matchFrame);
  const right = stageSurfaces.surfaceRight(stage, deck, matchFrame);
  const side = motion.x > right ? 1 : motion.x < left ? -1 : 0;
  if (side === 0 || f32(horizontalStick * side) >= WALK_MIDDLE_STICK_THRESHOLD) return false;
  motion.x = side > 0 ? right : left;
  motion.vx = 0.0;
  f.landing.lag = 0;
  clearDash(f);
  return true;
}
