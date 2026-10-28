import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Character, LedgeState, SpecialAction } from "./codes";
import { type Fighter, createFighter } from "./fighter";
import { ledgeCatchBox } from "./ledge";
import { type Roster } from "./roster";
import { mainDeckLeft, mainDeckRight, mainDeckZ } from "./stage";
import { duelPair, lift, stepDuel } from "./testDuel";
import { controls } from "./testWorld";

const DASHERS = [Character.warden, Character.demonHunter] as const;
const SIDES = [-1, 1] as const;
const FRAME_LIMIT = 240;

interface Caught { readonly world: Roster; readonly dasher: Fighter }

function offStage(character: Character, side: number, outside: number, z: number): Caught {
  const edge = side < 0 ? mainDeckLeft(0) : mainDeckRight(0);
  const dasher = createFighter(character, f32(edge + f32(side * outside)), -side);
  const { world } = duelPair(dasher, createFighter(Character.rifleman, 0.0, 1));
  lift(dasher, z);
  dasher.motion.x = f32(edge + f32(side * outside));
  dasher.facing = -side;
  return { world, dasher };
}

function catchHeight(character: Character): number {
  const box = ledgeCatchBox(character);
  return f32(mainDeckZ(0) - f32(f32(box.lowest + box.highest) * 0.5));
}

function stepUntilHang(world: Roster, dasher: Fighter): { readonly action: number; readonly fall: boolean } {
  let action: number = dasher.special.action, fall = dasher.special.fall;
  for (let frame = 0; frame < FRAME_LIMIT && dasher.ledge.state !== LedgeState.hang; frame++) {
    action = dasher.special.action;
    fall = dasher.special.fall;
    stepDuel(world);
  }
  return { action, fall };
}

test("A side special toward the ledge from off stage at ledge height catches it mid-dash, for Maiev and Illidan facing either way [k1 scenario]", () => {
  for (const character of DASHERS) {
    for (const side of SIDES) {
      const { world, dasher } = offStage(character, side, f32(ledgeCatchBox(character).reach * 4.0), catchHeight(character));
      stepDuel(world, controls({ specialPressed: true, specialX: -side, direction: -side }));
      assertTrue(dasher.special.action !== SpecialAction.none);
      const before = stepUntilHang(world, dasher);
      assertEquals(dasher.ledge.state, LedgeState.hang);
      assertEquals(dasher.ledge.side, side);
      assertTrue(before.action !== SpecialAction.none);
    }
  }
});

test("A side special that ends off stage leaves the fighter helpless, and the helpless fall past the ledge catches it, for Maiev and Illidan facing either way [k1 scenario]", () => {
  for (const character of DASHERS) {
    for (const side of SIDES) {
      const { world, dasher } = offStage(character, side, 700.0, 900.0);
      stepDuel(world, controls({ specialPressed: true, specialX: -side, direction: -side }));
      for (let frame = 0; frame < FRAME_LIMIT && dasher.special.action !== SpecialAction.none; frame++) stepDuel(world);
      assertTrue(dasher.special.fall);
      assertEquals(dasher.facing, -side);
      const edge = side < 0 ? mainDeckLeft(0) : mainDeckRight(0);
      dasher.motion.x = f32(edge + f32(side * f32(ledgeCatchBox(character).reach * 0.5)));
      dasher.motion.vx = 0.0;
      const before = stepUntilHang(world, dasher);
      assertEquals(dasher.ledge.state, LedgeState.hang);
      assertEquals(dasher.ledge.side, side);
      assertTrue(before.fall);
    }
  }
});
