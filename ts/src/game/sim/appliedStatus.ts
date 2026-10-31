import type { HeroStatusGroup, HeroStatusKind } from "./codes";

export interface AppliedStatus {
  readonly kind: HeroStatusKind;
  readonly frames: number;
  readonly group: HeroStatusGroup;

  readonly immunityFrames: number;

  readonly tick?: { readonly every: number; readonly damage: number } | undefined;

  readonly soak?: { readonly level: number; readonly slow: AppliedStatus } | undefined;
  readonly ignite?: { readonly damage: readonly number[]; readonly frames: readonly number[]; readonly every: number; readonly tick: number } | undefined;

  readonly perPercent?: { readonly frames: number; readonly cap: number } | undefined;

  readonly groundedOnly?: true | undefined;

  readonly stacks?: { readonly cap: number } | undefined;

  readonly hits?: number | undefined;

  readonly pull?: { readonly frames: number; readonly hold: number } | undefined;
}
