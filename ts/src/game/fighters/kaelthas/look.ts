import { f32 } from "wisp/src/sim/f32";
import { KAELTHAS_CLIPS, KAELTHAS_DAMAGE_CLIPS, KAELTHAS_FALLBACK, KAELTHAS_MODEL_FILE } from "./clips";
import { AttackStyle } from "../../sim/codes";
import type { HeroLook } from "../../presentation/model/look";

export const BANISH_SWIRL_MODEL = "Abilities\\Spells\\Human\\Banish\\BanishTarget.mdx";
export const BANISH_SWIRL_COUNT = 6;
export const BANISH_SWIRL_SCALE = f32(0.4);
export const BANISH_SWIRL_TINT = [150, 255, 70] as const;

export const kaelthasLook: HeroLook = {
  model: KAELTHAS_MODEL_FILE, objectId: 0x6d666b74,
  portrait: "ReplaceableTextures\\CommandButtons\\BTNHeroBloodElfPrince.blp",
  clips: KAELTHAS_CLIPS, damageClips: KAELTHAS_DAMAGE_CLIPS, fallback: KAELTHAS_FALLBACK, defeat: "death",
  cueReadNormals: [AttackStyle.dashAttack],
  orbit: { model: "units\\human\\HeroBloodElf\\BloodElfBall.mdx", count: 3, radius: 48.0, z: 78.0, periodFrames: 96, scale: f32(1.4) },
  flight: {
    flames: "Doodads\\Cinematic\\TownBurningFireEmitter\\TownBurningFireEmitter.mdx", flamesScale: f32(0.7), flamesZ: 40.0,
    egg: "units\\human\\Phoenix\\PhoenixEgg.mdx", eggScale: f32(1.3),
  },
};
