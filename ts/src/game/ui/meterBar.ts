import { f32 } from "wisp/src/sim/f32";
import { type MeterFeedback, advanceMeterFeedback, meterDisplay, meterDrainLit, meterFeedback } from "../presentation/meterBar";
import type { PlateRect } from "./plateLayout";
import { createBackdrop } from "./frames";
import { PANEL_TEXTURE } from "./hudLayout";

const LINE_WIDTH = f32(0.0006);
const HALO = f32(0.0009);
const EX_FILL = "ReplaceableTextures\\TeamColor\\TeamColor01.blp";
const EX_HALO = "ReplaceableTextures\\TeamColor\\TeamColor01.blp";
const ULTIMATE_FILL = "ReplaceableTextures\\TeamColor\\TeamColor04.blp";
const ULTIMATE_PULSE = "ReplaceableTextures\\TeamColor\\TeamColor05.blp";
const DRAIN = "ReplaceableTextures\\TeamColor\\TeamColor03.blp";
const EX_CHARGING_ALPHA = 150;
const EX_LIT_ALPHA = 255;
const DRAIN_ALPHA = 210;
const FRAME_LEVELS = [22, 23, 24, 22, 23, 24, 25] as const;

export class MeterBar {
  private readonly exHalo: framehandle;
  private readonly exBack: framehandle;
  private readonly exFill: framehandle;
  private readonly ultimateBack: framehandle;
  private readonly ultimateFill: framehandle;
  private readonly ultimatePulse: framehandle;
  private readonly drain: framehandle;
  private readonly feedback: MeterFeedback = meterFeedback();
  private cell = -1.0;
  private cellX = -1.0;
  private cellY = -1.0;
  private barWidth = -1.0;
  private barHeight = -1.0;
  private barX = -1.0;
  private barY = -1.0;
  private visible = false;
  private exLit = false;
  private drainShown = false;
  private shownEx = -1.0;
  private shownUltimate = -1.0;
  private shownPulse = -1;
  private tick = 0;

  constructor(name: string, slot: number, parent: framehandle, context: number) {
    const suffix = `${name}${I2S(slot)}`;
    this.exHalo = createBackdrop(`MeterExHalo${suffix}`, parent, context);
    this.exBack = createBackdrop(`MeterExBack${suffix}`, parent, context + 1);
    this.exFill = createBackdrop(`MeterExFill${suffix}`, parent, context + 2);
    this.ultimateBack = createBackdrop(`MeterUltimateBack${suffix}`, parent, context + 3);
    this.ultimateFill = createBackdrop(`MeterUltimateFill${suffix}`, parent, context + 4);
    this.ultimatePulse = createBackdrop(`MeterUltimatePulse${suffix}`, parent, context + 5);
    this.drain = createBackdrop(`MeterDrain${suffix}`, parent, context + 6);
    BlzFrameSetTexture(this.exHalo, EX_HALO, 0, true);
    BlzFrameSetTexture(this.exBack, PANEL_TEXTURE, 0, true);
    BlzFrameSetTexture(this.exFill, EX_FILL, 0, true);
    BlzFrameSetTexture(this.ultimateBack, PANEL_TEXTURE, 0, true);
    BlzFrameSetTexture(this.ultimateFill, ULTIMATE_FILL, 0, true);
    BlzFrameSetTexture(this.ultimatePulse, ULTIMATE_PULSE, 0, true);
    BlzFrameSetTexture(this.drain, DRAIN, 0, true);
    BlzFrameSetAlpha(this.exFill, EX_CHARGING_ALPHA);
    BlzFrameSetAlpha(this.drain, DRAIN_ALPHA);
    BlzFrameSetPoint(this.exHalo, FRAMEPOINT_CENTER, this.exBack, FRAMEPOINT_CENTER, 0.0, 0.0);
    BlzFrameSetPoint(this.exFill, FRAMEPOINT_BOTTOM, this.exBack, FRAMEPOINT_BOTTOM, 0.0, 0.0);
    BlzFrameSetPoint(this.ultimateFill, FRAMEPOINT_LEFT, this.ultimateBack, FRAMEPOINT_LEFT, 0.0, 0.0);
    BlzFrameSetPoint(this.ultimatePulse, FRAMEPOINT_CENTER, this.ultimateBack, FRAMEPOINT_CENTER, 0.0, 0.0);
    BlzFrameSetPoint(this.drain, FRAMEPOINT_CENTER, this.ultimateBack, FRAMEPOINT_CENTER, 0.0, 0.0);
    this.frames().forEach((frame, index) => {
      BlzFrameSetEnable(frame, false);
      BlzFrameSetVisible(frame, false);
      BlzFrameSetLevel(frame, FRAME_LEVELS[index] ?? 22);
    });
  }

