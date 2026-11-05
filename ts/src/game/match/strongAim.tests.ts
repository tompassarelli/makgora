import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { AttackStyle, GroundAction } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import { DASH_ATTACK_LAST_FRAME, DASH_SMASH_LAST_FRAME } from "../sim/stickZones";
import { A, D, R, U, keyboard, type Keyboard } from "./strongKeyboard";

function runUntil(keyboard: Keyboard, held: number, reached: (this: void, owner: Fighter) => boolean): void {
  for (let i = 0; i < 60 && !reached(keyboard.owner); i++) keyboard.press(held);
  assertTrue(reached(keyboard.owner));
}

const running = (owner: Fighter): boolean => owner.ground.action === GroundAction.run;

const inDashSmash = (owner: Fighter): boolean => owner.ground.action === GroundAction.dash && owner.ground.actionFrame + 1 <= DASH_SMASH_LAST_FRAME;

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
