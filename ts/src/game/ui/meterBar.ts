import { f32 } from "wisp/src/sim/f32";
import { EX_CELL_SHARE, type MeterFeedback, advanceMeterFeedback, exFill, meterDrainLit, meterFeedback, ultimateFill } from "../presentation/meterBar";
import { createBackdrop } from "./frames";
import { PANEL_TEXTURE } from "./hudLayout";

const LINE_WIDTH = f32(0.0006);
const GAP = f32(0.0012);
const EX_FILL = "ReplaceableTextures\\TeamColor\\TeamColor01.blp";
const EX_GLOW = "ReplaceableTextures\\TeamColor\\TeamColor02.blp";
const ULTIMATE_FILL = "ReplaceableTextures\\TeamColor\\TeamColor05.blp";
const ULTIMATE_GLOW = "ReplaceableTextures\\TeamColor\\TeamColor04.blp";
const DRAIN = "ReplaceableTextures\\TeamColor\\TeamColor03.blp";

export class MeterBar {
  private readonly exBack: framehandle;
  private readonly exFill: framehandle;
  private readonly exGlow: framehandle;
  private readonly ultimateBack: framehandle;
  private readonly ultimateFill: framehandle;
  private readonly ultimateGlow: framehandle;
  private readonly drain: framehandle;
  private readonly feedback: MeterFeedback = meterFeedback();
  private exWidth = -1.0;
  private ultimateWidth = -1.0;
  private left = -1.0;
  private centerY = -1.0;
  private visible = false;
  private exGlowShown = false;
  private ultimateGlowShown = false;
  private drainShown = false;
  private shownEx = -1.0;
  private shownUltimate = -1.0;

  constructor(name: string, slot: number, parent: framehandle, context: number, private readonly height: number) {
    const suffix = `${name}${I2S(slot)}`;
    this.exBack = createBackdrop(`MeterExBack${suffix}`, parent, context);
    this.exFill = createBackdrop(`MeterExFill${suffix}`, parent, context + 1);
    this.exGlow = createBackdrop(`MeterExGlow${suffix}`, parent, context + 2);
    this.ultimateBack = createBackdrop(`MeterUltimateBack${suffix}`, parent, context + 3);
    this.ultimateFill = createBackdrop(`MeterUltimateFill${suffix}`, parent, context + 4);
    this.ultimateGlow = createBackdrop(`MeterUltimateGlow${suffix}`, parent, context + 5);
    this.drain = createBackdrop(`MeterDrain${suffix}`, parent, context + 6);
    BlzFrameSetTexture(this.exBack, PANEL_TEXTURE, 0, true);
    BlzFrameSetTexture(this.ultimateBack, PANEL_TEXTURE, 0, true);
    BlzFrameSetTexture(this.exFill, EX_FILL, 0, true);
    BlzFrameSetTexture(this.exGlow, EX_GLOW, 0, true);
    BlzFrameSetTexture(this.ultimateFill, ULTIMATE_FILL, 0, true);
    BlzFrameSetTexture(this.ultimateGlow, ULTIMATE_GLOW, 0, true);
    BlzFrameSetTexture(this.drain, DRAIN, 0, true);
    BlzFrameSetAlpha(this.exGlow, 170);
    BlzFrameSetAlpha(this.ultimateGlow, 150);
    BlzFrameSetAlpha(this.drain, 210);
    BlzFrameSetPoint(this.exFill, FRAMEPOINT_LEFT, this.exBack, FRAMEPOINT_LEFT, 0.0, 0.0);
    BlzFrameSetPoint(this.exGlow, FRAMEPOINT_CENTER, this.exBack, FRAMEPOINT_CENTER, 0.0, 0.0);
    BlzFrameSetPoint(this.ultimateFill, FRAMEPOINT_LEFT, this.ultimateBack, FRAMEPOINT_LEFT, 0.0, 0.0);
    BlzFrameSetPoint(this.ultimateGlow, FRAMEPOINT_CENTER, this.ultimateBack, FRAMEPOINT_CENTER, 0.0, 0.0);
    BlzFrameSetPoint(this.drain, FRAMEPOINT_CENTER, this.ultimateBack, FRAMEPOINT_CENTER, 0.0, 0.0);
    this.frames().forEach((frame, index) => {
      BlzFrameSetEnable(frame, false);
      BlzFrameSetVisible(frame, false);
      BlzFrameSetLevel(frame, 22 + (index === 0 || index === 3 ? 0 : index === 6 ? 2 : 1));
    });
  }

  private frames(): framehandle[] {
    return [this.exBack, this.exFill, this.exGlow, this.ultimateBack, this.ultimateFill, this.ultimateGlow, this.drain];
  }

  place(left: number, centerY: number, width: number): void {
    const exWidth = f32(width * EX_CELL_SHARE);
    const ultimateWidth = f32(width - exWidth - GAP);
    if (exWidth !== this.exWidth || ultimateWidth !== this.ultimateWidth) {
      this.exWidth = exWidth;
      this.ultimateWidth = ultimateWidth;
      this.shownEx = -1.0;
      this.shownUltimate = -1.0;
      BlzFrameSetSize(this.exBack, exWidth, this.height);
      BlzFrameSetSize(this.exGlow, exWidth, this.height);
      BlzFrameSetSize(this.ultimateBack, ultimateWidth, this.height);
      BlzFrameSetSize(this.ultimateGlow, ultimateWidth, this.height);
      BlzFrameSetSize(this.drain, ultimateWidth, this.height);
      this.left = -1.0;
    }
    if (left === this.left && centerY === this.centerY) return;
    this.left = left;
    this.centerY = centerY;
    BlzFrameSetAbsPoint(this.exBack, FRAMEPOINT_CENTER, left + exWidth / 2.0, centerY);
    BlzFrameSetAbsPoint(this.ultimateBack, FRAMEPOINT_CENTER, left + exWidth + GAP + ultimateWidth / 2.0, centerY);
  }

  update(shown: boolean, ex: number, ultimate: number, exReady: boolean, ultimateReady: boolean, drains: number): void {
    advanceMeterFeedback(this.feedback, drains);
    if (shown !== this.visible) {
      this.visible = shown;
      for (const frame of [this.exBack, this.exFill, this.ultimateBack, this.ultimateFill]) BlzFrameSetVisible(frame, shown);
    }
    const drain = shown && meterDrainLit(this.feedback);
    if (drain !== this.drainShown) {
      this.drainShown = drain;
      BlzFrameSetVisible(this.drain, drain);
    }
    const exGlow = shown && exReady;
    if (exGlow !== this.exGlowShown) {
      this.exGlowShown = exGlow;
      BlzFrameSetVisible(this.exGlow, exGlow);
    }
    const ultimateGlow = shown && ultimateReady;
    if (ultimateGlow !== this.ultimateGlowShown) {
      this.ultimateGlowShown = ultimateGlow;
      BlzFrameSetVisible(this.ultimateGlow, ultimateGlow);
    }
    if (!shown) return;
    const exShare = exFill(ex);
    if (exShare !== this.shownEx) {
      this.shownEx = exShare;
      BlzFrameSetSize(this.exFill, Math.max(LINE_WIDTH, this.exWidth * exShare), this.height);
    }
    const ultimateShare = ultimateFill(ultimate);
    if (ultimateShare === this.shownUltimate) return;
    this.shownUltimate = ultimateShare;
    BlzFrameSetSize(this.ultimateFill, Math.max(LINE_WIDTH, this.ultimateWidth * ultimateShare), this.height);
  }

  destroy(): void {
    for (const frame of this.frames()) BlzDestroyFrame(frame);
  }
}
