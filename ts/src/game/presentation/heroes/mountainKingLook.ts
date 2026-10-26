import { MOUNTAIN_KING_DIVES, MOUNTAIN_KING_FALLBACK, mountainKingClips } from "./mountainKingClips";
import type { HeroLook, KitNormals } from "../model/look";

export const mountainKingLook = (kit: KitNormals): HeroLook => ({
  model: "units\\human\\HeroMountainKing\\HeroMountainKing.mdl",
  objectId: 0x6d666d6b,
  portrait: "ReplaceableTextures\\CommandButtons\\BTNHeroMountainKing.blp",
  clips: mountainKingClips(kit),
  followUpClips: { upSpecialFollowUp: MOUNTAIN_KING_DIVES, upSpecialFollowUpAir: MOUNTAIN_KING_DIVES },
  fallback: MOUNTAIN_KING_FALLBACK, defeat: "death",
});
