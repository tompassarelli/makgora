import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, GroundAction } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import { DASH_ATTACK_LAST_FRAME, DASH_SMASH_LAST_FRAME } from "../sim/stickZones";
import { lift } from "../sim/testDuel";
import { A, B, D, G, J, L, R, S, T, U, W, keyboard, smashFor, type Keyboard } from "./strongKeyboard";

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
  for (const key of [R, L, U, D]) {
    const { owner, press } = keyboard();
    for (let i = 0; i < 6; i++) press(D);
    assertTrue(owner.motion.crouching);
    const x = owner.motion.x;
    assertTrue(press(key | S).queued);
    assertEquals(owner.attack.style, smashFor(key));
    assertEquals(owner.facing, key === L ? -1 : 1);
    assertEquals(owner.motion.x, x);
  }
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

const inDashSmash = (owner: Fighter): boolean => owner.ground.action === GroundAction.dash && owner.ground.actionFrame + 1 <= DASH_SMASH_LAST_FRAME;

test("Strong + each direction with no A press gives that smash on every dash frame inside the dash-smash window and nothing on the first frame past it, a Strong press with the dash direction held, Strong and up or down pressed together, and Strong and back pressed together turning it [k1 scenario]", () => {
  for (const delay of [0, 1]) {
    for (const [held, style, facing] of [[R | S, AttackStyle.forwardSmash, 1], [R | U | S, AttackStyle.upSmash, 1], [R | D | S, AttackStyle.downSmash, 1], [L | S, AttackStyle.forwardSmash, -1]] as const) {
      const { owner, press } = keyboard();
      press(R);
      for (let i = 0; i < delay; i++) press(R);
      assertTrue(inDashSmash(owner));
      assertTrue(press(held).queued);
      assertEquals(owner.attack.style, style);
      assertEquals(owner.facing, facing);
      assertTrue(owner.motion.grounded);
    }
  }
  for (const held of [R | S, R | D | S]) {
    const { owner, press } = keyboard();
    press(R);
    for (let i = 0; i < 60 && inDashSmash(owner); i++) press(R);
    assertEquals(owner.ground.action, GroundAction.dash);
    assertFalse(press(held).queued);
    assertEquals(owner.attack.style, undefined);
  }
});

test("Strong + up with no A press gives the up smash out of a dash past its smash window and out of a run, by a Strong press with up held or up pressed under Strong [k1 scenario]", () => {
  for (const reached of [pastDashSmash, running]) {
    for (const strongFirst of [false, true]) {
      const keys = keyboard();
      keys.press(R);
      runUntil(keys, R, reached);
      if (strongFirst) keys.press(R | S);
      assertEquals(keys.owner.attack.style, undefined);
      assertTrue(keys.press(R | U | S).queued);
      assertEquals(keys.owner.attack.style, AttackStyle.upSmash);
      assertTrue(keys.owner.motion.grounded);
    }
  }
});

