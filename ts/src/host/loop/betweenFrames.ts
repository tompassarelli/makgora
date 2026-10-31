import { trampoline } from "wisp/src/platform/dispatch";
import { FRAME_SECONDS } from "../../game/presentation/frameClock";
import { effectMotion } from "../../game/render/effects";
import { createTimer, localElapsed, startTimer, Timer } from "wisp/game/clock";


export const DRAW_EVENT = "shell.draw";

const DRAW_PERIOD = 0.0009765625;

const SMOOTHING_FRAMES = 1.5;

const AVERAGE_WEIGHT = 0.125;

const DRAW_STEP = 0.25;

interface BetweenFrames {

  tick: Timer | undefined;
  drawing: boolean;
  drawsSinceTick: number;

  drawsPerTick: number;
  drawnAlpha: number;
}

declare global {
  var __smashcraftBetweenFrames: BetweenFrames | undefined;
}

function state(): BetweenFrames {
  return (globalThis.__smashcraftBetweenFrames ??= { tick: undefined, drawing: false, drawsSinceTick: 0, drawsPerTick: 0.0, drawnAlpha: -1.0 });
}


export function startFrameClock(tick: Timer): void {
  state().tick = tick;
}


export function drawAtBurstTime(on: boolean): void {
  const frames = state();
  const motion = effectMotion();
  motion.tracking = on;
  if (!on) motion.smoothing = false;
  if (!on || frames.drawing) return;
  frames.drawing = true;
  startTimer(createTimer(), DRAW_PERIOD, true, trampoline(DRAW_EVENT));
}


export function beginPresentedFrame(moving: boolean): void {
  const frames = state();
  const motion = effectMotion();
  if (!motion.tracking) return;
  frames.drawsPerTick += (frames.drawsSinceTick - frames.drawsPerTick) * AVERAGE_WEIGHT;
  frames.drawsSinceTick = 0;
  frames.drawnAlpha = -1.0;
  motion.smoothing = moving && frames.drawsPerTick >= SMOOTHING_FRAMES;
  motion.beginFrame();
}


export function burstAlpha(): number {
  const { tick } = state();
  if (tick === undefined) return -1.0;
  const ticks = localElapsed(tick) / FRAME_SECONDS;
  return ticks - Math.floor(ticks);
}


export function drawnAlpha(): number {
  return state().drawnAlpha;
}


export function drawBetweenFrames(): void {
  const frames = state();
  frames.drawsSinceTick++;
  if (frames.tick === undefined) return;
  const alpha = burstAlpha();
  if (alpha >= frames.drawnAlpha && alpha < frames.drawnAlpha + DRAW_STEP) return;
  frames.drawnAlpha = alpha;
  effectMotion().draw(alpha);
}
