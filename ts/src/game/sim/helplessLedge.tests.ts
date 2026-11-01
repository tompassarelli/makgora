import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Character, LedgeState, SpecialAction } from "./codes";
import { type Fighter, createFighter } from "./fighter";
import { ledgeCatchBox } from "./ledge";
import { type Controls, type Roster } from "./roster";
import { mainDeckLeft, mainDeckRight, mainDeckZ } from "./stage";
import { duelPair, lift, stepDuel } from "./testDuel";
import { controls } from "./testWorld";

const SIDES = [-1, 1] as const;
const SPAWN_OUTSIDE = 700.0;
const SPAWN_HEIGHT = 1400.0;
const FRAME_LIMIT = 300;
const FALL_SPEED = 16.0;

interface Source {
  readonly character: Character;
  readonly press: (side: number) => Partial<Controls>;
}

const sideSpecial = (side: number): Partial<Controls> => ({ specialPressed: true, specialX: -side, direction: -side });

const SOURCES: readonly Source[] = [
  { character: Character.dreadlord, press: sideSpecial },
  { character: Character.demonHunter, press: sideSpecial },
  { character: Character.warden, press: sideSpecial },
  { character: Character.medivh, press: () => ({ specialPressed: true, specialZ: -1, down: true }) },
];

interface Helpless { readonly world: Roster; readonly f: Fighter; readonly side: number }

function edgeOf(side: number): number {
  return side < 0 ? mainDeckLeft(0) : mainDeckRight(0);
}

function justHelpless(source: Source, side: number): Helpless {
  const edge = edgeOf(side);
  const f = createFighter(source.character, f32(edge + f32(side * SPAWN_OUTSIDE)), -side);
  const { world } = duelPair(f, createFighter(Character.rifleman, 0.0, 1));
  lift(f, SPAWN_HEIGHT);
  f.motion.x = f32(edge + f32(side * SPAWN_OUTSIDE));
  f.facing = -side;
  stepDuel(world, controls(source.press(side)));
  for (let frame = 0; frame < FRAME_LIMIT && !(f.special.fall && f.special.action === SpecialAction.none); frame++) stepDuel(world);
  return { world, f, side };
}

function intoCatchBox(h: Helpless): void {
  const { f, side } = h;
  const box = ledgeCatchBox(f.character);
  f.motion.x = f32(edgeOf(side) + f32(side * f32(box.reach * 0.5)));
  f.motion.z = f32(mainDeckZ(0) - f32(f32(box.lowest + box.highest) * 0.5) + FALL_SPEED);
  f.motion.deltaX = 0.0;
  f.motion.deltaZ = f32(-FALL_SPEED);
  f.motion.vz = f32(-FALL_SPEED);
  f.motion.vx = 0.0;
  f.motion.grounded = false;
}

test("a fighter that has just gone helpless from an air special, a Dreadlord's whiffed Side B among them, catches the ledge it falls into on the next tick, facing either way [k1 scenario]", () => {
  for (const source of SOURCES) {
    for (const side of SIDES) {
      const h = justHelpless(source, side);
      assertTrue(h.f.special.fall);
      assertEquals(h.f.facing, -side);
      intoCatchBox(h);
      stepDuel(h.world);
      assertEquals(h.f.ledge.state, LedgeState.hang);
      assertEquals(h.f.ledge.side, side);
      assertFalse(h.f.special.fall);
    }
  }
});

test("a helpless fighter holding down refuses the ledge its fall crosses, and the same fall without down catches it [k1 scenario]", () => {
  for (const source of SOURCES) {
    const held = justHelpless(source, 1);
    intoCatchBox(held);
    stepDuel(held.world, controls({ down: true }));
    assertEquals(held.f.ledge.state, LedgeState.none);
    assertTrue(held.f.special.fall);
    const free = justHelpless(source, 1);
    intoCatchBox(free);
    stepDuel(free.world);
    assertEquals(free.f.ledge.state, LedgeState.hang);
  }
});

test("a helpless fighter under the regrab lock refuses the ledge its fall crosses until the lock ends [k1 scenario]", () => {
  for (const source of SOURCES) {
    const h = justHelpless(source, -1);
    intoCatchBox(h);
    h.f.ledge.regrab = 30;
    stepDuel(h.world);
    assertEquals(h.f.ledge.state, LedgeState.none);
    assertTrue(h.f.special.fall);
  }
});
