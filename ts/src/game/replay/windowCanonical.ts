import type { FrameWindow } from "../sim/specials/schema";

export function writeWindow(int: (name: string, value: number) => void, name: string, window: Readonly<FrameWindow> | undefined): void {
  if (window === undefined) return;
  int(`${name}.first`, window.first);
  int(`${name}.last`, window.last);
}
