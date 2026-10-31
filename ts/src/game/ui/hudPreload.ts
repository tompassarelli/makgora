import { PARTICIPANT_SLOTS } from "../input/participants";
import { PANEL_TEXTURE, hudPlateTexture, markerArrowTexture } from "./hudLayout";
import { METER_TEXTURES } from "./meterBar";
import { slotColor } from "./slotColors";

/** The interface images any match shows: each slot's colour, HUD plate on either side and marker arrow, the panel backdrop and the meter fills. */
export function preloadHudTextures(): string[] {
  const textures: string[] = [PANEL_TEXTURE, ...METER_TEXTURES];
  for (const slot of PARTICIPANT_SLOTS) textures.push(slotColor(slot).texture, hudPlateTexture(slot, false), hudPlateTexture(slot, true), markerArrowTexture(slot));
  return textures;
}
