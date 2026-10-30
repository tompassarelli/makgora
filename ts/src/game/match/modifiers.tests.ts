import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { createBufferedFrameControls } from "./controls";
import { createMatchState, Phase } from "../lobby/lobbyState";
import { stepMatch } from "./step";
import { Character, SpecialAction } from "../sim/codes";
import { type Fighter, createFighter } from "../sim/fighter";
import { createRoster } from "../sim/roster";
import { DEMONHUNTER_WING_STARTUP } from "../sim/specials";
import { MOD_X_UP_DIAGONAL, MOD_Y_DIAGONAL, TILT_STICK_X, tiltStickX, tiltStickZ } from "../sim/stick";
import { lift } from "../sim/testDuel";
import { Action, bit } from "../input/actions";
import { adaptInput } from "./inputAdapter";
import { commitEdges, keyboardCapture, sampleKeys } from "../input/keyboardCapture";

const X = bit(Action.modX), Y = bit(Action.modY), B = bit(Action.special), A = bit(Action.attack);
const R = bit(Action.moveRight), L = bit(Action.moveLeft), U = bit(Action.moveUp), D = bit(Action.moveDown);

function session(character: Character, facing: number) {
  const game = createMatchState();
  game.phase = Phase.match;
  const owner = createFighter(character, 0.0, facing);
  const world = createRoster(3, [owner, createFighter(Character.rifleman, 1500.0, -1)]);
  const frameControls = createBufferedFrameControls();
  const capture = keyboardCapture();
  let frame = 0;
  const press = (held: number) => {
    frame++;
    sampleKeys(capture, held);
    adaptInput(capture.row, owner, frame, frameControls.inputs[0], frameControls.commands[0]);
    commitEdges(capture);
    const controls = frameControls.inputs[0];
    const stick = { x: controls.diStickX, z: controls.diStickZ, drift: controls.driftStickX, direction: controls.direction, vertical: controls.verticalDirection };
    stepMatch(game, world, frameControls, frame);
    return stick;
  };
  return { owner, press };
}

const near = (actual: number, expected: number) => Math.abs(actual - expected) < f32(0.000001);


const SIDES = [[R, 1], [L, -1]] as const;

function degrees(stick: { x: number; z: number }): number {
  return Math.atan2(Math.abs(stick.z), Math.abs(stick.x)) * 180 / Math.PI;
}

test("Mod X with up and either side sends the steep up-diagonal, 0.3125 across and 0.7375 up, on both sides and facings, and leaves the press direction alone [k2 property]", () => {
  for (const facing of [1, -1]) {
    for (const [side, sign] of SIDES) {
      const stick = session(Character.rifleman, facing).press(X | U | side);
      assertEquals(stick.x, f32(sign * MOD_X_UP_DIAGONAL.x), `facing ${facing} side ${sign}`);
      assertEquals(stick.z, MOD_X_UP_DIAGONAL.z);
      assertEquals(stick.drift, stick.x);
      assertEquals(stick.direction, sign);
      assertEquals(stick.vertical, 1);
    }
  }
  assertTrue(Math.abs(degrees(MOD_X_UP_DIAGONAL) - 67) < 0.5);
  assertEquals(MOD_X_UP_DIAGONAL.x, MOD_Y_DIAGONAL.z);
  assertEquals(MOD_X_UP_DIAGONAL.z, MOD_Y_DIAGONAL.x);
});

test("Mod X alone reduces only the horizontal value to the tilt value and leaves the vertical value full, including on down diagonals [k2 property]", () => {
  for (const [side, sign] of SIDES) {
    const alone = session(Character.rifleman, 1).press(X | side);
    assertEquals(alone.x, f32(sign * TILT_STICK_X));
    assertEquals(alone.drift, alone.x);
    assertEquals(alone.z, 0);
    const down = session(Character.rifleman, 1).press(X | D | side);
    const plain = session(Character.rifleman, 1).press(D | side);
    assertEquals(down.x, tiltStickX(plain.x));
    assertEquals(down.z, plain.z);
  }
  assertEquals(session(Character.rifleman, 1).press(X | U).z, 1);
  assertEquals(session(Character.rifleman, 1).press(X | D).z, -1);
  assertEquals(session(Character.rifleman, 1).press(X).x, 0);
});

