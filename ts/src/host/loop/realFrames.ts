import { f32 } from "wisp/src/sim/f32";
import { CATCH_UP_FRAMES } from "../../game/session/playback";
declare const os: { readonly clock?: (this: void) => number } | undefined;

const FRAMES_PER_SECOND = 60.0;
// os.clock is binary32 in Warcraft: from 65536 s it steps 7.8 ms, too coarse to pace frames by.
const COARSE_CLOCK_SECONDS = 65536.0;

export interface RealFrames {
  anchored: boolean;
  clocked: boolean;
  anchorFrame: number;
  anchorSeconds: number;
  anchorCallbacks: number;
  due: number;
}

export const realFrames = (): RealFrames => ({ anchored: false, clocked: false, anchorFrame: 0, anchorSeconds: 0.0, anchorCallbacks: 0, due: 0 });

export function beginRealFrames(real: RealFrames): void {
  real.anchored = false;
  real.due = 0;
}

export function pauseRealFrames(real: RealFrames): void {
  real.anchored = false;
}

export function realSeconds(): number | undefined {
  if (typeof os !== "object" || os === null || typeof os.clock !== "function") return undefined;
  return os.clock();
}

function anchor(real: RealFrames, frame: number, seconds: number, callbacks: number, clocked: boolean): void {
  real.anchored = true;
  real.clocked = clocked;
  real.anchorFrame = frame;
  real.anchorSeconds = seconds;
  real.anchorCallbacks = callbacks;
}

export function realFramesDue(real: RealFrames, callbacks: number, ran: number, seconds: number | undefined): number {
  const clocked = seconds !== undefined && seconds < COARSE_CLOCK_SECONDS;
  if (!real.anchored || clocked !== real.clocked) anchor(real, Math.max(real.due, callbacks), seconds ?? 0.0, callbacks, clocked);
  if (seconds === undefined || !clocked) {
    real.due = real.anchorFrame + callbacks - real.anchorCallbacks;
    return real.due;
  }
  real.due = real.anchorFrame + Math.floor(f32(f32(seconds - real.anchorSeconds) * FRAMES_PER_SECOND));
  if (real.due - ran > CATCH_UP_FRAMES) {
    anchor(real, ran + CATCH_UP_FRAMES, seconds, callbacks, true);
    real.due = real.anchorFrame;
  }
  return real.due;
}
