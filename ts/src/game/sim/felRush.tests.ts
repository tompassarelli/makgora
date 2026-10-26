import { assertEquals, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Character, SpecialAction } from "./codes";
import { type Fighter, createFighter } from "./fighter";
import { type Controls, type Roster } from "./roster";
import { FEL_RUSH_FIRST, FEL_RUSH_LAST, FEL_RUSH_SPEED, FEL_RUSH_TELL_LAST } from "./specials";
import { controls } from "./testWorld";
import { duelPair, lift, stepDuel } from "./testDuel";

const HEIGHT = 900.0;
const RUSH_LENGTH = f32(FEL_RUSH_SPEED * (FEL_RUSH_LAST - FEL_RUSH_FIRST + 1));
const sideB = (x: number): Controls => controls({ specialPressed: true, specialX: x, direction: x });
const held = (x: number, z: number): Controls => controls({ direction: x, verticalDirection: z, down: z < 0 });
const DIRECTIONS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]] as const;

interface Rush { readonly started: boolean; readonly dx: number; readonly dz: number }

function illidan(z: number): { world: Roster; owner: Fighter; target: Fighter } {
  const pair = duelPair(createFighter(Character.demonHunter, 0.0, 1), createFighter(Character.rifleman, -900.0, 1));
  if (z > 0.0) lift(pair.owner, z);
  return pair;
}

function settle(world: Roster, owner: Fighter, z: number): void {
  for (let frame = 0; frame < 80 && (owner.special.action !== SpecialAction.none || (owner.special.cooldowns[SpecialAction.demonHunterFelRush] ?? 0) > 0); frame++) {
    if (z > 0.0) lift(owner, z);
    stepDuel(world);
  }
  if (z > 0.0) lift(owner, z);
}

function rush(world: Roster, owner: Fighter, side: number, x: number, z: number, onLine?: (startX: number, startZ: number) => void): Rush {
  stepDuel(world, sideB(side));
  if (owner.special.action !== SpecialAction.demonHunterFelRush) return { started: false, dx: 0.0, dz: 0.0 };
  const startX = owner.motion.x, startZ = owner.motion.z;
  while (owner.special.action === SpecialAction.demonHunterFelRush && owner.special.frame < FEL_RUSH_TELL_LAST) stepDuel(world, held(x, z));
  while (owner.special.action === SpecialAction.demonHunterFelRush && owner.special.frame < FEL_RUSH_LAST) {
    onLine?.(startX, startZ);
    stepDuel(world, held(x, z));
  }
  return { started: true, dx: f32(owner.motion.x - startX), dz: f32(owner.motion.z - startZ) };
}

function assertTravels(result: Rush, x: number, z: number): void {
  assertTrue(result.started);
  const length = Math.sqrt(result.dx * result.dx + result.dz * result.dz);
  assertGreaterThan(length, f32(RUSH_LENGTH * f32(0.85)));
  assertLessThan(length, f32(RUSH_LENGTH * f32(1.15)));
  const along = f32(f32(result.dx * x) + f32(result.dz * z));
  assertGreaterThan(along, f32(f32(length * f32(0.95)) * (x !== 0 && z !== 0 ? f32(Math.SQRT2) : 1.0)));
}

function secondRush(x: number, z: number, onLine?: (target: Fighter, startX: number, startZ: number) => void): { first: Rush; second: Rush; third: Rush; target: Fighter } {
  const { world, owner, target } = illidan(HEIGHT);
  const first = rush(world, owner, 1, 0, 1);
  settle(world, owner, HEIGHT);
  const second = rush(world, owner, 1, x, z, onLine === undefined ? undefined : (startX, startZ) => onLine(target, startX, startZ));
  settle(world, owner, HEIGHT);
  const third = rush(world, owner, 1, 0, 0);
  return { first, second, third, target };
}

test("Fel Rush: the first air rush flies level even with the stick held up, the second goes the way the stick points on its last tell frame in all 8 directions, and a third in the same airtime is refused [k3 measure #520]", () => {
  for (const [x, z] of DIRECTIONS) {
    const { first, second, third } = secondRush(x, z);
    assertTravels(first, 1, 0);
    assertTravels(second, x, z);
    assertEquals(third.started, false);
  }
});

test("Fel Rush: a neutral second air rush flies level in his facing [k3 measure #520]", () => {
  const { second } = secondRush(0, 0);
  assertTravels(second, 1, 0);
});

test("Fel Rush: the aimed second rush strikes a foe placed on its line in each of the 8 directions [k3 measure #520]", () => {
  for (const [x, z] of DIRECTIONS) {
    const scale = x !== 0 && z !== 0 ? f32(Math.SQRT1_2) : 1.0;
    const { target } = secondRush(x, z, (foe, startX, startZ) => {
      foe.motion.x = f32(startX + f32(f32(x * f32(RUSH_LENGTH * 0.5)) * scale));
      lift(foe, f32(startZ + f32(f32(z * f32(RUSH_LENGTH * 0.5)) * scale)));
    });
    assertGreaterThan(target.status.damage, 0.0);
  }
});

test("Fel Rush: grounded rushes stay level with the stick picking the side, whatever the stick holds on the tell's last frame [k3 measure #520]", () => {
  for (const side of [1, -1]) {
    for (const [x, z] of [[0, 0], [0, 1], [side, 1], [-side, 0]] as const) {
      const { world, owner } = illidan(0.0);
      const result = rush(world, owner, side, x, z);
      assertTravels(result, side, 0);
      assertEquals(owner.facing, side);
      assertTrue(owner.motion.grounded);
      assertEquals(owner.special.airtimeUses, 0);
    }
  }
});