  private frames(): framehandle[] {
    return [this.exHalo, this.exBack, this.exFill, this.ultimateBack, this.ultimateFill, this.ultimatePulse, this.drain];
  }

  place(exCell: PlateRect, ultimateBar: PlateRect): void {
    if (exCell.width !== this.cell) {
      this.cell = exCell.width;
      this.shownEx = -1.0;
      BlzFrameSetSize(this.exBack, exCell.width, exCell.height);
      BlzFrameSetSize(this.exHalo, exCell.width + 2.0 * HALO, exCell.height + 2.0 * HALO);
    }
    if (ultimateBar.width !== this.barWidth || ultimateBar.height !== this.barHeight) {
      this.barWidth = ultimateBar.width;
      this.barHeight = ultimateBar.height;
      this.shownUltimate = -1.0;
      BlzFrameSetSize(this.ultimateBack, ultimateBar.width, ultimateBar.height);
      BlzFrameSetSize(this.ultimatePulse, ultimateBar.width, ultimateBar.height);
      BlzFrameSetSize(this.drain, ultimateBar.width, ultimateBar.height);
    }
    if (exCell.left !== this.cellX || exCell.centerY !== this.cellY) {
      this.cellX = exCell.left;
      this.cellY = exCell.centerY;
      BlzFrameSetAbsPoint(this.exBack, FRAMEPOINT_CENTER, exCell.left + exCell.width / 2.0, exCell.centerY);
    }
    if (ultimateBar.left !== this.barX || ultimateBar.centerY !== this.barY) {
      this.barX = ultimateBar.left;
      this.barY = ultimateBar.centerY;
      BlzFrameSetAbsPoint(this.ultimateBack, FRAMEPOINT_CENTER, ultimateBar.left + ultimateBar.width / 2.0, ultimateBar.centerY);
    }
  }

  update(shown: boolean, ex: number, ultimate: number, exReady: boolean, ultimateReady: boolean, drains: number): void {
    advanceMeterFeedback(this.feedback, drains);
    this.tick++;
    if (shown !== this.visible) {
      this.visible = shown;
      for (const frame of [this.exBack, this.exFill, this.ultimateBack, this.ultimateFill]) BlzFrameSetVisible(frame, shown);
    }
    const drain = shown && meterDrainLit(this.feedback);
    if (drain !== this.drainShown) {
      this.drainShown = drain;
      BlzFrameSetVisible(this.drain, drain);
    }
    const display = meterDisplay(ex, ultimate, exReady, ultimateReady, this.tick);
    const lit = shown && display.exCell.lit;
    if (lit !== this.exLit) {
      this.exLit = lit;
      BlzFrameSetVisible(this.exHalo, lit);
      BlzFrameSetAlpha(this.exFill, lit ? EX_LIT_ALPHA : EX_CHARGING_ALPHA);
    }
    const pulse = shown ? display.ultimateBar.pulse : 0;
    if (pulse !== this.shownPulse) {
      this.shownPulse = pulse;
      BlzFrameSetVisible(this.ultimatePulse, pulse > 0);
      if (pulse > 0) BlzFrameSetAlpha(this.ultimatePulse, pulse);
    }
    if (!shown) return;
    if (display.exCell.fill !== this.shownEx) {
      this.shownEx = display.exCell.fill;
      BlzFrameSetSize(this.exFill, this.cell, Math.max(LINE_WIDTH, this.cell * display.exCell.fill));
    }
    if (display.ultimateBar.fill === this.shownUltimate) return;
    this.shownUltimate = display.ultimateBar.fill;
    BlzFrameSetSize(this.ultimateFill, Math.max(LINE_WIDTH, this.barWidth * display.ultimateBar.fill), this.barHeight);
  }

  destroy(): void {
    for (const frame of this.frames()) BlzDestroyFrame(frame);
  }
}
