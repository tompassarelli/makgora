import type { DrawnModel } from "../../ts/scripts/wisp/drawnModel";
import { characterModelScale } from "../../ts/src/game/presentation/modelScale";
import type { Character } from "../../ts/src/game/sim/codes";
import { LEDGE_HANG_DEPTH, LEDGE_HANG_OUTSET } from "../../ts/src/game/sim/ledge";

export function highestGrip(drawn: DrawnModel, sequence: number, seconds: number, grips: readonly number[]): number {
  const nodes = drawn.posed(sequence, seconds, 1).nodes;
  return grips.reduce((best, id) => ((nodes[id * 2 + 1] ?? -Infinity) > (nodes[best * 2 + 1] ?? -Infinity) ? id : best));
}

export function ledgeGripOffset(drawn: DrawnModel, sequence: number, seconds: number, grip: number, character: Character): readonly [number, number] {
  const nodes = drawn.posed(sequence, seconds, 1).nodes, scale = characterModelScale(character);
  return [LEDGE_HANG_OUTSET / scale - (nodes[grip * 2] ?? 0), LEDGE_HANG_DEPTH / scale - (nodes[grip * 2 + 1] ?? 0)];
}
