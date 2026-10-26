import { CandleState, Character } from "../../sim/codes";
import type { HeroClipTable } from "../../sim/heroes/hero";
import { KOBOLD_BARE_CLIPS, KOBOLD_CLIPS } from "./clips";

const BARE_CLIPS: HeroClipTable = { ...KOBOLD_CLIPS, ...KOBOLD_BARE_CLIPS };

export function koboldLocomotionClips(character: Character, candleState: CandleState): HeroClipTable | undefined {
  return character === Character.kobold && candleState !== CandleState.held ? BARE_CLIPS : undefined;
}
