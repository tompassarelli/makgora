import { PARTICIPANT_CAPACITY } from "../../input/participants";
import { emptyCapsule } from "../geometry/contactGeometry";
import { AttackStyle, SpecialAction } from "../codes";
import { mutableProjectile } from "../fighterProjectiles";
import { StrikeKind, type StrikeResult, normalStrike, placeStrikeBody, projectileStrike, specialStrike, strikeResult } from "../placedObjects";
import type { Fighter } from "../fighter";
import { type Roster, fighterAt, isActive } from "../roster";
import { sameTeam } from "../teams";
import { type Candle, mutableCandle } from "../fighterRest";
import { CANDLE_BODY_HEIGHT, CANDLE_BODY_RADIUS, candleLoose, kickCandle, snuffCandle } from "./koboldCandle";

const body = emptyCapsule();
const struck = strikeResult();

function snuffs(result: Readonly<StrikeResult>): boolean {
  return result.kind === StrikeKind.special ? result.action === SpecialAction.heroDown
    : result.kind === StrikeKind.normal && (result.style === AttackStyle.downTilt || result.style === AttackStyle.downSmash || result.style === AttackStyle.downAir);
}

const contest = { snuffed: false, kickSlot: -1, kickDirection: 0, kickProjectile: -1 };

function contestCandle(world: Roster, ownerSlot: number, candle: Candle): void {
  contest.snuffed = false;
  contest.kickSlot = -1;
  contest.kickDirection = 0;
  contest.kickProjectile = -1;
  for (let sourceSlot = 0; sourceSlot < PARTICIPANT_CAPACITY; sourceSlot++) {
    if (sourceSlot === ownerSlot || !isActive(world, sourceSlot) || sameTeam(world, sourceSlot, ownerSlot)) continue;
    const source = fighterAt(world, sourceSlot);
    if (source.status.out) continue;
    for (let kind = StrikeKind.normal; kind <= StrikeKind.projectile; kind++) {
      const hit = kind === StrikeKind.normal ? normalStrike(candle, body, sourceSlot, source, struck)
        : kind === StrikeKind.special ? specialStrike(candle, body, sourceSlot, source, struck)
        : projectileStrike(body, sourceSlot, source, 0, struck) >= 0;
      if (!hit) continue;
      if (snuffs(struck)) contest.snuffed = true;
      else if (contest.kickSlot < 0) {
        contest.kickSlot = sourceSlot;
        contest.kickDirection = struck.direction;
        contest.kickProjectile = struck.projectile;
      }
    }
  }
}

export function strikeCandles(world: Roster): void {
  for (let ownerSlot = 0; ownerSlot < PARTICIPANT_CAPACITY; ownerSlot++) {
    if (!isActive(world, ownerSlot)) continue;
    const owner = fighterAt(world, ownerSlot);
    if (!candleLoose(owner)) continue;
    const candle = mutableCandle(owner);
    placeStrikeBody(body, candle.x, candle.z, CANDLE_BODY_RADIUS, CANDLE_BODY_HEIGHT);
    contestCandle(world, ownerSlot, candle);
    if (contest.snuffed) snuffCandle(owner);
    else if (contest.kickSlot >= 0) {
      kickCandle(owner, contest.kickDirection);
      if (contest.kickProjectile >= 0) mutableProjectile(fighterAt(world, contest.kickSlot), contest.kickProjectile).life = 0;
    }
  }
}
