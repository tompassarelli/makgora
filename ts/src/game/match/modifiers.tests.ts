import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { createBufferedFrameControls } from "./controls";
import { createMatchState, Phase } from "../lobby/lobbyState";
import { stepMatch } from "./step";
import { Character } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { createRoster } from "../sim/roster";
import { MOD_X_UP_DIAGONAL, MOD_Y_DIAGONAL } from "../sim/stick";
import { Action, bit } from "../input/actions";
import { adaptInput } from "./inputAdapter";
import { commitEdges, keyboardCapture, sampleKeys } from "../input/keyboardCapture";

const X = bit(Action.modX);
const R = bit(Action.moveRight), L = bit(Action.moveLeft), U = bit(Action.moveUp);

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