test("Mod Y with a side and up or down sends the shallow diagonal, 0.7375 across and 0.3125 up or down, on both sides and facings, and leaves the press direction alone [k2 property]", () => {
  for (const facing of [1, -1]) {
    for (const [side, sign] of SIDES) {
      for (const [vertical, updown] of [[U, 1], [D, -1]] as const) {
        const stick = session(Character.rifleman, facing).press(Y | vertical | side);
        assertEquals(stick.x, f32(sign * MOD_Y_DIAGONAL.x), `facing ${facing} side ${sign} vertical ${updown}`);
        assertEquals(stick.z, f32(updown * MOD_Y_DIAGONAL.z));
        assertEquals(stick.drift, stick.x);
        assertEquals(stick.direction, sign);
        assertEquals(stick.vertical, updown);
      }
    }
  }
  assertTrue(Math.abs(degrees(MOD_Y_DIAGONAL) - 23) < 0.5);
});

test("Mod Y alone reduces only the vertical value to the tilt value and leaves the horizontal value full [k2 property]", () => {
  assertEquals(session(Character.rifleman, 1).press(Y | U).z, tiltStickZ(1));
  assertEquals(session(Character.rifleman, 1).press(Y | D).z, tiltStickZ(-1));
  for (const [side, sign] of SIDES) {
    const alone = session(Character.rifleman, 1).press(Y | side);
    assertEquals(alone.x, sign);
    assertEquals(alone.z, 0);
  }
  assertEquals(session(Character.rifleman, 1).press(Y).z, 0);
});

test("Mod X and Mod Y together reduce both axes to today's walk and tilt values on every direction and send no special diagonal [k2 property]", () => {
  for (const [side, sign] of SIDES) {
    for (const vertical of [U, D]) {
      const plain = session(Character.rifleman, 1).press(vertical | side);
      const both = session(Character.rifleman, 1).press(X | Y | vertical | side);
      assertEquals(both.x, tiltStickX(plain.x));
      assertEquals(both.z, tiltStickZ(plain.z));
      assertTrue(Math.abs(both.x) < Math.abs(plain.x) && Math.abs(both.z) < Math.abs(plain.z));
      assertEquals(both.drift, tiltStickX(plain.drift ?? 0));
    }
    assertEquals(session(Character.rifleman, 1).press(X | Y | side).x, f32(sign * TILT_STICK_X));
  }
  assertEquals(session(Character.rifleman, 1).press(X | Y | U).z, tiltStickZ(1));
  assertEquals(session(Character.rifleman, 1).press(X | Y | D).z, tiltStickZ(-1));
});

test("Demon Hunter's Wing Ascent climbs along the angle given: shallow with Mod Y, steep with Mod X, on both facings, and steeper than the shallow one without either [k1 scenario]", () => {
  const length = Math.sqrt(MOD_Y_DIAGONAL.x * MOD_Y_DIAGONAL.x + MOD_Y_DIAGONAL.z * MOD_Y_DIAGONAL.z);
  const launch = (facing: number, held: number): Fighter => {
    const { owner, press } = session(Character.demonHunter, facing);
    lift(owner, 900.0);
    press(held | B);
    while (owner.special.action === SpecialAction.demonHunterWingAscent && owner.special.frame <= DEMONHUNTER_WING_STARTUP) press(held);
    assertEquals(owner.special.action, SpecialAction.demonHunterWingAscent);
    return owner;
  };
  for (const facing of [1, -1]) {
    for (const [side, sign] of SIDES) {
      const shallow = launch(facing, Y | U | side);
      assertTrue(near(shallow.special.aimX, sign * MOD_Y_DIAGONAL.x / length));
      assertTrue(near(shallow.special.aimZ, MOD_Y_DIAGONAL.z / length));
      assertEquals(shallow.facing, sign);
      const steep = launch(facing, X | U | side);
      assertTrue(near(steep.special.aimX, sign * MOD_X_UP_DIAGONAL.x / length));
      assertTrue(near(steep.special.aimZ, MOD_X_UP_DIAGONAL.z / length));
      assertTrue(steep.special.aimZ > shallow.special.aimZ * 2);
      const plain = launch(facing, U | side);
      assertTrue(plain.special.aimZ > shallow.special.aimZ * 1.5);
    }
  }
});
