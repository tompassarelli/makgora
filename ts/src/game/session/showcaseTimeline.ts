import { floorDiv } from "wisp/src/sim/intMath";
import type { Character } from "../sim/codes";
import { AttackStyle } from "../sim/codes";
import { authoredTuning } from "../sim/tuning";
import { heroDefinition } from "../roster/kits";
import { attackDurationFramesForGrounding, attackStartupFrames, isAerialAttack } from "../sim/moves";
import { specialKit } from "../sim/specials/schema";
import { heroCueWindows } from "../presentation/cueWindows";

export const SHOWCASE_FIRST_FRAME = 40;
export const SHOWCASE_SPECIAL_SLOTS: readonly string[] = ["neutral_b", "side_b", "up_b", "down_b"];
export const SHOWCASE_FACINGS: readonly ("right" | "left")[] = ["right", "left"];

export interface ShowcaseMove {
  readonly slot: string;
  readonly kind: "normal" | "special" | "ultimate";
  readonly code: number;
  readonly first: number;
  readonly end: number;
}

export interface ShowcaseRow {
  readonly row: string;
  readonly move: ShowcaseMove;
  readonly facing: "right" | "left";
  readonly frames: number[];
}

export function showcaseMoves(character: Character): ShowcaseMove[] {
  const tuning = authoredTuning(character);
  const original = heroDefinition(character) === undefined;
  const normals = Object.entries(AttackStyle).filter(([, code]) => tuning.moves?.normals[code] !== undefined
    || (original && code !== AttackStyle.grab && code !== AttackStyle.dashAttack));
  const moves: ShowcaseMove[] = normals.map(([slot, code]) => ({ slot, kind: "normal", code, first: attackStartupFrames(code, tuning.moves), end: attackDurationFramesForGrounding(code, !isAerialAttack(code), tuning.moves) }));
  SHOWCASE_SPECIAL_SLOTS.forEach((slot, code) => {
    const special = tuning.specials === undefined ? undefined : specialKit(tuning.specials, code).ground;
    moves.push({ slot, kind: "special", code, first: special === undefined ? 12 : heroCueWindows(special).active.first, end: special?.endFrame ?? 120 });
  });
  if (tuning.ultimate !== undefined) moves.push({ slot: "ultimate", kind: "ultimate", code: 0, first: heroCueWindows(tuning.ultimate).active.first, end: tuning.ultimate.endFrame });
  return moves;
}

export function showcaseFrames(move: ShowcaseMove): number[] {
  const duration = Math.max(8, move.end);
  const samples = move.kind === "ultimate" ? [1, Math.max(2, floorDiv(move.first, 2)), move.first, Math.round(duration / 3), Math.round(duration * 2 / 3), duration, duration + 2, duration + 300]
    : [1, Math.max(2, floorDiv(move.first, 2)), move.first - 2, move.first, move.first + 1, move.first + 3, Math.round((move.first + 3 + duration) / 2), duration];
  const frames: number[] = [];
  for (const sample of samples.sort((a, b) => a - b)) frames.push(Math.max(SHOWCASE_FIRST_FRAME + sample, (frames[frames.length - 1] ?? SHOWCASE_FIRST_FRAME) + 1));
  return frames;
}

export function showcaseRows(character: Character): ShowcaseRow[] {
  const rows: ShowcaseRow[] = [];
  showcaseMoves(character).forEach((move, index) => {
    SHOWCASE_FACINGS.forEach((facing, side) => {
      rows.push({ row: `R${String(index * 2 + side + 1).padStart(2, "0")}`, move, facing, frames: showcaseFrames(move) });
    });
  });
  return rows;
}
