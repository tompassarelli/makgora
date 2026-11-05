import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Character, SpecialAction } from "./codes";
import { type Fighter, createFighter } from "./fighter";
import { type Controls, type Roster } from "./roster";
import { surfaceLeft } from "./stage";
import { controls } from "./testWorld";
import { duelPair, lift, stepDuel } from "./testDuel";

const HEIGHT = 900.0;
const sideB = (x: number): Controls => controls({ specialPressed: true, specialX: x, direction: x });

const PARK = f32(surfaceLeft(0, 0, 0) + 60.0);

function illidan(z: number, ownerX = 0.0, targetX = PARK): { world: Roster; owner: Fighter; target: Fighter } {
  const pair = duelPair(createFighter(Character.demonHunter, ownerX, 1), createFighter(Character.rifleman, targetX, -1));
  if (z > 0.0) lift(pair.owner, z);
  return pair;
}

function settle(world: Roster, owner: Fighter, z: number): void {
  for (let frame = 0; frame < 120 && owner.special.action !== SpecialAction.none; frame++) {
    if (z > 0.0) lift(owner, z);
    stepDuel(world);
  }
  if (z > 0.0) lift(owner, z);
}



/** Steps until the Fel Rush action ends, passing each frame's input from `input`; returns the frames it took. */
function runOut(world: Roster, owner: Fighter, input: (owner: Fighter) => Readonly<Controls> = () => controls()): number {
  let frames = 0;
  while (owner.special.action === SpecialAction.demonHunterFelRush && frames < 120) {
    stepDuel(world, input(owner));
    frames++;
  }
  return frames;
}

const pressed = (owner: Readonly<Fighter>): boolean => owner.special.action === SpecialAction.demonHunterFelRush && owner.special.frame <= 1;

function pressAgain(world: Roster, owner: Fighter): boolean {
  stepDuel(world, sideB(owner.facing));
  return pressed(owner);
}


test("Fel Rush: an air rush that hits nobody ends in helpless fall, and no second press before landing starts another [k3 measure #554]", () => {
  const { world, owner } = illidan(HEIGHT);
  stepDuel(world, controls({ specialPressed: true, specialX: 1, direction: 1 }));
  assertTrue(pressed(owner));
  runOut(world, owner);
  assertFalse(owner.motion.grounded);
  assertTrue(owner.special.fall);
  assertEquals(owner.jump.remaining, 0);
  settle(world, owner, HEIGHT);
  assertFalse(pressAgain(world, owner));
  owner.special.fall = false;
  settle(world, owner, HEIGHT);
  assertFalse(pressAgain(world, owner));
});
