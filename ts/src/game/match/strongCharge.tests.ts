import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { A, D, L, R, S, U, keyboard, smashFor, type Keyboard } from "./strongKeyboard";
import { AttackStyle } from "../sim/codes";

function chargingSmash(held: number, key: number, frames: number): Keyboard {
  const keys = keyboard();
  keys.press(S);
  keys.press(held);
  assertEquals(keys.owner.attack.style, smashFor(key));
  for (let i = 0; i < 400 && !keys.owner.attack.smashCharging; i++) keys.press(held);
  assertTrue(keys.owner.attack.smashCharging);
  for (let i = 0; i < frames; i++) keys.press(held);
  assertTrue(keys.owner.attack.smashCharging);
  return keys;
}

test("A Strong smash charges 20 frames while Strong and its direction stay held and fires on the frame the stick is released or turned to another direction, keeping that charge, for each direction [k1 scenario]", () => {
  for (const key of [R, L, U, D]) {
    for (const next of [0, key === R ? L : R, key === U ? D : U]) {
      const { owner, press } = chargingSmash(S | key, key, 20);
      const charge = owner.attack.smashChargeFrames;
      assertTrue(charge >= 20);
      press(S | next);
      assertFalse(owner.attack.smashCharging);
      assertEquals(owner.attack.smashChargeFrames, charge);
      assertEquals(owner.attack.style, smashFor(key));
    }
  }
});

test("A Strong smash fires on the frame Strong is released while its direction is still held, keeping the charge [k1 scenario]", () => {
  for (const key of [R, L, U, D]) {
    const { owner, press } = chargingSmash(S | key, key, 20);
    const charge = owner.attack.smashChargeFrames;
    press(key);
    assertFalse(owner.attack.smashCharging);
    assertEquals(owner.attack.smashChargeFrames, charge);
  }
});

function chargingStrongAttackUp(key: number): Keyboard {
  const keys = keyboard();
  keys.press(S);
  keys.press(S | A | key);
  assertEquals(keys.owner.attack.style, AttackStyle.upSmash);
  for (let i = 0; i < 400 && !keys.owner.attack.smashCharging; i++) keys.press(S | A | key);
  for (let i = 0; i < 20; i++) keys.press(S | A);
  assertTrue(keys.owner.attack.smashCharging);
  return keys;
}

test("An up smash begun with Strong + attack keeps charging while Strong is held after attack and the stick are released, and fires when Strong is released, keeping the charge [k1 scenario]", () => {
  for (const key of [0, R, U, D]) {
    const { owner, press } = chargingStrongAttackUp(key);
    const before = owner.attack.smashChargeFrames;
    for (let i = 0; i < 20; i++) press(S);
    assertTrue(owner.attack.smashCharging);
    assertTrue(owner.attack.smashChargeFrames > before);
    const charge = owner.attack.smashChargeFrames;
    press(0);
    assertFalse(owner.attack.smashCharging);
    assertEquals(owner.attack.smashChargeFrames, charge);
  }
});

test("An up smash begun with Strong + attack keeps charging while attack is held after Strong is released, and fires when attack is released, keeping the charge [k1 scenario]", () => {
  for (const key of [0, R, U, D]) {
    const { owner, press } = chargingStrongAttackUp(key);
    const before = owner.attack.smashChargeFrames;
    for (let i = 0; i < 20; i++) press(A);
    assertTrue(owner.attack.smashCharging);
    assertTrue(owner.attack.smashChargeFrames > before);
    const charge = owner.attack.smashChargeFrames;
    press(0);
    assertFalse(owner.attack.smashCharging);
    assertEquals(owner.attack.smashChargeFrames, charge);
  }
});

test("An up smash begun with Strong + attack fires on the frame Strong and attack are released together, keeping the charge [k1 scenario]", () => {
  for (const key of [0, R, U, D]) {
    const { owner, press } = chargingStrongAttackUp(key);
    const charge = owner.attack.smashChargeFrames;
    press(key);
    assertFalse(owner.attack.smashCharging);
    assertEquals(owner.attack.smashChargeFrames, charge);
  }
});
