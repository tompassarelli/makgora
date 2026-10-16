import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { AttackStyle, Character, HitElement, SpecialAction } from "../codes";
import { beginDamageContacts, finishDamageContacts } from "../contacts";
import { createFighter } from "../fighter";
import { applyAttackHit } from "../hits";
import { controls } from "../testWorld";
import { duelPair, stepDuel } from "../testDuel";

const up = controls({ specialPressed: true, specialZ: 1 });
const actionOf = (special: { readonly action: SpecialAction }): SpecialAction => special.action;

test("a hit in the air gives back an up special already spent this airtime, as Melee's special fall ends on a hit [k1 scenario]", () => {
  const maiev = createFighter(Character.warden, 0.0, 1);
  maiev.mana.points = 100;
  const rifleman = createFighter(Character.rifleman, 900.0, -1);
  const { world } = duelPair(maiev, rifleman);
  maiev.motion.grounded = false;
  maiev.motion.surface = undefined;
  maiev.motion.z = 900.0;
  stepDuel(world, up);
  assertEquals(maiev.special.action, SpecialAction.heroUp);
  while (maiev.special.action !== SpecialAction.none) stepDuel(world);
  maiev.motion.z = 900.0;
  stepDuel(world, up);
  assertTrue(actionOf(maiev.special) !== SpecialAction.heroUp);
  beginDamageContacts();
  applyAttackHit(world, 1, 0, AttackStyle.jab, -1, { damage: 6.0, growth: 60.0, base: 20.0, launchX: 0.5, launchZ: 0.75, electric: false, element: HitElement.normal }, true, false);
  finishDamageContacts(world);
  while (maiev.launch.hitlag > 0 || maiev.launch.hitstun > 0) stepDuel(world);
  maiev.motion.z = 900.0;
  stepDuel(world, up);
  assertEquals(maiev.special.action, SpecialAction.heroUp);
});
