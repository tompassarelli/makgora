import { SYLVANAS_CLIPS, SYLVANAS_FALLBACK_CLIP, SYLVANAS_PAIN_CLIPS } from "./clips";
import { f32 } from "wisp/src/sim/f32";
import { AttackStyle } from "../../sim/codes";
import type { HeroLook } from "../../presentation/model/look";

export const sylvanasLook: HeroLook = {
  model: "Units\\Undead\\EvilSylvanas\\EvilSylvanas.mdl", objectId: 0x6d667379,
  portrait: "ReplaceableTextures\\CommandButtons\\BTNBansheeRanger.blp",
  clips: SYLVANAS_CLIPS, fallback: SYLVANAS_FALLBACK_CLIP, defeat: "death", damageClips: SYLVANAS_PAIN_CLIPS,
  cueReadNormals: [AttackStyle.upTilt],
  ultimateBurst: { model: "Abilities\\Spells\\Undead\\DarkSummoning\\DarkSummonTarget.mdx", scale: f32(0.7), lift: f32(0.5), sequence: "birth" },
};
