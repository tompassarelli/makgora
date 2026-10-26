import { f32 } from "wisp/src/sim/f32";
import { canTeeter } from "../sim/teeter";
import { inGrabContext, isGroundDodging } from "../sim/conditions";
import type { Fighter } from "../sim/fighter";
import { totalVelocityX } from "../sim/motion";
import { surfaceLeft, surfaceRight } from "../sim/stage";

const EDGE_REACH = 0.5;
const LEAN = f32(0.24);
const WOBBLE = f32(0.08);
const WOBBLE_FRAMES = 44;

export function teeterSide(f: Readonly<Fighter>, stage: number, matchFrame: number): number {
  const { motion } = f;
  if (!canTeeter(f) || f.shield.raised || f.status.out || inGrabContext(f) || isGroundDodging(f) || totalVelocityX(f) !== 0.0) return 0;
  const deck = motion.surface ?? 0;
  if (motion.x >= surfaceRight(stage, deck, matchFrame) - EDGE_REACH) return 1;
  return motion.x <= surfaceLeft(stage, deck, matchFrame) + EDGE_REACH ? -1 : 0;
}

export function teeterPitch(f: Readonly<Fighter>, stage: number, matchFrame: number, frame: number, facing: number): number {
  const side = teeterSide(f, stage, matchFrame);
  if (side === 0) return 0.0;
  const lean = LEAN + WOBBLE * Math.sin(frame * 2.0 * Math.PI / WOBBLE_FRAMES);
  return side * facing * lean;
}
