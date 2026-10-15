

import { assertDefined, assertEquals, assertGreaterThan, assertNear, test } from "wisp/src/runtime/testing";
import { HERO_REFERENCE_HEIGHT } from "../heroMoves";
import { MOUNTAIN_KING_SPECIALS } from "./mountainKingSpecials";
import { f32 } from "wisp/src/sim/f32";
import { Character } from "../codes";
import { type Fighter, createFighter } from "../fighter";
import { type Roster } from "../roster";
import { controls } from "../testWorld";
import { copyFighterState } from "../../../generated/state/fighterState";
import { firstFighterDifference } from "../../replay/difference";
import { duelPair, stepDuel } from "../testDuel";

const neutral = controls({ specialPressed: true });
const up = controls({ specialPressed: true, specialZ: 1 });
const down = controls({ specialPressed: true, specialZ: -1 });

function mountainKing(x: number, facing: number): Fighter {
  const f = createFighter(Character.mountainKing, x, facing);
  f.mana.points = 100;
  return f;
}



function pair(gap: number, facing = 1): { world: Roster; owner: Fighter; target: Fighter } {
  const owner = mountainKing(f32(-gap * 0.5 * facing), facing);
  const target = createFighter(Character.rifleman, f32(gap * 0.5 * facing), -facing);
  return duelPair(owner, target);
}

test("replaying Mountain King's specials from a restored snapshot reproduces every fighter field [k1 scenario]", () => {
  const { world, owner, target } = pair(200.0);
  const savedOwner = createFighter(Character.mountainKing, 0.0, 1);
  const savedTarget = createFighter(Character.rifleman, 0.0, 1);
  stepDuel(world, neutral);
  stepDuel(world);
  copyFighterState(savedOwner, owner, 3);
  copyFighterState(savedTarget, target, 3);
  const run = () => {
    for (let f = 0; f < 60; f++) stepDuel(world);
    stepDuel(world, down);
    for (let f = 0; f < 60; f++) stepDuel(world, f === 55 ? up : controls());
  };
  run();
  const endOwner = createFighter(Character.mountainKing, 0.0, 1);
  const endTarget = createFighter(Character.rifleman, 0.0, 1);
  copyFighterState(endOwner, owner, 3);
  copyFighterState(endTarget, target, 3);
  assertGreaterThan(target.status.damage, 0.0);
  assertEquals(owner.mana.points, 100);
  copyFighterState(owner, savedOwner, 3);
  copyFighterState(target, savedTarget, 3);
  run();
  assertEquals(firstFighterDifference(endOwner, owner, 3, 3), undefined);
  assertEquals(firstFighterDifference(endTarget, target, 3, 3), undefined);
});

test("Storm Bolt flies 0.85x as fast and 0.85x as far as before, its hitbox unchanged [k2 property]", () => {
  const bolt = assertDefined(MOUNTAIN_KING_SPECIALS.neutral.ground.projectiles?.[0]);
  const returns = assertDefined(bolt.returns);
  assertNear(bolt.velocityX, f32(f32(0.85) * f32(HERO_REFERENCE_HEIGHT * f32(0.12))), f32(0.001));
  assertNear(returns.speed, f32(f32(0.85) * f32(HERO_REFERENCE_HEIGHT * f32(0.14))), f32(0.001));
  assertNear(f32(bolt.velocityX * returns.age), f32(f32(0.85) * f32(f32(HERO_REFERENCE_HEIGHT * f32(0.12)) * 45)), f32(0.01));
  assertEquals(returns.age, 45);
  assertEquals(bolt.radius, f32(HERO_REFERENCE_HEIGHT * f32(0.18)));
});

test("Thunder Clap's ring and shockwaves reach 0.85x as far with 0.85x radius, art scaled to match [k2 property]", () => {
  const ring = assertDefined(MOUNTAIN_KING_SPECIALS.down.ground.regions?.[0]);
  assertNear(ring.hit.maxX, f32(f32(0.85) * f32(HERO_REFERENCE_HEIGHT * f32(0.85))), f32(0.001));
  assertNear(assertDefined(ring.hit.strike).radius, f32(f32(0.85) * 16.0), f32(0.001));
  const wave = assertDefined(MOUNTAIN_KING_SPECIALS.down.ground.projectiles?.[0]);
  assertNear(wave.offsetX, f32(f32(0.85) * f32(HERO_REFERENCE_HEIGHT * f32(0.85))), f32(0.001));
  assertNear(wave.velocityX, f32(f32(0.85) * f32(HERO_REFERENCE_HEIGHT * f32(0.10))), f32(0.001));
  assertNear(wave.radius, f32(f32(0.85) * 16.0), f32(0.001));
  assertNear(f32(wave.radius / assertDefined(wave.modelRadius)), f32(0.85), f32(0.001));
});
