import type { HitEffect } from "../hitRegions";

export interface ProjectileGust {
  readonly lee: number;
  readonly leeHeight: number;
  readonly groundedEffect: Readonly<HitEffect>;
  readonly ownerPush: number;
}
