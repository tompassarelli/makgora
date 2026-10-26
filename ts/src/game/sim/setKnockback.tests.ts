import { assertDefined, assertGreaterThan, assertNear, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Character, ContactKind, GrabAction } from "./codes";
import { beginDamageContacts, collectDamageContact, finishDamageContacts } from "./contacts";
import { createFighter } from "./fighter";
import { authoredThrowEffect } from "./grabs";
import { HERO_ROSTER } from "../roster/kits";
import { WARDEN_SPECIALS } from "../fighters/warden/specials";
import type { HitEffect } from "./hitRegions";
import { KNOCKBACK_LAUNCH_SPEED, THROW_KNOCKBACK_WEIGHT } from "./knockback";
import { fighterAt } from "./roster";
import { testWorld, withPhysics } from "./testWorld";
import { melee } from "./tuning";

const SET_HIT: HitEffect = { damage: 5.0, growth: 100.0, base: 0.0, launchX: 0.3420201241970062, launchZ: 0.9396926164627075, electric: false, setKnockback: 90.0 };
const TOLERANCE = f32(0.01);
const CHARACTERS = [Character.rifleman, Character.demonHunter, ...HERO_ROSTER.map(({ character }) => character)];

function meleeSetKnockback(set: number, weight: number, growth: number, base: number): number {
  // (10/10 + 10·set/20) · 200/(weight + 100) · 1.4 + 18, scaled by growth and plus base, in whole numbers.
  return (((2 + set) * 140) / (weight + 100) + 18) * (growth / 100) + base;
}

function launchKnockback(effect: Readonly<HitEffect>, kind: ContactKind, weight: number, attacker: Character = Character.rifleman): number {
  const world = testWorld(createFighter(attacker, 0.0, 1), createFighter(Character.rifleman, 100.0, -1));
  const victim = fighterAt(world, 1);
  withPhysics(victim, { weight });
  victim.status.damage = 40.0;
  beginDamageContacts();
  collectDamageContact(world, 0, 1, effect, 1, kind, true, undefined, false);
  finishDamageContacts(world);
  const { knockbackX, knockbackZ } = victim.launch;
  return Math.sqrt(knockbackX * knockbackX + knockbackZ * knockbackZ) / melee(KNOCKBACK_LAUNCH_SPEED);
}

test("a set-knockback hit launches weight-75 and weight-118 victims with Melee's knockback at 10% with the set value as damage [k4 reference melee]", () => {
  for (const weight of [75.0, 118.0]) {
    assertNear(launchKnockback(SET_HIT, ContactKind.launch, weight), meleeSetKnockback(90.0, weight, 100.0, 0.0), TOLERANCE);
  }
});

test("every down throw and both Fans of Knives still launch at weight 100 [k4 reference melee]", () => {
  for (const character of CHARACTERS) {
    const effect = { ...authoredThrowEffect(GrabAction.throwDown, createFighter(character, 0.0, 1).tuning.moves) };
    const set = assertDefined(effect.setKnockback, "down throw set knockback");
    const knockback = launchKnockback(effect, ContactKind.throw, THROW_KNOCKBACK_WEIGHT, character);
    assertGreaterThan(knockback, 0.0);
    assertNear(knockback, meleeSetKnockback(set, THROW_KNOCKBACK_WEIGHT, effect.growth, effect.base), TOLERANCE);
  }
  for (const kit of [WARDEN_SPECIALS.down.ground, WARDEN_SPECIALS.down.air]) {
    const effect = assertDefined(assertDefined(kit, "fan kit").regions?.[0], "fan region").hit.effect;
    assertGreaterThan(launchKnockback(effect, ContactKind.launch, 100.0), 0.0);
  }
});
