import type { AppliedStatus } from "../appliedStatus";

export interface ProjectileVelocity {
  readonly velocityX: number;
  readonly velocityZ: number;
}

export interface ProjectileBounce {
  readonly count: number;
  readonly range: number;
  readonly falloff: number;
  readonly speed: number;
  readonly drain: number;
}

export interface SpecialGaze {
  readonly window: { readonly first: number; readonly last: number };
  readonly range: number;
  readonly height: number;
  readonly slow: AppliedStatus;
}
