import { TYRANDE_CLIPS, TYRANDE_FALLBACK_CLIP, TYRANDE_PAIN_CLIPS } from "./clips";
import type { HeroLook } from "../../presentation/model/look";
import { f32 } from "wisp/src/sim/f32";
import { EMPOWERED_SHOTS } from "./specials";
import { TYRANDE_ICON, TYRANDE_MODEL } from "../../assets/importedModelInfo";

export const TRUESHOT_AURA_MODEL = "Abilities\\Spells\\NightElf\\TrueshotAura\\TrueshotAura.mdx";

export const tyrandeLook: HeroLook = {
  model: TYRANDE_MODEL, objectId: 0x6d667479,
  portrait: TYRANDE_ICON,
  clips: TYRANDE_CLIPS, fallback: TYRANDE_FALLBACK_CLIP, defeat: "death", damageClips: TYRANDE_PAIN_CLIPS,
  reflect: { sound: "WoodLightBashMetal", scale: f32(1.3), forward: 45.0, height: 60.0 },
  empoweredAura: { model: TRUESHOT_AURA_MODEL, scale: f32(0.8), floor: f32(0.6), shots: EMPOWERED_SHOTS },
};
