


import { f32 } from "wisp/src/sim/f32";
import { at } from "wisp/src/runtime/lookup";
import { RANDOM_STAGE, stageInfo } from "../menu/stageCatalog";
import { STAGE_SILHOUETTES, SILHOUETTE_PIECES } from "../../generated/stages/stageSilhouettes";
import { createBackdrop, createText, placeTopLeft } from "./frames";
import { MENU_FONT } from "./hudLayout";
import { setFrameAlpha, setFrameEnabled, setFrameFont, setFrameSize, setFrameText, setFrameTextAlignment, setFrameTexture, setFrameVisible } from "wisp/game/frames";
import { formatInt } from "wisp/game/text";

export const STAGE_CARD_COAL = "ReplaceableTextures\\TeamColor\\TeamColor20.blp";
export const STAGE_CARD_SNOW = "ReplaceableTextures\\TeamColor\\TeamColor21.blp";
export const STAGE_CHIP_TEXTURE = "war3mapImported\\StageChip.tga";

export class StageCard {
  private readonly panel: framehandle;
  private readonly picture: framehandle;
  private readonly pieces: framehandle[] = [];
  private readonly name: framehandle | undefined;
  private readonly boxLeft: number;
  private readonly boxTop: number;
  private readonly boxWidth: number;

  constructor(parent: framehandle, id: string, left: number, top: number, width: number, height: number, private readonly banner: boolean) {
    const panel = createBackdrop(`${id}Panel`, parent, 0);
    this.panel = panel;
    setFrameTexture(panel, STAGE_CARD_COAL, 0, true);
    placeTopLeft(panel, left, top);
    setFrameSize(panel, width, height);
    setFrameEnabled(panel, false);
    this.picture = createBackdrop(`${id}Picture`, parent, 0);
    placeTopLeft(this.picture, left, top);
    setFrameSize(this.picture, banner ? width : height, height);
    setFrameEnabled(this.picture, false);
    const side = width - height;
    this.boxWidth = f32(side * f32(0.84));
    this.boxLeft = f32(left + height + side * f32(0.08));
    this.boxTop = f32(top - height * f32(0.14));
    for (let index = 0; index < SILHOUETTE_PIECES; index++) {
      const piece = createBackdrop(`${id}Piece${formatInt(index)}`, parent, index);
      setFrameTexture(piece, STAGE_CARD_SNOW, 0, true);
      setFrameAlpha(piece, 230);
      setFrameEnabled(piece, false);
      this.pieces.push(piece);
    }
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
      setFrameTextAlignment(name, TEXT_JUSTIFY_MIDDLE, TEXT_JUSTIFY_LEFT);
      setFrameEnabled(name, false);
      this.name = name;
    }
  }

  show(choice: number): void {
    const stage = stageInfo(choice);
    setFrameTexture(this.picture, stage.texture, 0, true);
    setFrameVisible(this.panel, choice !== RANDOM_STAGE);
    if (this.name !== undefined) setFrameText(this.name, stage.name);
    const pieces = this.banner ? [] : STAGE_SILHOUETTES[choice] ?? [];
    for (let index = 0; index < SILHOUETTE_PIECES; index++) {
      const frame = at(this.pieces, index);
      const piece = pieces[index];
      setFrameVisible(frame, piece !== undefined);
      if (piece === undefined) continue;
      placeTopLeft(frame, f32(this.boxLeft + piece[0] * this.boxWidth), f32(this.boxTop - piece[1] * this.boxWidth));
      setFrameSize(frame, f32(piece[2] * this.boxWidth), f32(piece[3] * this.boxWidth));
    }
  }
}
