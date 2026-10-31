import { f32 } from "wisp/src/sim/f32";
import { MARKER_HEIGHT, MARKER_WIDTH } from "./fighterMarker";
import { MATCH_CLOCK_BOX, MATCH_COUNTDOWN_BOX, MATCH_NOTICE_BOX, type TextBox } from "./hudLayout";

export interface NoticePlace {
  left: number;
  top: number;
}

const HIGHEST_TOP = f32(0.52);
const LOWEST_TOP = f32(0.3);
const LEFTMOST = f32(0.02);
const RIGHTMOST = f32(0.46);
const STEP = f32(0.01);
const MARGIN = f32(0.006);

const crosses = (left: number, top: number, box: TextBox): boolean =>
  left < box.left + box.width + MARGIN && box.left < left + MATCH_NOTICE_BOX.width + MARGIN
  && top > box.top - box.height - MARGIN && box.top > top - MATCH_NOTICE_BOX.height - MARGIN;

function crossesAnything(left: number, top: number, x: readonly number[], y: readonly number[], shown: readonly boolean[]): boolean {
  if (crosses(left, top, MATCH_CLOCK_BOX) || crosses(left, top, MATCH_COUNTDOWN_BOX)) return true;
  for (let slot = 0; slot < x.length; slot++) {
    if (shown[slot] !== true) continue;
    const markerX = x[slot] ?? 0.0;
    const markerY = y[slot] ?? 0.0;
    if (left < markerX + MARKER_WIDTH / 2.0 + MARGIN && markerX - MARKER_WIDTH / 2.0 < left + MATCH_NOTICE_BOX.width + MARGIN
      && top > markerY - MARGIN && markerY + MARKER_HEIGHT + MARGIN > top - MATCH_NOTICE_BOX.height) return true;
  }
  return false;
}

/** Keeps the notice where it is while it is clear of the fighter markers, the clock and the countdown; otherwise moves it to the first clear spot, scanning down from just under the clock and across from the left edge. Returns whether it moved. */
export function clearNoticePlace(place: NoticePlace, x: readonly number[], y: readonly number[], shown: readonly boolean[]): boolean {
  if (!crossesAnything(place.left, place.top, x, y, shown)) return false;
  const preferred = !crossesAnything(MATCH_NOTICE_BOX.left, MATCH_NOTICE_BOX.top, x, y, shown);
  if (preferred) return move(place, MATCH_NOTICE_BOX.left, MATCH_NOTICE_BOX.top);
  for (let top = HIGHEST_TOP; top >= LOWEST_TOP; top -= STEP) {
    for (let left = LEFTMOST; left <= RIGHTMOST; left += STEP) {
      if (!crossesAnything(left, top, x, y, shown)) return move(place, left, top);
    }
  }
  return move(place, MATCH_NOTICE_BOX.left, MATCH_NOTICE_BOX.top);
}

function move(place: NoticePlace, left: number, top: number): boolean {
  const moved = place.left !== left || place.top !== top;
  place.left = left;
  place.top = top;
  return moved;
}
