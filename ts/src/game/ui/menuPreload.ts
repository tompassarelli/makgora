import { PARTICIPANT_SLOTS } from "../input/participants";
import { STAGE_CHOICES } from "../menu/stageCatalog";
import { selectionCardTexture, selectionChipTexture } from "./selectionCards";
import { slotColor } from "./slotColors";
import { barArtNames } from "../core/selectBarLayout";
import { MENU_FRAME_PIECES, menuFrameTexture } from "../core/menuFrame";
import { STAGE_CARD_COAL, STAGE_CHIP_TEXTURE } from "./stageCard";

export function preloadMenuTextures(): string[] {
  const textures: string[] = [selectionCardTexture("Gray"), STAGE_CHIP_TEXTURE, STAGE_CARD_COAL];
  for (const slot of PARTICIPANT_SLOTS) textures.push(selectionCardTexture(slotColor(slot).name), selectionChipTexture(slot, true), selectionChipTexture(slot, false));
  for (const stage of STAGE_CHOICES) textures.push(stage.texture);
  for (const name of barArtNames()) textures.push(`war3mapImported\\${name}.tga`);
  for (const piece of MENU_FRAME_PIECES) textures.push(menuFrameTexture(piece));
  return textures;
}
