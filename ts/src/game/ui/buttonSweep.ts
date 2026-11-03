import { Frame, frameVisible } from "wisp/game/frames";
import { formatInt, formatRealWidth } from "wisp/game/text";
import { writeLines } from "wisp/src/platform/fileio";

export interface SweepBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

interface SweepButton {
  readonly label: string;
  readonly frame: Frame;
  readonly box: SweepBox | undefined;
}

export const SWEEP_PRECISION = 5;
export const buttonListFile = (slot: number) => `makgora-dev-buttons-p${formatInt(slot)}.txt`;
export const buttonClickFile = (slot: number) => `makgora-dev-button-clicks-p${formatInt(slot)}.txt`;

// Lua: the registry and the click log are module state that lives for the session; panels are built once at startup and a reload rebuilds them.
const registered: SweepButton[] = [];
const clicks: string[] = [];
let sweepSlot = -1;

export function targetKind(target: unknown): string {
  if (typeof target === "object" && target !== null && "kind" in target) return typeof target.kind === "string" ? target.kind : "button";
  return "button";
}

export function registerSweepButton(owner: string, kind: string, frame: Frame, box: SweepBox | undefined): string {
  const label = `${owner}#${formatInt(registered.length)}:${kind}`;
  registered.push({ label, frame, box });
  return label;
}

export function unregisterSweepButtons(frames: readonly Frame[]): void {
  for (let index = registered.length - 1; index >= 0; index--) {
    const entry = registered[index];
    if (entry !== undefined && frames.includes(entry.frame)) registered.splice(index, 1);
  }
}

const real = (value: number) => formatRealWidth(value, 0, SWEEP_PRECISION);

export function sweepListing(): string[] {
  return registered.map(({ label, frame, box }) => {
    const shown = frameVisible(frame) ? "1" : "0";
    return box === undefined
      ? `BUTTON ${label} visible=${shown} box=none`
      : `BUTTON ${label} visible=${shown} x=${real(box.x)} y=${real(box.y)} width=${real(box.width)} height=${real(box.height)}`;
  });
}

export function startButtonSweep(slot: number): number {
  sweepSlot = slot;
  clicks.length = 0;
  writeLines(buttonListFile(slot), sweepListing());
  writeLines(buttonClickFile(slot), clicks);
  return registered.length;
}

export function recordSweepClick(label: string): void {
  if (sweepSlot < 0) return;
  clicks.push(`CLICK ${label} n=${formatInt(clicks.length + 1)}`);
  writeLines(buttonClickFile(sweepSlot), clicks);
}

export function sweepActive(): boolean {
  return sweepSlot >= 0;
}
