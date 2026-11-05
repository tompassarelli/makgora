import { assertEquals, test } from "wisp/src/runtime/testing";
import { createBufferedFrameControls } from "./controls";
import { createMatchState, Phase } from "../lobby/lobbyState";
import { stepMatch } from "./step";
import { AttackStyle, Character, GroundAction } from "../sim/codes";
import { type Fighter, createFighter } from "../sim/fighter";
import { createRoster } from "../sim/roster";
import { Action, bit } from "../input/actions";
import { adaptInput } from "./inputAdapter";
import { commitEdges, keyboardCapture, sampleKeys } from "../input/keyboardCapture";

const A = bit(Action.attack);
const R = bit(Action.moveRight);
const CR = bit(Action.cRight), CL = bit(Action.cLeft), CU = bit(Action.cUp), CD = bit(Action.cDown);

interface Keyboard {
  readonly owner: Fighter;
  readonly press: (this: void, held: number) => void;
}

function keyboard(facing: 1 | -1): Keyboard {
  const game = createMatchState();
  game.phase = Phase.match;
  const owner = createFighter(Character.rifleman, 0.0, facing);
  const world = createRoster(3, [owner, createFighter(Character.rifleman, 1500.0 * facing, -facing)]);
  const frameControls = createBufferedFrameControls();
  const capture = keyboardCapture();
  let frame = 0;
  const press = (held: number) => {
    frame++;
    sampleKeys(capture, held);
    adaptInput(capture.row, owner, frame, frameControls.inputs[0], frameControls.commands[0]);
    commitEdges(capture);
    stepMatch(game, world, frameControls, frame);
  };
  for (let i = 0; i < 3; i++) press(0);
  return { owner, press };
}

const groundTilt = (key: number): AttackStyle => key === CU ? AttackStyle.upTilt : key === CD ? AttackStyle.downTilt : AttackStyle.forwardTilt;

test("a C-stick press out of a dash, a run or a run brake is the tilt it names: the fighter stops and tilts on the press frame, and A with a direction there stays the dash attack [k1 scenario]", () => {
  for (const key of [CR, CL, CU, CD]) {
    for (const run of [1, 60]) {
      const { owner, press } = keyboard(1);
      press(R);
      for (let i = 1; i < run && owner.ground.action !== GroundAction.run; i++) press(R);
      assertEquals(owner.ground.action, run === 1 ? GroundAction.dash : GroundAction.run);
      press(R | key);
      assertEquals(owner.attack.style, groundTilt(key));
      assertEquals(owner.attack.frame, 0);
      assertEquals(owner.motion.vx, 0.0);
      assertEquals(owner.facing, key === CL ? -1 : 1);
    }
    const brake = keyboard(1);
    for (let i = 0; i < 60 && brake.owner.ground.action !== GroundAction.run; i++) brake.press(R);
    brake.press(0);
    assertEquals(brake.owner.ground.action, GroundAction.runBrake);
    brake.press(key);
    assertEquals(brake.owner.attack.style, groundTilt(key));
  }
  const a = keyboard(1);
  for (let i = 0; i < 60 && a.owner.ground.action !== GroundAction.run; i++) a.press(R);
  a.press(R | A);
  assertEquals(a.owner.attack.style, AttackStyle.dashAttack);
});
