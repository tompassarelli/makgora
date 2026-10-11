

import { assertEquals, assertGreaterThan, assertLessThan, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Character, ProjectileKind } from "./codes";
import { type Fighter, createFighter } from "./fighter";
import { type Controls, type Roster } from "./roster";
import { controls } from "./testWorld";
import { duelPair, stepDuel } from "./testDuel";


const run = (world: Roster, frames: number, first: Readonly<Controls> = controls(), second: Readonly<Controls> = controls()) => {
  for (let f = 0; f < frames; f++) stepDuel(world, first, second);
};

function airborne(character: Character, z: number, gap = 900.0, targetZ = 0.0): { world: Roster; owner: Fighter; target: Fighter } {
  const owner = createFighter(character, 0.0, 1);
  const target = createFighter(Character.rifleman, gap, -1);
  const { world } = duelPair(owner, target);
  owner.motion.grounded = false;
  owner.motion.surface = undefined;
  owner.motion.z = z;
  owner.motion.vz = 0.0;
  if (targetZ !== 0.0) {
    target.motion.grounded = false;
    target.motion.surface = undefined;
    target.motion.z = targetZ;
  }
  return { world, owner, target };
}

const upB = controls({ specialPressed: true, specialZ: 1, verticalDirection: 1 });
const recoils = (f: Fighter) => f.projectiles.filter((p) => p.life > 0 && p.kind === ProjectileKind.recoil);

function firstShot(stick: Readonly<Controls>): { vx: number; vz: number; shotX: number; shotZ: number } {
  const { world, owner } = airborne(Character.rifleman, 400.0);
  stepDuel(world, upB);
  run(world, 3, stick);
  const shot = recoils(owner)[0];
  return { vx: owner.motion.vx, vz: owner.motion.vz, shotX: shot?.velocityX ?? 0.0, shotZ: shot?.velocityZ ?? 0.0 };
}

test("Recoil shot: the stick through frame 4 picks one of eight directions (up when neutral), and the shot fires the opposite way [k3 measure #127]", () => {
  const up = firstShot(controls());
  assertEquals(up.vx, 0.0);
  assertGreaterThan(up.vz, 25.0);
  assertLessThan(up.shotZ, 0.0);
  const down = firstShot(controls({ verticalDirection: -1, down: true }));
  assertEquals(down.vx, 0.0);
  assertLessThan(down.vz, -25.0);
  assertGreaterThan(down.shotZ, 0.0);
  for (const side of [-1, 1]) {
    for (const vertical of [1, 0, -1]) {
      const shot = firstShot(controls({ direction: side, verticalDirection: vertical, down: vertical < 0 }));
      assertGreaterThan(f32(shot.vx * side), 15.0);
      assertLessThan(f32(shot.shotX * side), 0.0);
      if (vertical === 0) {
        assertGreaterThan(f32(shot.vx * side), 25.0);
        assertLessThan(Math.abs(shot.vz), 3.0);
        assertEquals(shot.shotZ, 0.0);
      } else {
        assertGreaterThan(f32(shot.vz * vertical), 15.0);
        assertLessThan(f32(shot.shotZ * vertical), 0.0);
      }
    }
  }
});

