import { type Capsule, emptyCapsule, placeCapsule } from "../sim/geometry/contactGeometry";
import { type Fighter, placedObject } from "../sim/fighter";
import type { MatchCamera } from "../sim/matchCamera";
import { heroRegionOrigin, placeHeroStrike } from "../sim/specials/heroContact";
import { runningHeroSpecial } from "../sim/specials/runningMove";
import { cameraPoint } from "./arenaCamera";
import { HitAreaKind, collectHitAreas, createHitAreaList } from "./hitAreas";

export interface WorldBounds { left: number; right: number; bottom: number; top: number }
export interface PixelBox { readonly x: number; readonly y: number; readonly width: number; readonly height: number }

const areas = createHitAreaList();
const strike = emptyCapsule();

export function emptyBounds(): WorldBounds {
  return { left: Infinity, right: -Infinity, bottom: Infinity, top: -Infinity };
}

function widen(bounds: WorldBounds, left: number, right: number, bottom: number, top: number): void {
  bounds.left = Math.min(bounds.left, left);
  bounds.right = Math.max(bounds.right, right);
  bounds.bottom = Math.min(bounds.bottom, bottom);
  bounds.top = Math.max(bounds.top, top);
}

function widenCapsule(bounds: WorldBounds, capsule: Readonly<Capsule>): void {
  widen(bounds, Math.min(capsule.x1, capsule.x2) - capsule.radius, Math.max(capsule.x1, capsule.x2) + capsule.radius, Math.min(capsule.z1, capsule.z2) - capsule.radius, Math.max(capsule.z1, capsule.z2) + capsule.radius);
}

export function hurtBounds(f: Readonly<Fighter>, into: WorldBounds): WorldBounds {
  collectHitAreas(f, areas);
  for (let index = 0; index < areas.count; index++) {
    const area = areas.areas[index];
    if (area !== undefined && (area.kind === HitAreaKind.body || area.kind === HitAreaKind.protected)) widenCapsule(into, area.capsule);
  }
  return into;
}

function widenSpecialRegions(f: Readonly<Fighter>, into: WorldBounds): void {
  const special = runningHeroSpecial(f);
  const origin = heroRegionOrigin(f);
  const direction = f.facing < 0 ? -1.0 : 1.0;
  for (const region of special?.regions ?? []) {
    if (f.special.frame < region.firstFrame || f.special.frame > region.lastFrame) continue;
    const path = region.hit.strike;
    if (path !== undefined) widenCapsule(into, placeHeroStrike(strike, f, path, origin.x, origin.z));
    else widenCapsule(into, placeCapsule(strike, { x1: region.hit.minX, z1: region.hit.minZ, x2: region.hit.maxX, z2: region.hit.maxZ, radius: 0.0 }, origin.x, origin.z, direction));
  }
}

function widenPlacedObjects(f: Readonly<Fighter>, into: WorldBounds): void {
  for (let animal = 0; animal <= f.pack.length; animal++) {
    const placed = placedObject(f, animal);
    const spec = placed.spec;
    if (placed.life <= 0 || spec === undefined) continue;
    widen(into, placed.x - spec.radius, placed.x + spec.radius, placed.z, placed.z + Math.max(spec.height, spec.model?.height ?? 0.0));
  }
}

export function effectBounds(f: Readonly<Fighter>, into: WorldBounds): WorldBounds {
  collectHitAreas(f, areas);
  for (let index = 0; index < areas.count; index++) {
    const area = areas.areas[index];
    if (area !== undefined && area.kind === HitAreaKind.strike) widenCapsule(into, area.capsule);
  }
  widenSpecialRegions(f, into);
  for (const projectile of f.projectiles) {
    if (projectile.life <= 0) continue;
    widenCapsule(into, { x1: projectile.x, z1: projectile.z, x2: projectile.x + projectile.velocityX, z2: projectile.z + projectile.velocityZ, radius: projectile.spec?.radius ?? 24.0 });
  }
  widenPlacedObjects(f, into);
  return into;
}

export function screenBox(camera: Readonly<MatchCamera>, aspect: number, width: number, height: number, bounds: Readonly<WorldBounds>): PixelBox | undefined {
  if (!(bounds.left <= bounds.right && bounds.bottom <= bounds.top)) return undefined;
  const corners = emptyBounds();
  for (const worldX of [bounds.left, bounds.right]) for (const worldZ of [bounds.bottom, bounds.top]) {
    const point = cameraPoint(camera, aspect, worldX, worldZ);
    widen(corners, point.column, point.column, point.row, point.row);
  }
  const x = Math.max(0, Math.floor(corners.left * width));
  const y = Math.max(0, Math.floor(corners.bottom * height));
  const right = Math.min(width, Math.ceil(corners.right * width));
  const bottom = Math.min(height, Math.ceil(corners.top * height));
  return right > x && bottom > y ? { x, y, width: right - x, height: bottom - y } : undefined;
}