test("Strong + forward or down in a run or out of a dash past its smash window starts no attack and moves the fighter exactly as without Strong, down in a run still crouches and a fresh direction from that crouch then smashes [k1 scenario]", () => {
  const presses = [R, R, R, R | D, R, L, L, L, R];
  for (const reached of [pastDashSmash, running]) {
    const strong = keyboard(), plain = keyboard();
    strong.press(R);
    plain.press(R);
    runUntil(strong, R, reached);
    runUntil(plain, R, reached);
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
  const strong = keyboard(), plain = keyboard();
  strong.press(R);
  plain.press(R);
  runUntil(strong, R, running);
  runUntil(plain, R, running);
  strong.press(R | S);
  plain.press(R);
  for (let i = 0; i < 60 && !(strong.owner.motion.crouching && strong.owner.ground.action === GroundAction.none); i++) {
    assertFalse(strong.press(D | S).queued);
    plain.press(D);
    assertEquals(strong.owner.attack.style, undefined);
    assertEquals(strong.owner.motion.x, plain.owner.motion.x);
    assertEquals(strong.owner.ground.action, plain.owner.ground.action);
    assertEquals(strong.owner.motion.crouching, plain.owner.motion.crouching);
  }
  assertTrue(strong.owner.motion.crouching);
  assertTrue(strong.press(R | S).queued);
  assertEquals(strong.owner.attack.style, AttackStyle.forwardSmash);
});

test("Strong + up with no A press out of jump squat gives the up smash on the ground, and Strong + forward or down in jump squat starts nothing [k1 scenario]", () => {
  for (const [key, style] of [[U, AttackStyle.upSmash], [R, undefined], [D, undefined]] as const) {
    for (const strongFirst of [false, true]) {
      const { owner, press } = keyboard();
      press(J);
      assertTrue(owner.jump.squat > 0);
      if (strongFirst) press(S);
      const queued = press(key | S).queued;
      assertEquals(queued, style !== undefined);
      assertEquals(owner.attack.style, style);
      if (style !== undefined) assertTrue(owner.motion.grounded);
    }
  }
});

test("Strong + A inside the dash-smash window gives the up smash with no other direction and with up or down held [k1 scenario]", () => {
  for (const key of [0, U, D]) {
    const { owner, press } = keyboard();
    press(R);
    assertEquals(owner.ground.action, GroundAction.dash);
    assertTrue(owner.ground.actionFrame <= DASH_SMASH_LAST_FRAME);
    press(R | key | S | A);
    assertEquals(owner.attack.style, AttackStyle.upSmash);
  }
});

function dashFrame(frames: number): Keyboard {
  const dash = keyboard();
  for (let i = 0; i < frames; i++) dash.press(R);
  return dash;
}

const FORWARD_TILTS: readonly AttackStyle[] = [AttackStyle.forwardTilt, AttackStyle.forwardTiltUp, AttackStyle.forwardTiltDown];

test("A with a direction on every dash frame through the dash attack's last frame gives the dash attack and never a forward tilt, up or down [k1 scenario]", () => {
  const reference = keyboard();
  reference.press(R);
  runUntil(reference, R, running);
  reference.press(R | A);
  const dashAttack = reference.owner.attack.style;
  assertTrue(dashAttack !== undefined);
  assertFalse(dashAttack !== undefined && FORWARD_TILTS.includes(dashAttack));
  let dashFrames = 0;
  for (let frames = 1; frames < DASH_ATTACK_LAST_FRAME; frames++) {
    for (const key of [0, U, D]) {
      const { owner, press } = dashFrame(frames);
      if (owner.ground.action !== GroundAction.dash) continue;
      if (key === 0) dashFrames++;
      if (frames < DASH_SMASH_LAST_FRAME) assertTrue(inDashSmash(owner));
      press(R | key | A);
      assertEquals(owner.attack.style, dashAttack);
    }
  }
  assertTrue(dashFrames > DASH_SMASH_LAST_FRAME);
});

test("Strong + A in a run gives the up smash with forward or down held, where A alone gives the dash attack, and with up held [k1 scenario]", () => {
  for (const key of [0, D]) {
    const strong = keyboard(), plain = keyboard();
    strong.press(R);
    plain.press(R);
    runUntil(strong, R, running);
    runUntil(plain, R, running);
    strong.press(R | key | S | A);
    plain.press(R | key | A);
    assertTrue(plain.owner.attack.style !== AttackStyle.upSmash);
    assertEquals(strong.owner.attack.style, AttackStyle.upSmash);
    assertTrue(strong.owner.motion.grounded);
  }
  const { owner, press } = keyboard();
  press(R);
  runUntil({ owner, press }, R, running);
  press(R | U | S | A);
  assertEquals(owner.attack.style, AttackStyle.upSmash);
});

test("Out of a dash at any frame Strong + up + A is the up smash directly and forward and down past the smash window are the up smash too where A alone gives something else, and an up smash out of jump squat still starts after a dash and out of shield [k1 scenario]", () => {
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
    assertTrue(plain.owner.attack.style !== AttackStyle.upSmash);
    assertEquals(strong.owner.attack.style, AttackStyle.upSmash);
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

test("With the walk modifier held, Strong + each direction with no A press gives that smash out of the walk, by a Strong press with the direction held or a direction pressed under Strong, and Strong + A still gives the smash out of the walk [k1 scenario]", () => {
  const walking = (): Keyboard => {
    const keys = keyboard();
    for (let i = 0; i < 12; i++) keys.press(W | R);
    assertEquals(keys.owner.ground.action, GroundAction.none);
    assertTrue(keys.owner.motion.vx > 0.0);
    return keys;
  };
  const pressed = walking();
  assertTrue(pressed.press(W | R | S).queued);
  assertEquals(pressed.owner.attack.style, AttackStyle.forwardSmash);
  for (const key of [U, D]) {
    const under = walking();
    under.press(W | R | key | S);
    assertEquals(under.owner.attack.style, smashFor(key));
  }
  const back = walking();
  back.press(W | L | S);
  assertEquals(back.owner.attack.style, AttackStyle.forwardSmash);
  assertEquals(back.owner.facing, -1);
  for (const key of [0, U, D]) {
    const strong = walking();
    strong.press(W | R | key | S | A);
    assertEquals(strong.owner.attack.style, AttackStyle.upSmash);
  }
});

test("Strong alone standing is no attack, Strong pressed while crouched on held down is the down smash, Strong + A with no direction is the up smash, and in the air Strong + A + direction stays that aerial while Strong + direction alone stays nothing [k1 scenario]", () => {
  const neutral = keyboard();
  neutral.owner.facing = -1;
  neutral.press(S | A);
  assertEquals(neutral.owner.attack.style, AttackStyle.upSmash);
  assertEquals(neutral.owner.facing, -1);
  const lone = keyboard();
  assertFalse(lone.press(S).queued);
  const crouched = keyboard();
  for (let i = 0; i < 6; i++) crouched.press(D);
  assertTrue(crouched.owner.motion.crouching);
  const crouchX = crouched.owner.motion.x;
  assertTrue(crouched.press(D | S).queued);
  assertEquals(crouched.owner.attack.style, AttackStyle.downSmash);
  assertEquals(crouched.owner.motion.x, crouchX);
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

test("With Strong held the tilt modifier still tilts with A, shield still rolls, grab still grabs and Special casts the special without a smash [k1 scenario]", () => {
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
    const special = keyboard();
    special.press(S);
    const cast = special.press(S | key | B);
    assertTrue(cast.special);
    assertFalse(cast.queued);
  }
});

test("Strong held then Attack is the up smash on the ground with no direction held and with a side, up or down held, with Attack pressed on the same frame as Strong or after it, where Attack alone gives a tilt or jab [k1 scenario]", () => {
  for (const key of [0, R, L, U, D]) {
    for (const together of [true, false]) {
      const { owner, press } = keyboard();
      const x = owner.motion.x;
      if (!together) press(S);
      assertTrue(press(S | key | A).queued);
      assertEquals(owner.attack.style, AttackStyle.upSmash);
      assertEquals(owner.attack.frame, 0);
      assertEquals(owner.motion.x, x);
      assertEquals(owner.facing, key === L ? -1 : 1);
    }
  }
  const plain = keyboard();
  plain.press(A);
  assertEquals(plain.owner.attack.style, AttackStyle.jab);
});

test("Strong held then forward or down is that direction's smash with no Attack, and Strong held with Special and no direction is the neutral special, not a smash [k1 scenario]", () => {
  for (const [key, style] of [[R, AttackStyle.forwardSmash], [D, AttackStyle.downSmash]] as const) {
    const { owner, press } = keyboard();
    press(S);
    assertTrue(press(S | key).queued);
    assertEquals(owner.attack.style, style);
  }
  const special = keyboard();
  special.press(S);
  const cast = special.press(S | B);
  assertTrue(cast.special);
  assertFalse(cast.queued);
  assertEquals(special.owner.attack.style, undefined);
});

test("Strong tapped and released then a direction on the next frame starts no smash and moves the fighter as without Strong [k1 scenario]", () => {
  for (const key of [R, L, U, D]) {
    const strong = keyboard(), plain = keyboard();
    strong.press(S);
    strong.press(0);
    assertFalse(strong.press(key).queued);
    plain.press(0);
    plain.press(0);
    plain.press(key);
    assertEquals(strong.owner.attack.style, undefined);
    assertEquals(strong.owner.ground.action, plain.owner.ground.action);
    assertEquals(strong.owner.jump.squat, plain.owner.jump.squat);
    assertEquals(strong.owner.motion.crouching, plain.owner.motion.crouching);
    assertEquals(strong.owner.motion.vx, plain.owner.motion.vx);
  }
});
