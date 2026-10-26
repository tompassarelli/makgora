import { LICH_KING_ICON, LICH_KING_MODEL } from "../../assets/importedModelInfo";
import { LICH_KING_CLIPS, LICH_KING_FALLBACK } from "./clips";
import type { HeroLook } from "../../presentation/model/look";

export const lichKingLook: HeroLook = {
  model: LICH_KING_MODEL,
  objectId: 0x6d666c6b,
  portrait: LICH_KING_ICON,
  clips: LICH_KING_CLIPS,
  fallback: LICH_KING_FALLBACK, defeat: "death",
};
