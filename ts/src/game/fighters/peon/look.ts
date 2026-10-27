import { f32 } from "wisp/src/sim/f32";
import { PEON_CLIPS, PEON_FALLBACK_CLIP, PEON_PAIN_CLIPS } from "./clips";
import type { HeroLook } from "../../presentation/model/look";
import type { HeroClip } from "../../sim/heroes/hero";

const GOLD_CARRY: HeroClip = { index: 18, seconds: f32(0.3) };
const SACK_BONKS: readonly HeroClip[] = [...Array.from({ length: 5 }, () => PEON_CLIPS.neutralSpecial), GOLD_CARRY];

export const peonLook: HeroLook = {
  model: "units\\orc\\Peon\\Peon.mdl",
  objectId: 0x6d667065,
  portrait: "ReplaceableTextures\\CommandButtons\\BTNPeon.blp",
  clips: PEON_CLIPS,
  followUpClips: { neutralSpecialFollowUp: SACK_BONKS, neutralSpecialFollowUpAir: SACK_BONKS },
  damageClips: PEON_PAIN_CLIPS,
  fallback: PEON_FALLBACK_CLIP, defeat: "death",
  carry: { stand: "grabHold", walk: "walk" },
};
