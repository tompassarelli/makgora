import type { AuthoredSpecial, FrameWindow } from "../sim/specials/schema";

export const ACTIVE_CUE_FRAMES = 18;

export interface CueWindows {
  readonly startup: FrameWindow;
  readonly active: FrameWindow;
}

type Span = { first: number; last: number };

const widen = (window: Span, first: number, last: number): void => {
  window.first = Math.min(window.first, first);
  window.last = Math.max(window.last, last);
};

function widenByHits(active: Span, move: Readonly<AuthoredSpecial>): void {
  for (const region of move.regions ?? []) widen(active, region.firstFrame + 1, region.lastFrame + 1);
  for (const projectile of move.projectiles ?? []) widen(active, projectile.spawnFrame, projectile.spawnFrame);
  for (const segment of move.motion ?? []) {
    if (segment.velocityX !== 0 || segment.velocityZ !== 0 || (segment.aimedSpeed ?? 0) !== 0
      || (segment.driftSpeed ?? 0) !== 0 || segment.relocate !== undefined) widen(active, segment.first, segment.last);
  }
}

function widenByEvents(active: Span, move: Readonly<AuthoredSpecial>): void {
  if (move.placement !== undefined) widen(active, move.placement.frame, move.placement.frame);
  if (move.burst !== undefined) widen(active, move.burst.frame, move.burst.frame);
  if (move.ritual !== undefined) widen(active, move.ritual.frame, move.ritual.frame);
  if (move.commandGrab !== undefined) widen(active, move.commandGrab.first, move.commandGrab.last);
  if (move.guard !== undefined) widen(active, move.guard.first, move.guard.last);
  if (move.intangible !== undefined) widen(active, move.intangible.first, move.intangible.last);
  if (move.armor !== undefined) widen(active, move.armor.first, move.armor.shell === true ? move.armor.first : move.armor.last);
}

function measureCueWindows(move: Readonly<AuthoredSpecial>, minimumActive: number): CueWindows {
  const active = { first: 1000000, last: 0 };
  widenByHits(active, move);
  widenByEvents(active, move);
  if (active.last === 0) widen(active, 1, 1);
  const first = Math.max(1, active.first);
  return { startup: { first: 1, last: Math.max(1, first - 1) }, active: { first, last: Math.min(move.endFrame, Math.max(active.last, first + minimumActive - 1)) } };
}

const cachedCueWindows = new WeakMap<object, CueWindows>();
const cachedSingleFrameCueWindows = new WeakMap<object, CueWindows>();

export function heroCueWindows(move: Readonly<AuthoredSpecial>, minimumActive = ACTIVE_CUE_FRAMES): CueWindows {
  const cache = minimumActive === ACTIVE_CUE_FRAMES ? cachedCueWindows : minimumActive === 1 ? cachedSingleFrameCueWindows : undefined;
  const known = cache?.get(move);
  if (known !== undefined) return known;
  const windows = measureCueWindows(move, minimumActive);
  cache?.set(move, windows);
  return windows;
}
