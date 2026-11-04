import { f32 } from "wisp/src/sim/f32";
import { VALEERA_MODEL } from "../../assets/importedModelInfo";
import type { HeroLook } from "../../presentation/model/look";
import { standinLook } from "../standin/look";

export const valeeraLook: HeroLook = standinLook({
  model: VALEERA_MODEL, objectId: 0x6d667661,
  portrait: "ReplaceableTextures\\CommandButtons\\BTNHeroBloodElfPrince.blp",
  clips: {
    stand: { index: 22, seconds: f32(2.333) }, ready: { index: 26, seconds: 1.0 }, walk: { index: 29, seconds: f32(0.534) },
    attack: { index: 27, seconds: f32(1.333) }, attack2: { index: 28, seconds: f32(1.334) }, spell: { index: 1, seconds: f32(1.2) },
    death: { index: 30, seconds: 1.0 }, dissipate: { index: 31, seconds: f32(2.667) },
  },
});
