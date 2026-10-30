import { LEDGE_HANG_DEPTH, LEDGE_HANG_OUTSET } from "../../src/game/sim/ledge";
import type { Character } from "../../src/game/sim/codes";
import { type CrouchSample, type HopSample, type JumpSample, type LedgeSample, sampleCrouch, sampleHop, sampleJumps, sampleLedgeHang } from "./animScoreSample";
import type { DrawnModel } from "./drawnModel";

export const MOVEMENT_MOVES = ["crouch", "ledge-hang", "double-jump", "jump-squat", "short-hop", "full-hop"] as const;
export type MovementMove = (typeof MOVEMENT_MOVES)[number];

export const isMovementMove = (move: string): move is MovementMove => (MOVEMENT_MOVES as readonly string[]).includes(move);

const spread = (values: readonly number[], count: number) =>
  Array.from({ length: Math.min(count, values.length) }, (_, index) => values[Math.round(index * (values.length - 1) / Math.max(1, Math.min(count, values.length) - 1))] ?? 0);

export interface MovementFrames { readonly seconds: readonly number[]; readonly heights: readonly number[] }

const grounded = (seconds: readonly number[]): MovementFrames => ({ seconds, heights: seconds.map(() => 0) });
export const crouchFrames = (sample: CrouchSample) => grounded([sample.standSeconds, sample.crouchSeconds]);
export const ledgeFrames = (sample: LedgeSample) => grounded(spread(sample.hangSeconds, 4));
export const doubleJumpFrames = (sample: JumpSample): MovementFrames => ({ seconds: spread(sample.secondSeconds, 6), heights: spread(sample.secondHeights, 6) });

const HOP_STRIP_FRAMES = 8;
const SQUAT_STRIP_AIR_FRAMES = 2;

export const hopFrames = (sample: HopSample, from: number, to: number, count: number): MovementFrames => {
  const at = spread(Array.from({ length: to - from + 1 }, (_, index) => from + index), count);
  return { seconds: at.map((index) => sample.seconds[index] ?? 0), heights: at.map((index) => sample.heights[index] ?? 0) };
};
export const jumpSquatFrames = (sample: HopSample) => hopFrames(sample, 0, sample.squatFrames + SQUAT_STRIP_AIR_FRAMES - 1, sample.squatFrames + SQUAT_STRIP_AIR_FRAMES);
export const hopStripFrames = (sample: HopSample) => hopFrames(sample, sample.squatFrames - 1, sample.squatFrames + sample.airFrames - 1, HOP_STRIP_FRAMES);

export function movementFrames(move: MovementMove, model: DrawnModel, character: Character): MovementFrames {
  if (move === "jump-squat") return jumpSquatFrames(sampleHop(model, character, "full"));
  if (move === "short-hop" || move === "full-hop") return hopStripFrames(sampleHop(model, character, move === "short-hop" ? "short" : "full"));
  if (move === "crouch") return crouchFrames(sampleCrouch(model, character));
  if (move === "ledge-hang") return ledgeFrames(sampleLedgeHang(model, character));
  return doubleJumpFrames(sampleJumps(model, character));
}


export const ledgeCorner = () => ({ x: LEDGE_HANG_OUTSET, z: LEDGE_HANG_DEPTH });

const STAGE_COLOUR = "#8a8a8a";
const FRAME_WIDTH = 1920, FRAME_HEIGHT = 1080, FOCUS_RISE = 90;

export type StageShape = { readonly kind: "floor"; readonly y: number } | { readonly kind: "corner"; readonly x: number; readonly y: number };

export const stageShape = (move: MovementMove, pixelsPerUnit: number): StageShape => {
  if (move !== "ledge-hang") return { kind: "floor", y: FRAME_HEIGHT / 2 + FOCUS_RISE * pixelsPerUnit };
  const corner = ledgeCorner();
  return { kind: "corner", x: FRAME_WIDTH / 2 + corner.x * pixelsPerUnit, y: FRAME_HEIGHT / 2 + (FOCUS_RISE - corner.z) * pixelsPerUnit };
};

export const movementCrop = (heights: readonly number[], pixelsPerUnit: number) => {
  const rise = 2 * Math.ceil(Math.max(0, ...heights) * pixelsPerUnit / 2);
  return `480x${360 + rise}+0-${60 + rise / 2}`;
};

export const stageDrawArgs = (shape: StageShape): readonly string[] => [
  "-gravity", "NorthWest", "-fill", STAGE_COLOUR,
  "-draw", `rectangle ${(shape.kind === "floor" ? 0 : shape.x).toFixed(1)},${shape.y.toFixed(1)} ${FRAME_WIDTH},${FRAME_HEIGHT}`,
];

export const MOVEMENT_EXPECTED: Readonly<Record<MovementMove, string>> = {
  "crouch": "a crouch: a visibly lower silhouette than standing, held",
  "ledge-hang": "a ledge hang: hands or weapon at the ledge, body below it, facing the stage",
  "double-jump": "a double jump in a named style, such as a twist or flip, distinct from the first jump",
  "jump-squat": "a jump squat: the body compresses toward the floor, then pushes off it",
  "short-hop": "a short hop: a crouch and push-off, a low rise, an apex and a fall to the floor",
  "full-hop": "a full hop: a crouch and push-off, a high rise, an apex and a fall to the floor",
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

export const JUMP_LINES = [
  { start: "ground", kind: "double-jump", title: "double jump", first: "first jump" },
  { start: "ledge", kind: "ledge-double-jump", title: "double jump taken from ledge hang", first: "ledge jump" },
] as const;
