import { assertDefined, assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, Character } from "../sim/codes";
import { type Fighter, createFighter } from "../sim/fighter";
import { type Controls, neutralControls } from "../sim/roster";
import { TILT_STICK_DOWN, TILT_STICK_UP, TILT_STICK_X } from "../sim/stick";
import { CROUCH_STICK_THRESHOLD, DASH_STICK_THRESHOLD, GroundState, SHIELD_DODGE_STICK_THRESHOLD, StickZone, TAP_JUMP_STICK_THRESHOLD, stickZone } from "../sim/stickZones";
import { advanceSolo } from "../sim/testWorld";
import { Action, maskOf } from "../input/actions";
import { adaptInput } from "./inputAdapter";
import { attackBuffer, takeAttack } from "../input/attackBuffer";
import { inputRow } from "../input/inputRow";
import { commitEdges, keyboardCapture, sampleKeys } from "../input/keyboardCapture";

const STICK_UNIT = f32(0.0125);
const STAGE = 1;
const SIDES = [Action.moveLeft, Action.moveRight];
const VERTICALS = [Action.moveUp, Action.moveDown];
const EIGHT_WAYS = [...SIDES.map(side => [side]), ...VERTICALS.map(vertical => [vertical]), ...SIDES.flatMap(side => VERTICALS.map(vertical => [side, vertical]))];

function keyboardDriver(fighter: Fighter) {
  const capture = keyboardCapture();
  const input = neutralControls();
  const attacks = attackBuffer(0);
  let frame = 0;
  return {
    input, attacks,
    sample(held: number): Readonly<Controls> {
      frame++;
      sampleKeys(capture, held);
      adaptInput(capture.row, fighter, frame, input, attacks);
      commitEdges(capture);
      return input;
    },
    step(held: number) { advanceSolo(fighter, STAGE, this.sample(held), 0.0); },
    attack() { return takeAttack(attacks, frame, true)?.style; },
  };
}

const tilt = (...actions: Action[]) => maskOf(Action.modX, Action.modY, ...actions);

test("the tilt modifier sends each axis one Melee stick unit inside roll and spot dodge, tap jump and crouch, and still picks walk and the tilts [k3 measure #282]", () => {
  for (const [threshold, value] of [[SHIELD_DODGE_STICK_THRESHOLD, TILT_STICK_X], [TAP_JUMP_STICK_THRESHOLD, TILT_STICK_UP], [CROUCH_STICK_THRESHOLD, TILT_STICK_DOWN]] as const) {
    assertTrue(value < threshold && Math.abs(threshold - value - STICK_UNIT) < f32(1e-6));
  }
  assertTrue(TILT_STICK_DOWN < SHIELD_DODGE_STICK_THRESHOLD && TILT_STICK_X < DASH_STICK_THRESHOLD);
  const fighter = createFighter(Character.rifleman, 0.0, 1);
  const cases = [
    { key: Action.moveRight, x: TILT_STICK_X, z: 0, style: AttackStyle.forwardTilt },
    { key: Action.moveLeft, x: -TILT_STICK_X, z: 0, style: AttackStyle.forwardTilt },
    { key: Action.moveUp, x: 0, z: TILT_STICK_UP, style: AttackStyle.upTilt },
    { key: Action.moveDown, x: 0, z: -TILT_STICK_DOWN, style: AttackStyle.downTilt },
  ];
  for (const { key, x, z, style } of cases) {
    const driver = keyboardDriver(fighter);
    driver.sample(0);
    const input = driver.sample(tilt(key, Action.attack));
    assertEquals(input.diStickX, x, `key ${key}: x`);
    assertEquals(input.diStickZ, z, `key ${key}: z`);
    assertEquals(input.driftStickX, x, `key ${key}: drift`);
    assertFalse(input.down);
    assertEquals(driver.attack(), style, `key ${key}: attack`);
    const zone = stickZone(input.diStickX, input.diStickZ, 0, 0, 1, GroundState.stand);
    assertTrue(zone !== StickZone.jump && zone !== StickZone.crouch && zone !== StickZone.dashFast && zone !== StickZone.dashSlow && zone !== StickZone.smashTurn);
  }
  for (const keys of EIGHT_WAYS.filter(keys => keys.length === 2)) {
    const input = keyboardDriver(fighter).sample(tilt(...keys));
    assertTrue(input.diStickX !== 0 && Math.abs(input.diStickX) <= TILT_STICK_X);
    assertTrue(input.diStickZ !== 0 && input.diStickZ <= TILT_STICK_UP && input.diStickZ >= -TILT_STICK_DOWN);
    assertFalse(input.down);
  }
  const analog = neutralControls();
  adaptInput(assertDefined(inputRow({ held: tilt(), axisX: 127, axisZ: -127 })), fighter, 1, analog, attackBuffer(0));
  assertTrue(Math.abs(analog.diStickX) <= TILT_STICK_X && analog.diStickZ >= -TILT_STICK_DOWN);
});

