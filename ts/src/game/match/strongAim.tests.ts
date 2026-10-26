import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { createBufferedFrameControls } from "./controls";
import { createMatchState, Phase } from "../lobby/lobbyState";
import { stepMatch } from "./step";
import { AttackStyle, Character, GroundAction } from "../sim/codes";
import { type Fighter, createFighter } from "../sim/fighter";
import { createRoster } from "../sim/roster";
import { DASH_SMASH_LAST_FRAME } from "../sim/stickZones";
import { lift } from "../sim/testDuel";
import { Action, bit } from "../input/actions";
import { adaptInput } from "./inputAdapter";
import { hasPendingAttack } from "../input/attackBuffer";
import { commitEdges, keyboardCapture, sampleKeys } from "../input/keyboardCapture";

const A = bit(Action.attack), S = bit(Action.strong), B = bit(Action.special), G = bit(Action.grab), W = bit(Action.walk), T = bit(Action.leftTrigger), J = bit(Action.jump);
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

test("Strong held while standing still or crouched makes each direction press that direction's smash in place on the press frame, with or without the walk modifier, with no walk, dash, turn-run or jump first, charging while held [k1 scenario]", () => {
  for (const modifier of [0, W]) {
    for (const key of [R, L, U, D]) {
      const { owner, press } = keyboard();
      press(modifier | S);
      press(modifier | S);
      const x = owner.motion.x;
      press(modifier | S | key);
      assertEquals(owner.attack.style, smashFor(key));
      assertEquals(owner.attack.frame, 0);
      assertEquals(owner.ground.action, GroundAction.none);
      assertEquals(owner.jump.squat, 0);
      assertEquals(owner.facing, key === L ? -1 : 1);
      assertEquals(owner.motion.x, x);
      let charged = false;
      for (let i = 0; i < 20; i++) { press(modifier | S | key); charged ||= owner.attack.smashCharging; }
      assertTrue(charged);
      assertEquals(owner.motion.x, x);
    }
  }
  const { owner, press } = keyboard();
  for (let i = 0; i < 6; i++) press(D);
  assertTrue(owner.motion.crouching);
  press(D | S);
  const x = owner.motion.x;
  press(D | S | R);
  assertEquals(owner.attack.style, AttackStyle.downSmash);
  assertEquals(owner.motion.x, x);
});

test("Strong and a direction pressed together while standing still start that smash in place with no dash [k1 scenario]", () => {
  for (const key of [R, L, U, D]) {
    const { owner, press } = keyboard();
    const x = owner.motion.x;
    press(key | S);
    assertEquals(owner.attack.style, smashFor(key));
    assertEquals(owner.ground.action, GroundAction.none);
    assertEquals(owner.motion.vx, 0.0);
    for (let i = 0; i < 10; i++) press(key | S);
    assertEquals(owner.motion.x, x);
  }
});

function runUntil(keyboard: Keyboard, held: number, reached: (this: void, owner: Fighter) => boolean): void {
  for (let i = 0; i < 60 && !reached(keyboard.owner); i++) keyboard.press(held);
  assertTrue(reached(keyboard.owner));
}

const running = (owner: Fighter): boolean => owner.ground.action === GroundAction.run;
const pastDashSmash = (owner: Fighter): boolean => owner.ground.action === GroundAction.dash && owner.ground.actionFrame > DASH_SMASH_LAST_FRAME;

test("While dashing or running, holding Strong, pressing it with a direction held or pressing a direction under it starts no attack and moves the fighter exactly as without Strong [k1 scenario]", () => {
  const presses = [R, R, R | U, R, R | D, R, L, L, L, R];
  for (const run of [false, true]) {
    const strong = keyboard(), plain = keyboard();
    strong.press(R);
    plain.press(R);
    if (run) {
      runUntil(plain, R, running);
      runUntil(strong, R, running);
    }
    for (const held of presses) {
      assertFalse(strong.press(held | S).queued);
      plain.press(held);
      assertEquals(strong.owner.attack.style, undefined);
      assertEquals(strong.owner.motion.x, plain.owner.motion.x);
      assertEquals(strong.owner.motion.vx, plain.owner.motion.vx);
      assertEquals(strong.owner.motion.z, plain.owner.motion.z);
      assertEquals(strong.owner.ground.action, plain.owner.ground.action);
      assertEquals(strong.owner.facing, plain.owner.facing);
      assertEquals(strong.owner.jump.squat, plain.owner.jump.squat);
    }
  }
});

