import { f32 } from "wisp/src/sim/f32";
import { METER } from "../sim/meter";

export const EX_CELL_SHARE = f32(0.22);

export const METER_DRAIN_UPDATES = 20;

export interface MeterFeedback {
  seenDrains: number;
  drainLeft: number;
  started: boolean;
}

export const meterFeedback = (): MeterFeedback => ({ seenDrains: 0, drainLeft: 0, started: false });

export function advanceMeterFeedback(feedback: MeterFeedback, drains: number): void {
  if (!feedback.started) {
    feedback.started = true;
    feedback.seenDrains = drains;
    return;
  }
  if (drains > feedback.seenDrains) feedback.drainLeft = METER_DRAIN_UPDATES;
  else if (feedback.drainLeft > 0) feedback.drainLeft--;
  feedback.seenDrains = drains;
}

export const meterDrainLit = (feedback: Readonly<MeterFeedback>): boolean => feedback.drainLeft > 0;

export const exFill = (ex: number): number => Math.min(1.0, Math.max(0.0, ex / METER.exFrames));

export const ultimateFill = (ultimate: number): number => Math.min(1.0, Math.max(0.0, ultimate / METER.ultimateFrames));
