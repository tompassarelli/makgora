import { f32 } from "wisp/src/sim/f32";
import type { HeroLook } from "../../presentation/model/look";
import { standinLook } from "../standin/look";

export const ALCHEMIST_MODEL_FILE = "Units\\Creeps\\HeroGoblinAlchemist\\HeroGoblinAlchemist.mdl";

export const alchemistLook: HeroLook = standinLook({
  model: ALCHEMIST_MODEL_FILE, objectId: 0x6d66676c,
  portrait: "ReplaceableTextures\\CommandButtons\\BTNHeroAlchemist.blp",
  clips: {
    stand: { index: 0, seconds: f32(1.234) }, ready: { index: 2, seconds: f32(1.634) }, walk: { index: 4, seconds: 1.0 },
    attack: { index: 3, seconds: f32(1.333) }, attack2: { index: 5, seconds: f32(1.333) }, spell: { index: 7, seconds: f32(1.333) },
    death: { index: 9, seconds: f32(3.667) }, dissipate: { index: 10, seconds: 2.0 },
  },
});
