import { f32 } from "wisp/src/sim/f32";
import { addFloat32, roundToFloat32 } from "wisp/src/sim/binary32";
import { max, min } from "../core/numbers";
import { PARTICIPANT_CAPACITY } from "../input/participants";
import { type Fighter, mutablePlacedObject, placedObject } from "./fighter";
import { capPercent } from "./percent";
import { type Roster, fighterAt, isActive } from "./roster";
import { placeOne } from "./specials/engine";
import { spawnHeroProjectileAt } from "./specials/heroProjectiles";
import { CompanionMode, type SpecialCurse } from "./specials/schema";
import { mainDeckLeft, mainDeckRight, mainDeckZAt, surfaceCount, surfaceLeft, surfaceRight, surfaceZAt } from "./stage";

const MAIN_DECK = 0;

export function curseOf(owner: Readonly<Fighter>): SpecialCurse | undefined {
  return owner.tuning.ultimate?.targetedStrike?.curse;
}

export function applyCurse(target: Fighter, ownerSlot: number): void {
  const { status } = target;
  if (status.out || status.cursedBy !== undefined) return;
  status.cursedBy = ownerSlot;
  status.curseFrames = 0;
}

function liftCurse(f: Fighter): void {
  f.status.cursedBy = undefined;
  f.status.curseFrames = 0;
}

export function summonAlive(owner: Readonly<Fighter>, curse: Readonly<SpecialCurse>): boolean {
  const placed = placedObject(owner, curse.summon.slot ?? 0);
  return placed.life > 0 && placed.spec === curse.summon;
}

export function curseOnStockLoss(world: Roster, slot: number): void {
  const victim = fighterAt(world, slot);
  const ownerSlot = victim.status.cursedBy;
  if (ownerSlot !== undefined && isActive(world, ownerSlot)) {
    const owner = fighterAt(world, ownerSlot);
    const curse = curseOf(owner);
    if (curse !== undefined && !owner.status.out && owner.status.summonFrames === 0 && !summonAlive(owner, curse)) {
      owner.status.summonFrames = curse.summonDelay;
    }
  }
  liftCurse(victim);
  for (let other = 0; other < PARTICIPANT_CAPACITY; other++) {
    if (other !== slot && isActive(world, other) && fighterAt(world, other).status.cursedBy === slot) liftCurse(fighterAt(world, other));
  }
}

function summon(owner: Fighter, curse: Readonly<SpecialCurse>, stage: number, matchFrame: number): void {
  const spec = curse.summon;
  const decked = surfaceCount(stage) > MAIN_DECK;
  const inset = max(spec.radius, spec.companion?.bite.radius ?? 0.0);
  const left = f32((decked ? surfaceLeft(stage, MAIN_DECK, matchFrame) : mainDeckLeft(stage)) + inset);
  const right = f32((decked ? surfaceRight(stage, MAIN_DECK, matchFrame) : mainDeckRight(stage)) - inset);
  const x = left <= right ? min(right, max(left, f32(f32(mainDeckLeft(stage) + mainDeckRight(stage)) * 0.5))) : f32(f32(left + right) * 0.5);
  const z = decked ? surfaceZAt(stage, MAIN_DECK, matchFrame, x) : mainDeckZAt(stage, x);
  const slot = spec.slot ?? 0;
  placeOne(owner, spec, slot, 1, 0.0, undefined);
  const placed = mutablePlacedObject(owner, slot);
  placed.x = x;
  placed.z = z;
  placed.surface = decked ? MAIN_DECK : undefined;
  placed.direction = owner.motion.x < x ? -1 : 1;
  placed.mode = CompanionMode.stunned;
  spawnHeroProjectileAt(owner, curse.portal, x, f32(z + curse.portal.offsetZ), placed.direction, false, owner.attack.serial + 1);
}

export function advanceCurses(world: Roster, stage: number, matchFrame: number): void {
  for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) {
    if (!isActive(world, slot)) continue;
    const f = fighterAt(world, slot);
    const { status } = f;
    if (status.cursedBy !== undefined && !status.out) {
      const curse = isActive(world, status.cursedBy) ? curseOf(fighterAt(world, status.cursedBy)) : undefined;
      if (curse === undefined) liftCurse(f);
      else {
        status.curseFrames++;
        if (status.curseFrames >= curse.every) {
          status.curseFrames = 0;
          status.damage = capPercent(addFloat32(roundToFloat32(status.damage), curse.damage));
        }
      }
    }
    if (status.summonFrames <= 0) continue;
    status.summonFrames--;
    const curse = curseOf(f);
    if (status.summonFrames === 0 && curse !== undefined && !status.out) summon(f, curse, stage, matchFrame);
  }
}
