import { f32 } from "wisp/src/sim/f32";
import { AttackStyle } from "./codes";

export type WeaponRegionFit = { readonly [frame: number]: readonly (readonly number[])[] | undefined };
export type WeaponRegionFits = { readonly [move: string]: WeaponRegionFit | undefined };

export const SPECIAL_FIT_PREFIX = "special.";
export const ULTIMATE_FIT_PREFIX = "ultimate";

interface Strike { readonly x1: number; readonly z1: number; readonly x2: number; readonly z2: number; readonly radius: number }
interface Region { readonly firstFrame: number; readonly lastFrame: number; readonly hit: { readonly strike?: Strike | undefined } }
interface Regions<R extends Region> { readonly regions: readonly R[] }
interface Normals<R extends Region> { readonly normals: { readonly [style: number]: Regions<R> | undefined } }

function fittedRegion<R extends Region>(region: R, frame: number, fitted: readonly number[] | undefined): R {
  const strike = region.hit.strike;
  if (fitted === undefined || strike === undefined) return { ...region, firstFrame: frame, lastFrame: frame };
  const placed: Strike = { ...strike, x1: fitted[0] ?? strike.x1, z1: fitted[1] ?? strike.z1, x2: fitted[2] ?? strike.x2, z2: fitted[3] ?? strike.z2 };
  return {
    ...region, firstFrame: frame, lastFrame: frame,
    hit: {
      ...region.hit, strike: placed,
      minX: f32(Math.min(placed.x1, placed.x2) - placed.radius), maxX: f32(Math.max(placed.x1, placed.x2) + placed.radius),
      minZ: f32(Math.min(placed.z1, placed.z2) - placed.radius), maxZ: f32(Math.max(placed.z1, placed.z2) + placed.radius),
    },
  };
}

export function fitRegions<R extends Region>(regions: readonly R[], fit: WeaponRegionFit | undefined): readonly R[] {
  if (fit === undefined) return regions;
  const out: R[] = [];
  const slots: number[] = [];
  for (const region of regions) {
    if (region.hit.strike === undefined) {
      out.push(region);
      continue;
    }
    let touched = false;
    for (let frame = region.firstFrame; frame <= region.lastFrame; frame++) if (fit[frame] !== undefined) touched = true;
    for (let frame = region.firstFrame; frame <= region.lastFrame; frame++) {
      const slot = slots[frame] ?? 0;
      slots[frame] = slot + 1;
      if (touched) out.push(fittedRegion(region, frame, fit[frame]?.[slot]));
    }
    if (!touched) out.push(region);
  }
  return out;
}

export function fitMoves<R extends Region, M extends Normals<R>>(moves: M, fits: WeaponRegionFits): M {
  const normals: { [style: number]: Regions<R> | undefined } = { ...moves.normals };
  for (const [name, style] of Object.entries(AttackStyle)) {
    const move = normals[style], fit = fits[name];
    if (move !== undefined && fit !== undefined) normals[style] = { ...move, regions: fitRegions(move.regions, fit) };
  }
  return { ...moves, normals } as M;
}

function fitAt<T>(node: T, path: readonly string[], at: number, fit: WeaponRegionFit): T {
  const key = path[at];
  if (key === undefined) {
    const special = node as { readonly regions?: readonly Region[] | undefined };
    return { ...special, regions: fitRegions(special.regions ?? [], fit) } as T;
  }
  const first = key.charCodeAt(0);
  if (first >= 48 && first <= 57) {
    const index = Number(key);
    const list = [...(node as readonly unknown[])];
    list[index] = fitAt(list[index], path, at + 1, fit);
    return list as T;
  }
  const record = node as { readonly [field: string]: unknown };
  return { ...record, [key]: fitAt(record[key], path, at + 1, fit) } as T;
}

function fitTree<T>(root: T, fits: WeaponRegionFits, prefix: string): T {
  let out = root;
  for (const key of Object.keys(fits).sort()) {
    const fit = fits[key];
    if (fit === undefined || !key.startsWith(prefix)) continue;
    const path = key.slice(prefix.length).split(".").filter((part) => part.length > 0);
    out = fitAt(out, path, 0, fit);
  }
  return out;
}

export function fitSpecials<S extends object>(specials: S, fits: WeaponRegionFits): S {
  return fitTree(specials, fits, SPECIAL_FIT_PREFIX);
}

export function fitUltimate<S extends object>(ultimate: S, fits: WeaponRegionFits): S {
  return fitTree(ultimate, fits, ULTIMATE_FIT_PREFIX);
}
