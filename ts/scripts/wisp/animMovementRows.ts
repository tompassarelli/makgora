import type { Character } from "../../src/game/sim/codes";
import { type CrouchSample, type JumpSample, type LedgeSample, sampleCrouch, sampleJumps, sampleLedgeHang } from "./animScoreSample";
import type { DrawnModel } from "./hurtboxView";

export const MOVEMENT_MOVES = ["crouch", "ledge-hang", "double-jump"] as const;
export type MovementMove = (typeof MOVEMENT_MOVES)[number];

export const isMovementMove = (move: string): move is MovementMove => (MOVEMENT_MOVES as readonly string[]).includes(move);

const spread = (values: readonly number[], count: number) =>
  Array.from({ length: Math.min(count, values.length) }, (_, index) => values[Math.round(index * (values.length - 1) / Math.max(1, Math.min(count, values.length) - 1))] ?? 0);

export const crouchSeconds = (sample: CrouchSample) => [sample.standSeconds, sample.crouchSeconds];
export const ledgeSeconds = (sample: LedgeSample) => spread(sample.hangSeconds, 4);
export const doubleJumpSeconds = (sample: JumpSample) => spread(sample.secondSeconds, 6);

export function movementSeconds(move: MovementMove, model: DrawnModel, character: Character): readonly number[] {
  if (move === "crouch") return crouchSeconds(sampleCrouch(model, character));
  if (move === "ledge-hang") return ledgeSeconds(sampleLedgeHang(model, character));
  return doubleJumpSeconds(sampleJumps(model, character));
}

export const MOVEMENT_CAPTIONS: Readonly<Record<MovementMove, string>> = {
  "crouch": "frames: standing, then the held crouch",
  "ledge-hang": "frames: the hang across its first second, left to right",
  "double-jump": "frames: the second jump's rise, left to right",
};
