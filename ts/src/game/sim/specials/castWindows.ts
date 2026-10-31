import type { Character } from "../codes";

export interface FrameWindow {
  readonly first: number;
  readonly last: number;
}

export interface SpecialChannel extends FrameWindow { readonly rewinds: number }

export interface CastWindows {
  readonly reflects?: FrameWindow | undefined;
  readonly empowers?: { readonly frame: number; readonly shots: number; readonly frames: number } | undefined;
  readonly spendsEmpowered?: true | undefined;
  /** On `frame` its user becomes `character`, taking that form's tuning. */
  readonly becomes?: { readonly frame: number; readonly character: Character } | undefined;
}
