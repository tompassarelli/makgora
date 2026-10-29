import { f32 } from "wisp/src/sim/f32";
import type { HeroLook } from "../../presentation/model/look";
import { standinLook } from "../standin/look";

export const FIRELORD_MODEL_FILE = "Units\\Creeps\\HeroFlameLord\\HeroFlameLord.mdl";

export const firelordLook: HeroLook = standinLook({
  model: FIRELORD_MODEL_FILE, objectId: 0x6d66666c,
  portrait: "ReplaceableTextures\\CommandButtons\\BTNHeroAvatarOfFlame.blp",
  clips: {
    stand: { index: 0, seconds: f32(2.167) }, ready: { index: 8, seconds: f32(1.167) }, walk: { index: 2, seconds: 1.0 },
    attack: { index: 3, seconds: f32(1.167) }, attack2: { index: 4, seconds: f32(1.167) }, spell: { index: 6, seconds: f32(1.167) },
    death: { index: 9, seconds: f32(2.667) }, dissipate: { index: 10, seconds: 2.0 },
  },
});
