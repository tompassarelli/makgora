import type { Character } from "../../src/game/sim/codes";
import { specialKit } from "../../src/game/sim/specials/schema";
import { authoredTuning } from "../../src/game/sim/tuning";

const SPECIAL_MOVES: readonly string[] = ["neutral-special", "side-special", "up-special", "down-special"];

export function sampleWithStoredCharge<T>(character: Character, move: string, sample: (storedCharge: number) => T | undefined): T | undefined {
  const specials = authoredTuning(character).specials;
  const code = SPECIAL_MOVES.indexOf(move);
  const full = specials === undefined || code < 0 ? undefined : specialKit(specials, code).ground?.charge?.full;
  return sample(0) ?? (full === undefined ? undefined : sample(full));
}
