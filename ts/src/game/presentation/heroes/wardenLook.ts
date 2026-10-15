import { wardenClipTable } from "./wardenClipTable";
import { WARDEN_MODEL_FILE, wardenClips } from "./wardenClips";
import type { HeroLook, KitNormals } from "../model/look";

export const wardenLook = (kit: KitNormals): HeroLook => ({
  model: WARDEN_MODEL_FILE,
  objectId: 0x6d667764,
  portrait: "ReplaceableTextures\\CommandButtons\\BTNHeroWarden.blp",
  clips: wardenClipTable(kit),
  fallback: wardenClips(kit).idle,
});
