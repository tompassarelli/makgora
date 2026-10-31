import { f32 } from "wisp/src/sim/f32";
import { ONYXIA_DRAGON_MODEL, PRESTOR_MODEL } from "../../assets/importedModelInfo";
import type { HeroLook } from "../../presentation/model/look";
import { standinLook } from "../standin/look";

export const DRAGON_MODEL_FILE = ONYXIA_DRAGON_MODEL;

export const prestorLook: HeroLook = standinLook({
  model: PRESTOR_MODEL, objectId: 0x6d666f80,
  portrait: "ReplaceableTextures\\CommandButtons\\BTNSorceress.blp",
  clips: {
    stand: { index: 0, seconds: f32(1.334) }, ready: { index: 0, seconds: f32(1.334) }, walk: { index: 6, seconds: 2.0 },
    attack: { index: 2, seconds: f32(1.4) }, attack2: { index: 2, seconds: f32(1.4) }, spell: { index: 3, seconds: f32(2.733) },
    death: { index: 4, seconds: 3.5 }, dissipate: { index: 5, seconds: 2.0 },
  },
});

export const dragonLook: HeroLook = standinLook({
  model: DRAGON_MODEL_FILE, objectId: 0x6d667000,
  portrait: "ReplaceableTextures\\CommandButtons\\BTNBlackDragon.blp",
  clips: {
    stand: { index: 1, seconds: f32(1.4) }, ready: { index: 5, seconds: f32(1.4) }, walk: { index: 6, seconds: 1.0 },
    attack: { index: 0, seconds: f32(1.8) }, attack2: { index: 0, seconds: f32(1.8) }, spell: { index: 4, seconds: 1.5 },
    death: { index: 3, seconds: 1.0 }, dissipate: { index: 3, seconds: 1.0 },
  },
});
