import { f32 } from "wisp/src/sim/f32";
import { WHITEMANE_MODEL } from "../../assets/importedModelInfo";
import type { HeroLook } from "../../presentation/model/look";
import { standinLook } from "../standin/look";

export const whitemaneLook: HeroLook = standinLook({
  model: WHITEMANE_MODEL, objectId: 0x6d66776d,
  portrait: "ReplaceableTextures\\CommandButtons\\BTNPriest.blp",
  clips: {
    stand: { index: 0, seconds: f32(1.334) }, ready: { index: 8, seconds: f32(1.334) }, walk: { index: 6, seconds: 2.0 },
    attack: { index: 9, seconds: f32(1.34) }, attack2: { index: 10, seconds: f32(1.34) }, spell: { index: 4, seconds: f32(2.733) },
    death: { index: 7, seconds: 3.5 }, dissipate: { index: 5, seconds: 2.0 },
  },
});
