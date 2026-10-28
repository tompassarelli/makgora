import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { createBufferedFrameControls } from "./controls";
import { createMatchState, Phase } from "../lobby/lobbyState";
import { stepMatch } from "./step";
import { Character, SpecialAction } from "../sim/codes";
import { type Fighter, createFighter } from "../sim/fighter";
import { createRoster } from "../sim/roster";
import { DEMONHUNTER_WING_STARTUP } from "../sim/specials";
import { MOD_X_UP_DIAGONAL, tiltStickX, tiltStickZ } from "../sim/stick";
import { lift } from "../sim/testDuel";
import { Action, bit } from "../input/actions";
import { adaptInput } from "./inputAdapter";
import { commitEdges, keyboardCapture, sampleKeys } from "../input/keyboardCapture";

const M = bit(Action.modX), W = bit(Action.walk), B = bit(Action.special), A = bit(Action.attack);
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

test("Mod X with up and either side sends the shallow up-diagonal, 0.7375 across and 0.3125 up, for both sides and both facings, and leaves the press direction alone [k2 property]", () => {
  for (const facing of [1, -1]) {
    for (const [side, sign] of [[R, 1], [L, -1]] as const) {
      const { press } = session(Character.rifleman, facing);
      const stick = press(M | U | side);
      assertEquals(stick.x, f32(sign * MOD_X_UP_DIAGONAL.x), `facing ${facing} side ${sign}`);
      assertEquals(stick.z, MOD_X_UP_DIAGONAL.z);
      assertEquals(stick.drift, stick.x);
      assertEquals(stick.direction, sign);
      assertEquals(stick.vertical, 1);
    }
  }
  assertTrue(Math.abs(Math.atan2(MOD_X_UP_DIAGONAL.z, MOD_X_UP_DIAGONAL.x) * 180 / Math.PI - 23) < 0.5);
});

test("Mod X changes nothing for up alone, a side alone, down diagonals or no direction, and up with a side is the plain 45 degree diagonal without it [k2 property]", () => {
  for (const held of [M | U, M | R, M | L, M | D | R, M | D | L, M | D, M]) {
    const plain = session(Character.rifleman, 1).press(held & ~M);
    const modded = session(Character.rifleman, 1).press(held);
    assertEquals(modded.x, plain.x, `held ${held}`);
    assertEquals(modded.z, plain.z, `held ${held}`);
  }
  const diagonal = session(Character.rifleman, 1).press(U | R);
  assertTrue(near(diagonal.x, diagonal.z));
  assertTrue(diagonal.z > MOD_X_UP_DIAGONAL.z);
});

test("Mod X with the walk modifier keeps the walk scaling of each axis and only changes the angle, and attack with Mod X still reads the up and side presses [k2 property]", () => {
  for (const [side, sign] of [[R, 1], [L, -1]] as const) {
    const walking = session(Character.rifleman, 1).press(W | M | U | side);
    assertEquals(walking.x, tiltStickX(f32(sign * MOD_X_UP_DIAGONAL.x)));
    assertEquals(walking.z, tiltStickZ(MOD_X_UP_DIAGONAL.z));
    const plain = session(Character.rifleman, 1).press(W | U | side);
    assertTrue(Math.abs(plain.z) > Math.abs(walking.z));
  }
  const { owner, press } = session(Character.rifleman, 1);
  press(M | U | R | A);
  assertEquals(owner.facing, 1);
});

test("Demon Hunter's Wing Ascent launched with Mod X and up-forward or up-back climbs along the shallow angle on both facings, steeper without it [k1 scenario]", () => {
  const length = Math.sqrt(MOD_X_UP_DIAGONAL.x * MOD_X_UP_DIAGONAL.x + MOD_X_UP_DIAGONAL.z * MOD_X_UP_DIAGONAL.z);
  const launch = (facing: number, held: number): Fighter => {
    const { owner, press } = session(Character.demonHunter, facing);
    lift(owner, 900.0);
    press(held | B);
    while (owner.special.action === SpecialAction.demonHunterWingAscent && owner.special.frame <= DEMONHUNTER_WING_STARTUP) press(held);
    assertEquals(owner.special.action, SpecialAction.demonHunterWingAscent);
    return owner;
  };
  for (const facing of [1, -1]) {
    for (const [side, sign] of [[R, 1], [L, -1]] as const) {
      const shallow = launch(facing, M | U | side);
      assertTrue(near(shallow.special.aimX, sign * MOD_X_UP_DIAGONAL.x / length));
      assertTrue(near(shallow.special.aimZ, MOD_X_UP_DIAGONAL.z / length));
      assertEquals(shallow.facing, sign);
      const steep = launch(facing, U | side);
      assertTrue(steep.special.aimZ > f32(0.7) && steep.special.aimZ > shallow.special.aimZ * 1.5);
    }
  }
});