test("Strong + A inside the dash-smash window gives that direction's smash [k1 scenario]", () => {
  for (const key of [0, U, D]) {
    const { owner, press } = keyboard();
    press(R);
    assertEquals(owner.ground.action, GroundAction.dash);
    assertTrue(owner.ground.actionFrame <= DASH_SMASH_LAST_FRAME);
    press(R | key | S | A);
    assertEquals(owner.attack.style, smashFor(key));
  }
});

test("Strong + A in a run gives what A gives without Strong, the dash attack, for forward and down, and Strong + up + A gives the up smash [k1 scenario]", () => {
  for (const key of [0, D]) {
    const strong = keyboard(), plain = keyboard();
    strong.press(R);
    plain.press(R);
    runUntil(strong, R, running);
    runUntil(plain, R, running);
    strong.press(R | key | S | A);
    plain.press(R | key | A);
    assertTrue(strong.owner.attack.style !== undefined);
    assertEquals(strong.owner.attack.style, plain.owner.attack.style);
    assertTrue(strong.owner.attack.style !== smashFor(key));
  }
  const { owner, press } = keyboard();
  press(R);
  runUntil({ owner, press }, R, running);
  press(R | U | S | A);
  assertEquals(owner.attack.style, AttackStyle.upSmash);
});

test("Out of a dash at any frame Strong + up + A is the up smash directly while forward and down past the smash window stay what A gives without Strong, and an up smash out of jump squat still starts after a dash and out of shield [k1 scenario]", () => {
  const direct = keyboard();
  direct.press(R);
  runUntil(direct, R, pastDashSmash);
  direct.press(R | U | S | A);
  assertEquals(direct.owner.attack.style, AttackStyle.upSmash);
  for (const key of [0, D]) {
    const strong = keyboard(), plain = keyboard();
    strong.press(R);
    plain.press(R);
    runUntil(strong, R, pastDashSmash);
    runUntil(plain, R, pastDashSmash);
    strong.press(R | key | S | A);
    plain.press(R | key | A);
    assertTrue(strong.owner.attack.style !== smashFor(key));
    assertEquals(strong.owner.attack.style, plain.owner.attack.style);
  }
  const cancelled = keyboard();
  cancelled.press(R);
  runUntil(cancelled, R, pastDashSmash);
  cancelled.press(R | J);
  assertTrue(cancelled.owner.jump.squat > 0);
  cancelled.press(R | U | S | A);
  assertEquals(cancelled.owner.attack.style, AttackStyle.upSmash);
  assertTrue(cancelled.owner.motion.grounded);
  const shielded = keyboard();
  for (let i = 0; i < 8; i++) shielded.press(T);
  assertTrue(shielded.owner.shield.raised);
  shielded.press(T | J);
  assertTrue(shielded.owner.jump.squat > 0);
  shielded.press(U | S | A);
  assertEquals(shielded.owner.attack.style, AttackStyle.upSmash);
  assertTrue(shielded.owner.motion.grounded);
});

test("With the walk modifier held, Strong held while walking leaves the walk unchanged, and Strong + A gives the smash out of the walk [k1 scenario]", () => {
  for (const key of [0, U, D]) {
    const strong = keyboard(), plain = keyboard();
    for (let i = 0; i < 12; i++) { strong.press(W | R); plain.press(W | R); }
    assertEquals(strong.owner.ground.action, GroundAction.none);
    assertTrue(strong.owner.motion.vx > 0.0);
    for (let i = 0; i < 4; i++) {
      assertFalse(strong.press(W | R | S).queued);
      plain.press(W | R);
      assertEquals(strong.owner.motion.x, plain.owner.motion.x);
      assertEquals(strong.owner.motion.vx, plain.owner.motion.vx);
    }
    strong.press(W | R | key | S | A);
    assertEquals(strong.owner.attack.style, smashFor(key));
  }
});

test("Strong alone, standing or crouched, is no attack, Strong + A with no direction is the forward smash the way the fighter faces, and in the air Strong + A + direction stays that aerial while Strong + direction alone stays nothing [k1 scenario]", () => {
  const neutral = keyboard();
  neutral.owner.facing = -1;
  neutral.press(S | A);
  assertEquals(neutral.owner.attack.style, AttackStyle.forwardSmash);
  assertEquals(neutral.owner.facing, -1);
  const lone = keyboard();
  assertFalse(lone.press(S).queued);
  const crouched = keyboard();
  for (let i = 0; i < 6; i++) crouched.press(D);
  assertTrue(crouched.owner.motion.crouching);
  assertFalse(crouched.press(D | S).queued);
  assertEquals(crouched.owner.attack.style, undefined);
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
