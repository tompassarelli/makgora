import { assertEquals, assertGreaterThan, test } from "wisp/src/runtime/testing";
import { at } from "wisp/src/runtime/lookup";
import { f32 } from "wisp/src/sim/f32";
import { floorMod } from "wisp/src/sim/intMath";
import { copyFighterState, sameFighterState } from "../../generated/state/fighterState";
import { Character, ProjectileKind } from "./codes";
import { type Fighter, PROJECTILE_CAPACITY, type Projectile, createFighter } from "./fighter";
import { mutableProjectile } from "./fighterProjectiles";
import { spawnProjectileMotion } from "./projectiles";
import { clearSpecialOnStock } from "./transitions";

const FIELDS = ["life", "x", "z", "direction", "kind", "visualFamily", "velocityX", "velocityZ", "serial", "damageMultiplier", "newlyReflected", "exReach", "poolHits", "poolWait", "spec", "surface"] as const satisfies readonly (keyof Projectile)[];

const exact = (a: unknown, b: unknown) => (typeof a === "number" && typeof b === "number" ? a === b && (a !== 0 || 1 / a === 1 / b) : a === b);

function sameSlot(a: Readonly<Projectile>, b: Readonly<Projectile>): boolean {
  for (const field of FIELDS) if (!exact(a[field], b[field])) return false;
  return true;
}

function everySlotSame(a: Readonly<Fighter>, b: Readonly<Fighter>): boolean {
  for (let index = 0; index < PROJECTILE_CAPACITY; index++) if (!sameSlot(at(a.projectiles, index), at(b.projectiles, index))) return false;
  return true;
}

function boundHolds(f: Readonly<Fighter>): boolean {
  const rest = { ...at(createFighter(Character.rifleman, 0.0, 1).projectiles, 0), visualFamily: at(f.projectiles, PROJECTILE_CAPACITY - 1).visualFamily };
  for (let index = f.projectileSlots; index < PROJECTILE_CAPACITY; index++) if (!sameSlot(at(f.projectiles, index), rest)) return false;
  return f.projectileSlots >= 0 && f.projectileSlots <= PROJECTILE_CAPACITY;
}

function sameOverEverySlot(a: Fighter, b: Fighter): boolean {
  const bounds = [a.projectileSlots, b.projectileSlots];
  a.projectileSlots = PROJECTILE_CAPACITY;
  b.projectileSlots = PROJECTILE_CAPACITY;
  const same = sameFighterState(a, b);
  a.projectileSlots = at(bounds, 0);
  b.projectileSlots = at(bounds, 1);
  return same;
}

function play(f: Fighter, seed: number, steps: number): number {
  let state = seed;
  const next = (range: number) => {
    state = floorMod(state * 75 + 74, 65537);
    return floorMod(state, range);
  };
  for (let step = 0; step < steps; step++) {
    const roll = next(16);
    const slot = next(PROJECTILE_CAPACITY);
    const live = at(f.projectiles, slot).life > 0;
    if (roll < 7) spawnProjectileMotion(f, next(2) === 0 ? ProjectileKind.blaster : ProjectileKind.manaBurn, f32(next(9) - 4.0), 0.0, 1 + next(30), next(5));
    else if (roll < 10 && live) mutableProjectile(f, slot).life = 0;
    else if (roll < 12 && live) mutableProjectile(f, slot).x = f32(at(f.projectiles, slot).x + 1.0);
    else if (roll < 13 && live) mutableProjectile(f, slot).poolHits++;
    else if (roll < 14) {
      f.character = next(2) === 0 ? Character.rifleman : Character.demonHunter;
      clearSpecialOnStock(f);
    }
  }
  return state;
}

test("projectile copy and compare over live slots answer as over every slot, on fighters built by the projectile writers [k2 property]", () => {
  const misses: string[] = [];
  let equal = 0;
  let unequal = 0;
  let boundsApart = 0;
  for (let trial = 0; trial < 300; trial++) {
    const a = createFighter(Character.rifleman, 0.0, 1);
    const b = createFighter(Character.rifleman, 0.0, 1);
    const shared = play(a, trial + 1, floorMod(trial, 40));
    play(b, trial + 1, floorMod(trial, 40));
    if (floorMod(trial, 3) !== 0) play(a, shared + trial, 1 + floorMod(trial, 7));
    if (floorMod(trial, 5) === 1) play(b, shared + trial + 1, 1 + floorMod(trial, 4));
    if (floorMod(trial, 4) === 2) {
      const touched = floorMod(shared, PROJECTILE_CAPACITY);
      mutableProjectile(b, touched).serial = at(b.projectiles, touched).serial;
    }
    for (const f of [a, b]) if (!boundHolds(f)) misses.push(`trial ${trial}: a slot at or past the bound ${f.projectileSlots} holds state`);
    const reference = sameOverEverySlot(a, b);
    if (sameFighterState(a, b) !== reference) misses.push(`trial ${trial}: sameFighterState ${!reference} over live slots, ${reference} over every slot`);
    if (reference) equal++;
    else unequal++;
    if (reference && a.projectileSlots !== b.projectileSlots) boundsApart++;
    const target = createFighter(Character.rifleman, 0.0, 1);
    play(target, trial + 7, floorMod(trial * 7, 50));
    copyFighterState(target, a, 15);
    if (!everySlotSame(target, a)) misses.push(`trial ${trial}: a copy left a slot unlike its source`);
    if (!boundHolds(target)) misses.push(`trial ${trial}: a copy broke the bound`);
    if (!sameFighterState(target, a)) misses.push(`trial ${trial}: a copy compares unequal`);
  }
  const fresh = createFighter(Character.demonHunter, 0.0, 1);
  const cleared = createFighter(Character.demonHunter, 0.0, 1);
  clearSpecialOnStock(cleared);
  if (sameFighterState(fresh, cleared) !== sameOverEverySlot(fresh, cleared)) misses.push("resting slots of another family compare as the same");
  copyFighterState(fresh, cleared, 15);
  if (!everySlotSame(fresh, cleared)) misses.push("a copy kept the resting family");
  assertEquals(misses.slice(0, 5).join("; "), "");
  assertGreaterThan(equal, 20);
  assertGreaterThan(unequal, 20);
  assertGreaterThan(boundsApart, 0);
});
