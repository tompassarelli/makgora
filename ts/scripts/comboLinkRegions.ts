import { AttackStyle } from "../src/game/sim/codes";
import type { Fighter } from "../src/game/sim/fighter";
import type { Opener, Sim } from "./comboExplorer";

export type Region = "clean" | "late" | "sweet" | "sour";
export const REGIONS: readonly Region[] = ["clean", "late", "sweet", "sour"];

interface Regions {
  readonly strong: Region;
  readonly weak: Region | undefined;
}

function regionsOf(a: Readonly<Fighter>, opener: Opener): Regions {
  const moves = a.tuning.moves;
  const style = opener.move.style === AttackStyle.dashAttack ? moves?.dashAttack : opener.move.style;
  const authored = opener.throw !== undefined || style === undefined ? undefined : moves?.normals[style];
  const strong = authored?.regions.filter((region) => region.hit.effect.strong === true) ?? [];
  const weak = authored?.regions.filter((region) => region.hit.effect.strong !== true) ?? [];
  if (strong.length === 0 || weak.length === 0) return { strong: "clean", weak: undefined };
  const overlap = strong.some((s) => weak.some((w) => s.firstFrame <= w.lastFrame && w.firstFrame <= s.lastFrame));
  return overlap ? { strong: "sweet", weak: "sour" } : { strong: "clean", weak: "late" };
}

export const landedRegion = (sim: Sim, opener: Opener): Region => {
  const regions = regionsOf(sim.a, opener);
  return sim.b.visuals.hitStrong ? regions.strong : regions.weak ?? regions.strong;
};
