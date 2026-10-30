import { assertEquals, assertFalse, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Character, SpecialAction } from "../../sim/codes";
import { type Fighter, createFighter } from "../../sim/fighter";
import { isEthereal } from "../../sim/heroStatus";
import type { Roster } from "../../sim/roster";
import { duelPair, lift, stepDuel } from "../../sim/testDuel";
import { controls } from "../../sim/testWorld";
import { BANISH, BANISH_BEAM, BANISH_BEAM_FRAMES, BANISH_BEAM_REACH, BANISH_BODY_LENGTH, BANISH_DELAY_FRAMES, BANISH_FRAMES, BANISH_WHIFF_RECOVERY } from "./specials";

const cast = controls({ specialPressed: true, specialZ: -1, verticalDirection: -1 });
const idle = controls();

function duel(gap: number): { kael: Fighter; target: Fighter; world: Roster } {
  const kael = createFighter(Character.kaelthas, 0.0, 1);
  const target = createFighter(Character.rifleman, gap, -1);
  const { world } = duelPair(kael, target);
  return { kael, target, world };
}

function banishedAfter(gap: number): { frame: number; damage: number } {
  const { target, world } = duel(gap);
  stepDuel(world, cast);
  for (let frame = 2; frame < 80; frame++) {
    stepDuel(world, idle);
    if (isEthereal(target)) return { frame, damage: target.status.damage };
  }
  return { frame: -1, damage: target.status.damage };
}

function reachAndDelay(): void {
  assertEquals(BANISH_DELAY_FRAMES, 20);
  assertEquals(BANISH_BEAM_FRAMES, 6);
  assertEquals(BANISH_BEAM.x2 - BANISH_BEAM.x1, BANISH_BEAM_REACH);
  assertEquals(BANISH_BEAM_REACH, f32(3.0 * BANISH_BODY_LENGTH));
  const near = banishedAfter(160.0);
  assertGreaterThan(near.frame, BANISH_DELAY_FRAMES - 2);
  assertLessThan(near.frame, BANISH_DELAY_FRAMES + BANISH_BEAM_FRAMES + 2);
  assertEquals(near.damage, 0.0);
  const edge = banishedAfter(f32(BANISH_BEAM.x2 + BANISH_BEAM.radius));
  assertTrue(edge.frame > 0);
  assertEquals(banishedAfter(f32(BANISH_BEAM.x2 + 120.0)).frame, -1, "past three body lengths the beam misses");
}

function whiffAndHitTiming(): void {
  const miss = duel(900.0);
  stepDuel(miss.world, cast);
  let frames = 1;
  while (miss.kael.special.action !== SpecialAction.none && frames < 120) {
    stepDuel(miss.world, idle);
    frames++;
  }
  assertEquals(frames, BANISH_DELAY_FRAMES + BANISH_BEAM_FRAMES - 1 + BANISH_WHIFF_RECOVERY);
  assertFalse(isEthereal(miss.target));
  const hit = duel(160.0);
  stepDuel(hit.world, cast);
  let banished = 0;
  for (let frame = 0; frame < 120; frame++) {
    stepDuel(hit.world, idle);
    if (isEthereal(hit.target)) banished++;
  }
  assertTrue(banished >= BANISH_FRAMES - 4 && banished <= BANISH_FRAMES);
  assertEquals(BANISH.immunityFrames, 240);
}

function castsInTheAir(): void {
  const { kael, target, world } = duel(160.0);
  lift(kael, 300.0);
  lift(target, 300.0);
  stepDuel(world, cast);
  let banished = false;
  for (let frame = 0; frame < 40; frame++) {
    lift(target, kael.motion.z);
    stepDuel(world, idle);
    banished = banished || isEthereal(target);
  }
  assertTrue(banished);
}

test("Banish is a green beam three body lengths long after a 20-frame delay and 6 live frames, banishes for 60 frames, leaves 30 open after a whiff, and works in the air [k3 measure docs/design/kaelthas.md]", () => {
  reachAndDelay();
  whiffAndHitTiming();
  castsInTheAir();
});
