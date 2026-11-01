import { f32 } from "wisp/src/sim/f32";
import { RANDOM_STAGE, stageInfo } from "../menu/stageCatalog";
import { createBackdrop, createText, placeTopLeft } from "./frames";
import { MENU_FONT } from "./hudLayout";
import { Frame, setFrameAlpha, setFrameEnabled, setFrameFont, setFrameSize, setFrameText, setFrameTextAlignment, setFrameTexture, setFrameVisible, TextAlignment } from "wisp/game/frames";

export const STAGE_CARD_COAL = "ReplaceableTextures\\TeamColor\\TeamColor20.blp";
export const STAGE_CHIP_TEXTURE = "war3mapImported\\StageChip.tga";

export interface PictureBox {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** A stage picture is a square: a banner card stretches it over its whole box, a preview draws it at its true shape, as large as the box allows and centred. */
export function stagePictureBox(left: number, top: number, width: number, height: number, banner: boolean): PictureBox {
  if (banner) return { left, top, width, height };
  const side = Math.min(width, height);
  return { left: f32(left + f32(width - side) / 2), top: f32(top - f32(height - side) / 2), width: side, height: side };
}

export class StageCard {
  private readonly panel: Frame;
  private readonly picture: Frame;
  private readonly name: Frame | undefined;

  constructor(parent: Frame, id: string, left: number, top: number, width: number, height: number, banner: boolean) {
    const box = stagePictureBox(left, top, width, height, banner);
    const panel = createBackdrop(`${id}Panel`, parent, 0);
    this.panel = panel;
    setFrameTexture(panel, STAGE_CARD_COAL, 0, true);
    placeTopLeft(panel, box.left, box.top);
    setFrameSize(panel, box.width, box.height);
    setFrameEnabled(panel, false);
    this.picture = createBackdrop(`${id}Picture`, parent, 0);
    placeTopLeft(this.picture, box.left, box.top);
    setFrameSize(this.picture, box.width, box.height);
    setFrameEnabled(this.picture, false);
    if (banner) {
      const strip = createBackdrop(`${id}Banner`, parent, 0);
      setFrameTexture(strip, STAGE_CARD_COAL, 0, true);
      setFrameAlpha(strip, 210);
      placeTopLeft(strip, left, f32(top - height * f32(0.78)));
      setFrameSize(strip, width, f32(height * f32(0.22)));
      setFrameEnabled(strip, false);
      const name = createText(`${id}Name`, parent, 0);
      placeTopLeft(name, f32(left + height * f32(0.06)), f32(top - height * f32(0.78)));
      setFrameSize(name, f32(width - height * f32(0.08)), f32(height * f32(0.22)));
      setFrameFont(name, MENU_FONT, f32(height * f32(0.13)), 0);
      setFrameTextAlignment(name, TextAlignment.middle, TextAlignment.left);
      setFrameEnabled(name, false);
      this.name = name;
    }
  }

  show(choice: number): void {
    const stage = stageInfo(choice);
    setFrameTexture(this.picture, stage.texture, 0, true);
    setFrameVisible(this.panel, choice !== RANDOM_STAGE);
    if (this.name !== undefined) setFrameText(this.name, stage.name);
  }
}
