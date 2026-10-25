import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { createBufferedFrameControls } from "../match/controls";
import { createMatchState, Phase } from "../lobby/lobbyState";
import { stepMatch } from "../match/step";
import { AttackStyle, Character, GroundAction } from "../sim/codes";
import { type Fighter, createFighter } from "../sim/fighter";
import { createRoster } from "../sim/roster";
import { DASH_FLICK_SAMPLES } from "../sim/stickZones";
import { lift } from "../sim/testDuel";
import { Action, bit } from "./actions";
import { adaptInput } from "./adapter";
import { hasPendingAttack } from "./attackBuffer";
import { commitEdges, keyboardCapture, sampleKeys } from "./keyboardCapture";

const A = bit(Action.attack), S = bit(Action.strong), B = bit(Action.special), G = bit(Action.grab), W = bit(Action.walk), T = bit(Action.leftTrigger);
const R = bit(Action.moveRight), L = bit(Action.moveLeft), U = bit(Action.moveUp), D = bit(Action.moveDown);

interface Keyboard {
  readonly owner: Fighter;
  readonly press: (this: void, held: number) => { readonly queued: boolean; readonly ex: boolean; readonly direction: number };
}

function keyboard(): Keyboard {
  const game = createMatchState();
  game.phase = Phase.match;
  const owner = createFighter(Character.rifleman, 0.0, 1);
  const world = createRoster(3, [owner, createFighter(Character.rifleman, 1500.0, -1)]);
  const frameControls = createBufferedFrameControls();
  const capture = keyboardCapture();
  let frame = 0;
  const press = (held: number) => {
    frame++;
    sampleKeys(capture, held);
    adaptInput(capture.row, owner, frame, frameControls.inputs[0], frameControls.commands[0]);
    commitEdges(capture);
    const result = { queued: hasPendingAttack(frameControls.commands[0], frame), ex: frameControls.inputs[0].exPressed, direction: frameControls.inputs[0].direction };
    stepMatch(game, world, frameControls, frame);
    return result;
  };
  for (let i = 0; i < 3; i++) press(0);
  return { owner, press };
}

const smashFor = (key: number): AttackStyle => key === U ? AttackStyle.upSmash : key === D ? AttackStyle.downSmash : AttackStyle.forwardSmash;

test("Strong held makes each direction press that direction's smash on the press frame, standing or from a walk, with no walk, dash, turn-run or jump first, charging while held [k1 scenario]", () => {
  for (const walk of [false, true]) {
    for (const key of [R, L, U, D]) {
      const { owner, press } = keyboard();
      if (walk) for (let i = 0; i < 12; i++) press(W | R);
      const modifier = walk ? W : 0;
      press(modifier | S);
      press(modifier | S);
      const x = owner.motion.x;
      press(modifier | S | key);
      assertEquals(owner.attack.style, smashFor(key));
      assertEquals(owner.attack.frame, 0);
      assertEquals(owner.ground.action, GroundAction.none);
      assertEquals(owner.jump.squat, 0);
      assertEquals(owner.facing, key === L ? -1 : 1);
      if (!walk) assertEquals(owner.motion.x, x);
      let charged = false;
      for (let i = 0; i < 20; i++) { press(modifier | S | key); charged ||= owner.attack.smashCharging; }
      assertTrue(charged);
    }
  }
});

test("Strong on a direction's press frame or within the DASH_FLICK_SAMPLES window after it starts that smash with at most that many frames of movement and no dash [k1 scenario]", () => {
  for (const key of [R, L, U, D]) {
    for (let late = 0; late < DASH_FLICK_SAMPLES; late++) {
      const { owner, press } = keyboard();
      let moved = 0;
      for (let i = 0; i < late; i++) { const x = owner.motion.x; press(key); if (owner.motion.x !== x) moved++; }
      press(key | S);
      assertEquals(owner.attack.style, smashFor(key));
      assertEquals(owner.ground.action, GroundAction.none);
      assertEquals(owner.motion.vx, 0.0);
      assertTrue(moved <= late);
      const x = owner.motion.x;
      for (let i = 0; i < 10; i++) press(key | S);
      assertEquals(owner.motion.x, x);
    }
  }
});

test("Strong + A with no direction is the forward smash the way the fighter faces, and in the air Strong + A + direction stays that aerial while Strong + direction alone stays nothing [k1 scenario]", () => {
  const neutral = keyboard();
  neutral.owner.facing = -1;
  neutral.press(S | A);
  assertEquals(neutral.owner.attack.style, AttackStyle.forwardSmash);
  assertEquals(neutral.owner.facing, -1);
  const lone = keyboard();
  assertFalse(lone.press(S).queued);
  for (const [key, style] of [[R, AttackStyle.forwardAir], [L, AttackStyle.backAir], [U, AttackStyle.upAir], [D, AttackStyle.downAir]] as const) {
    const air = keyboard();
    lift(air.owner, f32(400.0));
    air.press(S);
    assertFalse(air.press(S | key).queued);
    assertEquals(air.owner.attack.style, undefined);
    air.press(S | key | A);
    assertEquals(air.owner.attack.style, style);
  }
});

test("While Strong is held on the ground a held direction does not move the fighter, and releasing Strong dashes it on the next frame [k1 scenario]", () => {
  const { owner, press } = keyboard();
  press(S | R);
  for (let i = 0; i < 240 && owner.attack.style !== undefined; i++) press(S | R);
  assertEquals(owner.attack.style, undefined);
  const x = owner.motion.x;
  for (let i = 0; i < 10; i++) assertEquals(press(S | R).direction, 0);
  assertEquals(owner.motion.x, x);
  assertEquals(press(R).direction, 1);
  assertTrue(owner.motion.vx > 0.0);
});

test("With Strong held the tilt modifier still tilts with A, shield still rolls, grab still grabs and Special casts the EX without a smash [k1 scenario]", () => {
  const tilt = keyboard();
  tilt.press(W | R | A);
  assertEquals(tilt.owner.attack.style, AttackStyle.forwardTilt);
  const roll = keyboard();
  for (let i = 0; i < 8; i++) roll.press(S | T);
  assertTrue(roll.owner.shield.raised);
  roll.press(S | T | R);
  roll.press(S | T | R);
  assertTrue(roll.owner.dodge.groundFrame > 0);
  assertEquals(roll.owner.attack.style, undefined);
  const grab = keyboard();
  grab.press(S);
  grab.press(S | G);
  assertEquals(grab.owner.attack.style, AttackStyle.grab);
  for (const key of [0, R, U, D]) {
    const ex = keyboard();
    ex.press(S);
    const cast = ex.press(S | key | B);
    assertTrue(cast.ex);
    assertFalse(cast.queued);
  }
});
