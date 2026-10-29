import { f32 } from "wisp/src/sim/f32";
import type { HeroLook } from "../../presentation/model/look";
import { standinLook } from "../standin/look";

export const AKAMA_MODEL_FILE = "units\\other\\DranaiAkama\\DranaiAkama.mdl";

export const akamaLook: HeroLook = standinLook({
  model: AKAMA_MODEL_FILE, objectId: 0x6d66616b,
  portrait: "ReplaceableTextures\\CommandButtons\\BTNDranaiAkama.blp",
  clips: {
    stand: { index: 0, seconds: 1.5 }, ready: { index: 9, seconds: f32(2.167) }, walk: { index: 2, seconds: f32(0.7) },
    attack: { index: 5, seconds: 1.0 }, attack2: { index: 6, seconds: 1.0 }, spell: { index: 7, seconds: 1.0 },
    death: { index: 3, seconds: 2.0 }, dissipate: { index: 10, seconds: 2.0 },
  },
});
