import { parseDecimal } from "../netcode/journal/decimal";

interface VisualCapture {
  readonly token: string;
  readonly frames: readonly number[];
  next: number;
  held: { readonly epoch: number; readonly frame: number } | undefined;
  ticks: number;
  readonly every: { readonly from: number; readonly releaseTicks: number; last: number } | undefined;
}

const captures = new Map<number, VisualCapture>();
export const heldVisualFrame = (slot: number) => captures.get(slot)?.held;
export const visualCapture = (slot: number) => captures.get(slot);
export function visualCaptureStopBefore(slot: number, stopBefore?: number): number | undefined {
  const capture = captures.get(slot);
  const frame = capture?.held?.frame ?? (capture?.every === undefined ? capture?.frames[capture.next] : Math.max(capture.every.from, capture.every.last + 1));
  return frame === undefined ? stopBefore : stopBefore === undefined ? frame + 1 : Math.min(stopBefore, frame + 1);
}
export const clearVisualCapture = (slot: number): void => { captures.delete(slot); };
export const visualReleaseFile = (token: string, slot: number, frame: number) => `smashcraft-visual-${token}-p${slot}-f${frame}.txt`;


export function configureVisualCapture(message: string, slot: number): string {
  const marker = message.indexOf(" |capture ");
  if (marker < 0) return message;
  captures.delete(slot);
  const fields = message.substring(marker + 10).split(" ");
  const token = fields[0];
  const rows = fields[slot + 1];
  if (token === undefined || token.length === 0 || token.length > 32 || rows === undefined) return message;
  for (let i = 0; i < token.length; i++) if (!"0123456789abcdefghijklmnopqrstuvwxyz-".includes(token.charAt(i))) return message;
  const frames: number[] = [];
  let frame = 0;
  if (rows !== "-") for (const text of rows.split(",")) {
    const delta = parseDecimal(text);
    if (delta === undefined || delta < 1 || delta > 18000 - frame) return message;
    frame += delta;
    frames.push(frame);
  }
  if (frames.length > 0) captures.set(slot, { token, frames, next: 0, held: undefined, ticks: 0, every: undefined });
  return message.substring(0, marker);
}


export function holdEveryVisualFrame(slot: number, from: number, releaseTicks: number): void {
  captures.set(slot, { token: "every", frames: [], next: 0, held: undefined, ticks: 0, every: { from, releaseTicks, last: 0 } });
}


export function holdVisualFrame(slot: number, epoch: number, frame: number): boolean {
  const state = captures.get(slot);
  if (state === undefined || state.held !== undefined) return false;
  if (state.every !== undefined) {
    if (frame < Math.max(state.every.from, state.every.last + 1)) return false;
    state.held = { epoch, frame };
    state.ticks = 0;
    return true;
  }
  while (state.next < state.frames.length && (state.frames[state.next] ?? frame) < frame) state.next++;
  if (state.frames[state.next] !== frame) return false;
  state.held = { epoch, frame };
  state.ticks = 0;
  return true;
}

export function releaseVisualFrame(slot: number): void {
  const state = captures.get(slot);
  if (state === undefined || state.held === undefined) return;
  if (state.every !== undefined) state.every.last = state.held.frame;
  state.held = undefined;
  state.next++;
}
