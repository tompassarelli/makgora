import { f32 } from "wisp/src/sim/f32";
import { PARTICIPANT_CAPACITY } from "../../input/participants";
import { type Fighter, mutablePlacedObject, placedObject } from "../fighter";
import { CompanionMode } from "./schema";

export function creditSpawnHit(owner: Fighter): void {
  for (let slot = 0; slot <= owner.pack.length; slot++) {
    const placed = placedObject(owner, slot);
    if (placed.life <= 0 || placed.spec?.splits === undefined) continue;
    mutablePlacedObject(owner, slot).hits++;
    return;
  }
}

export function splitSpawns(owner: Fighter): void {
  for (let slot = 0; slot <= owner.pack.length; slot++) {
    const whole = placedObject(owner, slot);
    const splits = whole.spec?.splits;
    if (splits === undefined || whole.life <= 0 || whole.hits < splits.afterHits) continue;
    const { life, age, x, z, direction, surface } = whole;
    for (const [half, side] of [[slot, -1], [splits.into, 1]] as const) {
      const placed = mutablePlacedObject(owner, half);
      placed.spec = splits.half;
      placed.life = life;
      placed.age = age;
      placed.x = f32(x + f32(side * splits.apart));
      placed.z = z;
      placed.direction = direction;
      placed.surface = surface;
      placed.durability = splits.half.durability;
      placed.hits = 0;
      placed.serial++;
      for (let source = 0; source < PARTICIPANT_CAPACITY; source++) placed.struck[source] = undefined;
      placed.specialStruck = 0;
      placed.mode = CompanionMode.follow;
      placed.modeFrame = 0;
      placed.apart = 0;
      placed.bitten = 0;
    }
  }
}
