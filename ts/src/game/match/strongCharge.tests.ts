import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { D, L, R, S, U, keyboard, smashFor, type Keyboard } from "./strongKeyboard";

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

test("A Strong smash fires on the frame Strong is released while its direction is still held, keeping the charge [k1 scenario]", () => {
  for (const key of [R, L, U, D]) {
    const { owner, press } = chargingSmash(S | key, key, 20);
    const charge = owner.attack.smashChargeFrames;
    press(key);
    assertFalse(owner.attack.smashCharging);
    assertEquals(owner.attack.smashChargeFrames, charge);
  }
});
