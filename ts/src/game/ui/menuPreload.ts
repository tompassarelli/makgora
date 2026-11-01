import { PARTICIPANT_SLOTS } from "../input/participants";
import { STAGE_CHOICES } from "../menu/stageCatalog";
import { selectionCardTexture, selectionChipTexture } from "./selectionCards";
import { slotColor } from "./slotColors";
import { STAGE_CARD_COAL, STAGE_CARD_SNOW, STAGE_CHIP_TEXTURE } from "./stageCard";

export function preloadMenuTextures(): string[] {
  const textures: string[] = [selectionCardTexture("Gray"), STAGE_CHIP_TEXTURE, STAGE_CARD_COAL, STAGE_CARD_SNOW];
  for (const slot of PARTICIPANT_SLOTS) textures.push(selectionCardTexture(slotColor(slot).name), selectionChipTexture(slot, true), selectionChipTexture(slot, false));
  for (const stage of STAGE_CHOICES) textures.push(stage.texture);
  return textures;
}
