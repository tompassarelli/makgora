import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, Character, GrabAction } from "../codes";
import { canAttack } from "../conditions";
import { type Fighter, createFighter } from "../fighter";
import { dealtManaGain, takenManaGain } from "../mana";
import { attackStartupFrames, characterAttackActiveFrames } from "../moves";
import { duelPair, stepDuel } from "../testDuel";
import { controls, testBeginAttacks } from "../testWorld";
import { KAELTHAS_MOVES } from "./kaelthasMoves";
import { SELECTABLE_CHARACTERS } from "./registry";

const TETHER_GAP = 150.0;
const WHIFF_GAP = 400.0;
const PUMMEL_GAP = 40.0;
const MIN_WHIFF_END_LAG = 30;
const shielding = controls({ shield: true });

function grabAt(character: Character, gap: number): { readonly grabber: Fighter; readonly target: Fighter; readonly caught: boolean; readonly freeFrame: number } {
  const grabber = createFighter(character, 0.0, 1);
  const target = createFighter(Character.rifleman, gap, -1);
  const { world } = duelPair(grabber, target, 3);
  for (let frame = 0; frame < 6; frame++) stepDuel(world, controls(), shielding);
  assertTrue(target.shield.raised);
  testBeginAttacks(world, AttackStyle.grab, undefined);
  let caught = false;
  let freeFrame = 0;
  for (let frame = 1; frame < 120 && freeFrame === 0; frame++) {
    stepDuel(world, controls(), shielding);
    caught ||= target.grab.owner !== undefined;
    if (!caught && grabber.attack.style === undefined && canAttack(grabber)) freeFrame = frame;
  }
  return { grabber, target, caught, freeFrame };
}

test("Siphon Mana catches a shielding foe at a distance no other fighter's grab reaches [k1 scenario]", () => {
  for (const character of SELECTABLE_CHARACTERS) {
    if (character !== Character.kaelthas) assertTrue(!grabAt(character, TETHER_GAP).caught);
  }
  assertTrue(grabAt(Character.kaelthas, TETHER_GAP).caught);
});

test("A whiffed Siphon Mana leaves Kael'thas at least 30 frames of end lag after its last active frame [k3 measure #360]", () => {
  const whiff = grabAt(Character.kaelthas, WHIFF_GAP);
  assertTrue(!whiff.caught);
  const lastActive = attackStartupFrames(AttackStyle.grab, KAELTHAS_MOVES) + characterAttackActiveFrames(Character.kaelthas, AttackStyle.grab, KAELTHAS_MOVES);
  assertTrue(whiff.freeFrame - lastActive >= MIN_WHIFF_END_LAG);
});

test("Siphon Mana's pummel deals damage and nothing else: no heal, no mana beyond the roster meter, no launch, the hold kept [k1 scenario]", () => {
  const kael = createFighter(Character.kaelthas, 0.0, 1);
  const target = createFighter(Character.rifleman, PUMMEL_GAP, -1);
  const { world } = duelPair(kael, target, 3);
  kael.status.damage = 40.0;
  testBeginAttacks(world, AttackStyle.grab, undefined);
  for (let frame = 0; frame < 40 && target.grab.owner === undefined; frame++) stepDuel(world);
  assertEquals(target.grab.owner, 0);
  while (kael.grab.action !== GrabAction.hold) stepDuel(world);
  target.mana.points = 50;
  const before = { kaelDamage: kael.status.damage, targetDamage: target.status.damage, kaelMana: kael.mana.points, targetMana: target.mana.points };
  stepDuel(world, controls({ attackPressed: true }));
  for (let frame = 0; frame < 12 && target.status.damage === before.targetDamage; frame++) stepDuel(world);
  const dealt = f32(target.status.damage - before.targetDamage);
  assertTrue(dealt > 0.0);
  assertEquals(kael.status.damage, before.kaelDamage);
  assertEquals(kael.mana.points, before.kaelMana + dealtManaGain(dealt));
  assertEquals(target.mana.points, before.targetMana + takenManaGain(dealt));
  assertEquals(target.grab.owner, 0);
  assertEquals(target.launch.knockbackX, 0.0);
  assertEquals(target.launch.knockbackZ, 0.0);
});
