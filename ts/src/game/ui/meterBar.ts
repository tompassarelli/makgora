import { f32 } from "wisp/src/sim/f32";
import { type MeterFeedback, advanceMeterFeedback, meterDisplay, meterDrainLit, meterFeedback } from "../presentation/meterBar";
import type { PlateRect } from "./plateLayout";
import { createBackdrop } from "./frames";
import { PANEL_TEXTURE } from "./hudLayout";
import { destroyFrame, Frame, FramePoint, setFrameAbsPoint, setFrameAlpha, setFrameEnabled, setFrameLevel, setFramePoint, setFrameSize, setFrameTexture, setFrameVisible } from "wisp/game/frames";
import { formatInt } from "wisp/game/text";

const LINE_WIDTH = f32(0.0006);
const ULTIMATE_FILL = "ReplaceableTextures\\TeamColor\\TeamColor04.blp";
const ULTIMATE_PULSE = "ReplaceableTextures\\TeamColor\\TeamColor05.blp";
const DRAIN = "ReplaceableTextures\\TeamColor\\TeamColor03.blp";
const CHARGE_FILL = "ReplaceableTextures\\TeamColor\\TeamColor02.blp";
export const METER_TEXTURES = [ULTIMATE_FILL, ULTIMATE_PULSE, DRAIN, CHARGE_FILL] as const;
const CHARGE_GAP = f32(0.3);
const CHARGE_HEIGHT = f32(0.6);
const CHARGE_PARTIAL_ALPHA = 190;
const DRAIN_ALPHA = 210;
const FRAME_LEVELS = [22, 23, 24, 25, 22, 23] as const;

export class MeterBar {
  private readonly ultimateBack: Frame;
  private readonly ultimateFill: Frame;
  private readonly ultimatePulse: Frame;
  private readonly drain: Frame;
  private readonly chargeBack: Frame;
  private readonly chargeFill: Frame;
  private chargeShown = false;
  private shownCharge = -1.0;
  private readonly feedback: MeterFeedback = meterFeedback();
  private barWidth = -1.0;
  private barHeight = -1.0;
  private barX = -1.0;
  private barY = -1.0;
  private visible = false;
  private drainShown = false;
  private shownUltimate = -1.0;
  private shownPulse = -1;
  private tick = 0;

  constructor(name: string, slot: number, parent: Frame, context: number) {
    const suffix = `${name}${formatInt(slot)}`;
    this.ultimateBack = createBackdrop(`MeterUltimateBack${suffix}`, parent, context);
    this.ultimateFill = createBackdrop(`MeterUltimateFill${suffix}`, parent, context + 1);
    this.ultimatePulse = createBackdrop(`MeterUltimatePulse${suffix}`, parent, context + 2);
    this.drain = createBackdrop(`MeterDrain${suffix}`, parent, context + 3);
    this.chargeBack = createBackdrop(`MeterChargeBack${suffix}`, parent, context + 4);
    this.chargeFill = createBackdrop(`MeterChargeFill${suffix}`, parent, context + 5);
    setFrameTexture(this.chargeBack, PANEL_TEXTURE, 0, true);
    setFrameTexture(this.chargeFill, CHARGE_FILL, 0, true);
    setFramePoint(this.chargeFill, FramePoint.left, this.chargeBack, FramePoint.left, 0.0, 0.0);
    setFrameTexture(this.ultimateBack, PANEL_TEXTURE, 0, true);
    setFrameTexture(this.ultimateFill, ULTIMATE_FILL, 0, true);
    setFrameTexture(this.ultimatePulse, ULTIMATE_PULSE, 0, true);
    setFrameTexture(this.drain, DRAIN, 0, true);
    setFrameAlpha(this.drain, DRAIN_ALPHA);
    setFramePoint(this.ultimateFill, FramePoint.left, this.ultimateBack, FramePoint.left, 0.0, 0.0);
    setFramePoint(this.ultimatePulse, FramePoint.center, this.ultimateBack, FramePoint.center, 0.0, 0.0);
    setFramePoint(this.drain, FramePoint.center, this.ultimateBack, FramePoint.center, 0.0, 0.0);
    this.frames().forEach((frame, index) => {
      setFrameEnabled(frame, false);
      setFrameVisible(frame, false);
      setFrameLevel(frame, FRAME_LEVELS[index] ?? 22);
    });
  }

