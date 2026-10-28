import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import { METER } from "../sim/meter";

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

const PULSE_STEP_UPDATES = 4;
const PULSE_STEPS = 12;
const PULSE_FLOOR = 70;
const PULSE_RISE = 30;

export const ultimatePulse = (tick: number): number => {
  const step = floorMod(floorDiv(tick, PULSE_STEP_UPDATES), PULSE_STEPS);
  return PULSE_FLOOR + PULSE_RISE * (step < PULSE_STEPS / 2 ? step : PULSE_STEPS - step);
};

export interface MeterDisplay {
  readonly exCell: { readonly fill: number; readonly lit: boolean };
  readonly ultimateBar: { readonly fill: number; readonly pulse: number };
}

export const meterDisplay = (ex: number, ultimate: number, exReady: boolean, ultimateReady: boolean, tick: number): MeterDisplay => ({
  exCell: { fill: exFill(ex), lit: exReady },
  ultimateBar: { fill: ultimateFill(ultimate), pulse: ultimateReady ? ultimatePulse(tick) : 0 },
});
