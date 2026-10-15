

import { assertEquals, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Character } from "./codes";
import { type Fighter } from "./fighter";
import { createReferenceFighter } from "./referenceRig";
import { TOMB_OF_SARGERAS_STAGE, WATER_FRICTION } from "./stage";
import { advanceSolo, controls, withPhysics } from "./testWorld";
import { AIR_DODGE_LANDING_LAG } from "./down";
import { createFighter } from "./fighter";
import { beginAirDodge } from "./jumpsAndDodges";
import { WORLD_UNITS_PER_MELEE_UNIT, melee } from "./tuning";

const FLAT_STAGE = 0;
const RELEASED = controls();
const HELD_RIGHT = controls({ direction: 1 });

function slideToRest(f: Fighter, stage: number, moving: (f: Fighter) => boolean): { frames: number; distance: number } {
  const startX = f.motion.x;
  let frames = 0;
  while (moving(f) && frames < 600) {
    advanceSolo(f, stage, RELEASED, 0.0);
    frames++;
  }
  assertTrue(f.motion.grounded);
  return { frames, distance: f32(f.motion.x - startX) };
}

function runner(stage: number): Fighter {
  const f = createReferenceFighter(Character.sylvanas, -400.0, 1);
  for (let frame = 0; frame < 40; frame++) advanceSolo(f, stage, HELD_RIGHT, 0.0);
  return f;
}

const groundSpeed = (f: Fighter) => f.motion.vx !== 0;

function assertTwiceAsLong(ground: number, water: number): void {
  assertTrue(ground > 0);
  assertNear(f32(water / ground), f32(1.0 / WATER_FRICTION), f32(0.15));
}

test("a run released on water brakes at half traction and slides twice as far [k3 measure docs/physics.md]", () => {
  const ground = runner(FLAT_STAGE);
  const water = runner(TOMB_OF_SARGERAS_STAGE);

  assertEquals(water.motion.vx, ground.motion.vx);
  assertEquals(water.motion.x, ground.motion.x);
  const speed = ground.motion.vx;
  advanceSolo(ground, FLAT_STAGE, RELEASED, 0.0);
  advanceSolo(water, TOMB_OF_SARGERAS_STAGE, RELEASED, 0.0);
  const traction = ground.tuning.physics.traction;
  assertEquals(ground.motion.vx, f32(speed - traction));
  assertEquals(water.motion.vx, f32(speed - f32(traction * WATER_FRICTION)));
  assertTwiceAsLong(slideToRest(ground, FLAT_STAGE, groundSpeed).distance, slideToRest(water, TOMB_OF_SARGERAS_STAGE, groundSpeed).distance);
});


function landedSlide(f: Fighter): number {
  const startX = f.motion.x;
  for (let frame = 0; frame < 200 && (!f.motion.grounded || f.motion.vx !== 0); frame++) advanceSolo(f, FLAT_STAGE, RELEASED, 0.0);
  return f32(f32(f.motion.x - startX) / WORLD_UNITS_PER_MELEE_UNIT);
}

test("a wavedash slide brakes at double traction above walk speed: Fox, Marth and Luigi's Melee slide lengths [k4 reference melee]", () => {
  const landingSpeed = melee(2.6666624546051025);
  for (const [traction, walkSpeed, slide] of [[f32(0.08), f32(1.6), 31.0], [f32(0.06), f32(1.6), 41.5], [f32(0.025), f32(1.1), f32(83.8)]] as const) {
    const f = createFighter(Character.blademaster, -400.0, 1);
    withPhysics(f, { traction: melee(traction), walkSpeed: melee(walkSpeed) });
    f.landing.lag = AIR_DODGE_LANDING_LAG;
    f.motion.vx = landingSpeed;
    assertNear(f32(f32(landingSpeed / WORLD_UNITS_PER_MELEE_UNIT) + landedSlide(f)), slide, f32(0.1));
  }
});

test("every hero's wavedash slide follows its traction: Jaina slides furthest and the grippiest heroes least [k3 measure docs/physics.md]", () => {
  let longest = 0.0;
  let shortest = 1.0e9;
  let jaina = 0.0;
  let grippiest = 0.0;
  for (let code: number = Character.blademaster; code <= Character.kobold; code++) {
    const character = code as Character;
    const f = createFighter(character, -400.0, 1);
    f.motion.grounded = false;
    f.motion.z = 1.0;
    beginAirDodge(f, 1, -1);
    const slide = landedSlide(f);
    longest = Math.max(longest, slide);
    shortest = Math.min(shortest, slide);
    if (character === Character.jaina) jaina = slide;
    if (character === Character.pitLord || character === Character.cairne || character === Character.anubarak) grippiest = Math.max(grippiest, slide);
  }
  assertEquals(jaina, longest);
  assertTrue(grippiest < f32(shortest + 2.0));
  assertTrue(longest > f32(shortest * 2.0));
});
