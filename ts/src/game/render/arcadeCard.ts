import { f32 } from "wisp/src/sim/f32";
import { arcadeEnding } from "../arcade/arcadeText";
import { type MatchState, Phase } from "../lobby/lobbyState";
import { fighterPortrait } from "../roster/looks";
import { createBackdrop, createText, gameUi, placeTopLeft } from "../ui/frames";
import { MENU_FONT, PANEL_TEXTURE } from "../ui/hudLayout";
import { destroyFrame, Frame, setFrameEnabled, setFrameFont, setFrameSize, setFrameText, setFrameTextAlignment, setFrameTexture, setFrameVisible, TextAlignment } from "wisp/game/frames";

export class ArcadeCard {
  private readonly card: Frame;
  private readonly portrait: Frame;
  private readonly speaker: Frame;
  private readonly results: Frame;
  private cardText = "";

  constructor() {
    this.card = createBackdrop("ArcadeEndingCard", gameUi(), 893);
    setFrameTexture(this.card, PANEL_TEXTURE, 0, true);
    placeTopLeft(this.card, f32(0.15), f32(0.47));
    setFrameSize(this.card, f32(0.5), f32(0.2));
    setFrameEnabled(this.card, false);
    this.portrait = createBackdrop("ArcadeEndingPortrait", this.card, 894);
    placeTopLeft(this.portrait, f32(0.165), f32(0.455));
    setFrameSize(this.portrait, f32(0.12), f32(0.17));
    setFrameEnabled(this.portrait, false);
    const text = (name: string, context: number, top: number, height: number, size: number): Frame => {
      const frame = createText(name, this.card, context);
      placeTopLeft(frame, f32(0.3), top);
      setFrameSize(frame, f32(0.335), height);
      setFrameFont(frame, MENU_FONT, size, 0);
      setFrameTextAlignment(frame, TextAlignment.top, TextAlignment.left);
      setFrameEnabled(frame, false);
      return frame;
    };
    this.speaker = text("ArcadeEndingSpeaker", 895, f32(0.455), f32(0.022), f32(0.015));
    this.results = text("ArcadeEndingResults", 897, f32(0.43), f32(0.04), f32(0.0095));
    setFrameVisible(this.card, false);
  }

  update(game: Readonly<MatchState>): void {
    const shown = game.phase === Phase.result && game.run.active && game.run.cleared;
    setFrameVisible(this.card, shown);
    if (!shown) return;
    const ending = arcadeEnding(game);
    const text = `${ending.speaker}|${ending.results}`;
    if (text === this.cardText) return;
    this.cardText = text;
    setFrameTexture(this.portrait, fighterPortrait(game.run.fighter, "Card", game.run.player), 0, true);
    setFrameText(this.speaker, `|cffffcc00${ending.speaker}|r`);
    setFrameText(this.results, ending.results);
  }

  destroy(): void {
    destroyFrame(this.card);
  }
}
