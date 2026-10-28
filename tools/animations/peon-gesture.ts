export interface Gesture {
  readonly chest?: number; readonly head?: number; readonly axe?: number; readonly elbow?: number;
  readonly grip?: number; readonly knee?: number; readonly twist?: number; readonly lean?: number;
  readonly roll?: number; readonly yaw?: number; readonly tuck?: number; readonly height?: number; readonly ahead?: number; readonly kick?: number;
}
export interface Phase { readonly at: number; readonly pose: Gesture }
export interface Action { readonly name: string; readonly frames: number; readonly phases: readonly Phase[]; readonly air?: boolean; readonly hold?: boolean; readonly contact?: number; readonly pain?: boolean }
export const phase = (at: number, pose: Gesture = {}): Phase => ({ at, pose });
