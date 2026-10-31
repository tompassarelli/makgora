import * as impacts from "../assets/impactAssetInfo";
import { AVATAR_MODEL, ITEM_MODELS } from "../presentation/itemLook";

/** The models any match can draw whoever fights on whichever stage: the impact sparks and the item looks. */
export function preloadMatchModels(): string[] {
  return [...new Set<string>([...Object.values(impacts), ...Object.values(ITEM_MODELS), AVATAR_MODEL])];
}
