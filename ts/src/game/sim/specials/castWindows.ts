export interface FrameWindow {
  readonly first: number;
  readonly last: number;
}

export interface SpecialChannel extends FrameWindow { readonly rewinds: number }

export interface CastWindows {
  readonly reflects?: FrameWindow | undefined;
  readonly empowers?: { readonly frame: number; readonly shots: number; readonly frames: number } | undefined;
  readonly spendsEmpowered?: true | undefined;
}