  private frames(): Frame[] {
    return [this.ultimateBack, this.ultimateFill, this.ultimatePulse, this.drain, this.chargeBack, this.chargeFill];
  }

  place(ultimateBar: PlateRect): void {
    if (ultimateBar.width !== this.barWidth || ultimateBar.height !== this.barHeight) {
      this.barWidth = ultimateBar.width;
      this.barHeight = ultimateBar.height;
      this.shownUltimate = -1.0;
      setFrameSize(this.ultimateBack, ultimateBar.width, ultimateBar.height);
      setFrameSize(this.ultimatePulse, ultimateBar.width, ultimateBar.height);
      setFrameSize(this.drain, ultimateBar.width, ultimateBar.height);
      setFrameSize(this.chargeBack, ultimateBar.width, f32(ultimateBar.height * CHARGE_HEIGHT));
      this.shownCharge = -1.0;
    }
    if (ultimateBar.left !== this.barX || ultimateBar.centerY !== this.barY) {
      this.barX = ultimateBar.left;
      this.barY = ultimateBar.centerY;
      setFrameAbsPoint(this.ultimateBack, FramePoint.center, ultimateBar.left + ultimateBar.width / 2.0, ultimateBar.centerY);
      const below = f32(ultimateBar.height * f32(f32(0.5 + CHARGE_GAP) + f32(CHARGE_HEIGHT / 2.0)));
      setFrameAbsPoint(this.chargeBack, FramePoint.center, ultimateBar.left + ultimateBar.width / 2.0, ultimateBar.centerY - below);
    }
  }

  private updateCharge(fill: number): void {
    const shown = fill >= 0.0;
    if (shown !== this.chargeShown) {
      this.chargeShown = shown;
      setFrameVisible(this.chargeBack, shown);
      setFrameVisible(this.chargeFill, shown);
      this.shownCharge = -1.0;
    }
    if (!shown || fill === this.shownCharge) return;
    this.shownCharge = fill;
    setFrameSize(this.chargeFill, Math.max(LINE_WIDTH, this.barWidth * fill), f32(this.barHeight * CHARGE_HEIGHT));
    setFrameAlpha(this.chargeFill, fill >= 1.0 ? 255 : CHARGE_PARTIAL_ALPHA);
  }

  update(shown: boolean, ultimate: number, ultimateReady: boolean, drains: number, charge = -1.0): void {
    this.updateCharge(shown ? charge : -1.0);
    advanceMeterFeedback(this.feedback, drains);
    this.tick++;
    if (shown !== this.visible) {
      this.visible = shown;
      for (const frame of [this.ultimateBack, this.ultimateFill]) setFrameVisible(frame, shown);
    }
    const drain = shown && meterDrainLit(this.feedback);
    if (drain !== this.drainShown) {
      this.drainShown = drain;
      setFrameVisible(this.drain, drain);
    }
    const display = meterDisplay(ultimate, ultimateReady, this.tick);
    const pulse = shown ? display.ultimateBar.pulse : 0;
    if (pulse !== this.shownPulse) {
      this.shownPulse = pulse;
      setFrameVisible(this.ultimatePulse, pulse > 0);
      if (pulse > 0) setFrameAlpha(this.ultimatePulse, pulse);
    }
    if (!shown) return;
    if (display.ultimateBar.fill === this.shownUltimate) return;
    this.shownUltimate = display.ultimateBar.fill;
    setFrameSize(this.ultimateFill, Math.max(LINE_WIDTH, this.barWidth * display.ultimateBar.fill), this.barHeight);
  }

  destroy(): void {
    for (const frame of this.frames()) destroyFrame(frame);
  }
}
