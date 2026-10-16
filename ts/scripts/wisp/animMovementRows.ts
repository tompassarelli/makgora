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


export const MOVEMENT_EXPECTED: Readonly<Record<MovementMove, string>> = {
  "crouch": "a crouch: a visibly lower silhouette than standing, held",
  "ledge-hang": "a ledge hang: hands or weapon at the ledge, body below it, facing the stage",
  "double-jump": "a double jump in a named style, such as a twist or flip, distinct from the first jump",
};

const COLD_READ_BATCH = 9;

export const stripId = (look: string, fighter: string, move: string) => new Bun.CryptoHasher("sha256").update(`${look}/${fighter}/${move}`).digest("hex").slice(0, 8);

export interface ColdStrip { readonly id: string; readonly fighter: string; readonly move: MovementMove; readonly path: string }

export const coldReadBatches = (strips: readonly ColdStrip[]) => {
  const shuffled = [...strips].sort((a, b) => a.id.localeCompare(b.id));
  return Array.from({ length: Math.ceil(shuffled.length / COLD_READ_BATCH) }, (_, index) => shuffled.slice(index * COLD_READ_BATCH, (index + 1) * COLD_READ_BATCH));
};

export const coldReadBatch = (brief: string, look: string, batch: readonly ColdStrip[], answers: string) =>
  `${brief}\n\n## Your strips (look: ${look})\n\n${batch.map((strip) => `- \`${strip.id}\`: ${strip.path}`).join("\n")}\n\nWrite your answers to ${answers}, one JSON line per strip.\n`;

export const answerKey = (look: string, strips: readonly ColdStrip[]) =>
  `${["look", "strip", "fighter", "move", "expected"].join("\t")}\n${strips.map((strip) => [look, strip.id, strip.fighter, strip.move, MOVEMENT_EXPECTED[strip.move]].join("\t")).join("\n")}\n`;
