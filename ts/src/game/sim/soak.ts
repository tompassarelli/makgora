import { HeroStatusGroup, HeroStatusKind } from "./codes";

export const soakStatus = (level: number, frames: number, slowFrames: number) => ({
  kind: HeroStatusKind.soak, frames, group: HeroStatusGroup.chill, immunityFrames: 0,
  soak: { level, slow: { kind: HeroStatusKind.chill, frames: slowFrames, group: HeroStatusGroup.chill, immunityFrames: 0 } },
});

export const igniteStatus = (damage: readonly number[], frames: readonly number[], every: number, tick: number) => ({
  kind: HeroStatusKind.ignite, frames: 0, group: HeroStatusGroup.chill, immunityFrames: 0, ignite: { damage, frames, every, tick },
});
