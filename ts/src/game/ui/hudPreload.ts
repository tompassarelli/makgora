import { PARTICIPANT_SLOTS } from "../input/participants";
import { PANEL_TEXTURE, markerArrowTexture } from "./hudLayout";
import { STOCK_SHADOW_TEXTURE, namePlateTexture, pingSignalTexture } from "./raceFrame";
import { METER_TEXTURES } from "./meterBar";
import { PREVIEW_ROW_LIT_TEXTURE, PREVIEW_RULE_TEXTURE } from "./inputPreview";
import { slotColor } from "./slotColors";

/** The interface images any match shows: each slot's colour and marker arrow, the nameplate, the stock shadow, ping bars and controls preview's row light and rules, the panel backdrop and the meter fills. */
export function preloadHudTextures(): string[] {
  const textures: string[] = [PANEL_TEXTURE, ...METER_TEXTURES, STOCK_SHADOW_TEXTURE, PREVIEW_ROW_LIT_TEXTURE, PREVIEW_RULE_TEXTURE];
  for (let bars = 1; bars <= 4; bars++) textures.push(pingSignalTexture(bars));
  textures.push(namePlateTexture(false), namePlateTexture(true));
  for (const slot of PARTICIPANT_SLOTS) textures.push(slotColor(slot).texture, markerArrowTexture(slot));
  return textures;
}
