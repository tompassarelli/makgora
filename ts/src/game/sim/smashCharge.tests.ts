import { assertEquals, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { createWhiteGlowState, whiteGlowAlpha } from "../presentation/whiteGlow";
import { AttackStyle, type Character } from "./codes";
import { type Fighter, createFighter } from "./fighter";
import { SELECTABLE_CHARACTERS } from "./heroes/registry";
import { authoredHitRegion, emptyHitRegion } from "./hitRegions";
import { SMASH_MAX_CHARGE_FRAMES, SMASH_MAX_DAMAGE_MULTIPLIER, SMASH_MAX_HOLD_FRAMES, smashDamageMultiplier } from "./moves";
import { advanceSolo, controls } from "./testWorld";
import { beginAttack } from "./transitions";

const SMASHES = [AttackStyle.forwardSmash, AttackStyle.upSmash, AttackStyle.downSmash] as const;
const held = controls({ attackHeld: true });
const released = controls();

function hold(character: Character, style: AttackStyle, frames: number): { fighter: Fighter; glowed: boolean } {
  const fighter = createFighter(character, 0.0, 1);
  advanceSolo(fighter, 0, released, 0.0);
  beginAttack(fighter, style, true);
  const glow = createWhiteGlowState();
  let glowed = false;
  for (let frame = 0; frame < 400 && !fighter.attack.smashCharging; frame++) advanceSolo(fighter, 0, held, 0.0);
  while (fighter.attack.smashCharging && fighter.attack.smashChargeFrames < frames) {
    advanceSolo(fighter, 0, held, 0.0);
    if (fighter.attack.smashChargeFrames > SMASH_MAX_CHARGE_FRAMES && whiteGlowAlpha(glow, fighter, fighter.attack.smashChargeFrames) > 0) glowed = true;
  }
  return { fighter, glowed };
}

function smashDamage(fighter: Readonly<Fighter>, chargeFrames: number): number {
  const style = fighter.attack.style!;
  return authoredHitRegion(emptyHitRegion(), fighter.character, style, fighter.attack.frame, chargeFrames, 0, fighter.tuning.moves).effect.damage;
}

test("Smash charge: the multiplier grows over 60 frames to 1.3671x, and frames held past 60 add nothing [k2 property]", () => {
  for (let frame = 0; frame <= SMASH_MAX_HOLD_FRAMES; frame++) {
    const charge = Math.min(frame, SMASH_MAX_CHARGE_FRAMES);
    assertEquals(smashDamageMultiplier(frame), f32(1.0 + f32(f32(f32(SMASH_MAX_DAMAGE_MULTIPLIER - 1.0) * charge) / SMASH_MAX_CHARGE_FRAMES)), `frame ${frame}`);
  }
  assertEquals(smashDamageMultiplier(SMASH_MAX_HOLD_FRAMES), f32(SMASH_MAX_DAMAGE_MULTIPLIER));
});

test("Smash charge: every fighter's forward, up and down smash charges 60 frames, holds at full charge to frame 180 with the charge glow showing, then releases by itself; releasing earlier keeps the frame's multiplier [k3 measure #328]", () => {
  assertEquals(SMASH_MAX_HOLD_FRAMES, 180);
  for (const character of SELECTABLE_CHARACTERS) {
    for (const style of SMASHES) {
      const name = `${character}/${style}`;
      const full = hold(character, style, SMASH_MAX_HOLD_FRAMES + 30);
      assertEquals(full.fighter.attack.style === style, true, `${name} still attacking`);
      assertEquals(full.fighter.attack.smashChargeFrames, SMASH_MAX_HOLD_FRAMES, `${name} auto-release frame`);
      assertEquals(!full.fighter.attack.smashCharging, true, `${name} released at 180`);
      assertEquals(full.glowed, true, `${name} glows through the extra hold`);
      assertEquals(smashDamage(full.fighter, SMASH_MAX_HOLD_FRAMES), smashDamage(full.fighter, SMASH_MAX_CHARGE_FRAMES), `${name} no gain past 60`);
      for (const frames of [1, 30, SMASH_MAX_CHARGE_FRAMES, 61, 120, SMASH_MAX_HOLD_FRAMES - 1]) {
        const { fighter } = hold(character, style, frames);
        assertEquals(fighter.attack.smashCharging, true, `${name} still charging at ${frames}`);
        advanceSolo(fighter, 0, released, 0.0);
        assertEquals(!fighter.attack.smashCharging, true, `${name} releases on button release at ${frames}`);
        assertEquals(fighter.attack.smashChargeFrames, frames, `${name} charge kept at ${frames}`);
        assertEquals(smashDamageMultiplier(fighter.attack.smashChargeFrames), smashDamageMultiplier(Math.min(frames, SMASH_MAX_CHARGE_FRAMES)), `${name} multiplier at ${frames}`);
      }
    }
  }
});
