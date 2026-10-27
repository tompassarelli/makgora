import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { AttackStyle, Character } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { HitElement } from "../sim/hitRegions";
import { attackStartupFrames } from "../sim/moves";
import { duelPair, stepDuel } from "../sim/testDuel";
import { controls } from "../sim/testWorld";
import { beginAttack } from "../sim/transitions";
import { type AttackCueState, attackCueState } from "./attackCues";
import { ELECTRIC_IMPACT_MODEL } from "./hitPresentation";
import { ELEMENT_LOOKS } from "./elementLooks";
import { captureImpactEventsBefore, createImpactEvents, finishImpactEventsAfter } from "./impactEvents";
import { IMPACT_ELECTRIC_SHIELD, IMPACT_SLASH_HIT, createImpactState, emitImpacts } from "./impactState";

const SHEAR_ANGLES = [AttackStyle.forwardTilt, AttackStyle.forwardTiltUp, AttackStyle.forwardTiltDown];
const ELECTRIC_MODELS = [ELECTRIC_IMPACT_MODEL, ELEMENT_LOOKS[HitElement.electric].victim, "Abilities\\Spells\\Demon\\DemonBoltImpact\\DemonBoltImpact.mdx"];
const IMPACT_ELECTRIC_HIT = 5;

interface ShearContact {
  readonly kinds: readonly number[];
  readonly hitElectric: boolean;
  readonly hitElement: HitElement;
  readonly shieldElectric: boolean;
  readonly shielded: boolean;
}

function shear(style: AttackStyle, shielding: boolean, targetMana: number, facing: 1 | -1): ShearContact | undefined {
  const { world, owner, target } = duelPair(createFighter(Character.demonHunter, 0.0, facing), createFighter(Character.pitLord, facing * 70.0, -facing as 1 | -1));
  target.mana.points = targetMana;
  const guard = controls({ shield: shielding });
  for (let frame = 0; frame < 8; frame++) stepDuel(world, controls(), guard);
  beginAttack(owner, style, false);
  for (let frame = 0; frame < 30; frame++) {
    const events = createImpactEvents();
    captureImpactEventsBefore(events, target);
    stepDuel(world, controls(), guard);
    finishImpactEventsAfter(events, target, world);
    if (!events.hit && !events.shieldHit) continue;
    const state = createImpactState();
    emitImpacts(state, events, 0, 0);
    const kinds: number[] = [];
    state.occupied.forEach((slots, kind) => { if (slots !== 0) kinds.push(kind); });
    const { visuals } = target;
    return { kinds, hitElectric: visuals.hitElectric, hitElement: visuals.hitElement, shieldElectric: visuals.shieldElectric, shielded: events.shieldHit };
  }
  return undefined;
}

test("Illidan's Shear, at every angle and in both facings, lands as a slash on a bare or mana-holding foe and as a plain shield hit on a shield, never an electric spark [k1 scenario]", () => {
  for (const style of SHEAR_ANGLES) for (const facing of [1, -1] as const) {
    for (const mana of [0, 100]) {
      const contact = shear(style, false, mana, facing);
      assertTrue(contact !== undefined && !contact.shielded);
      if (contact === undefined) return;
      assertFalse(contact.hitElectric);
      assertEquals(contact.hitElement, HitElement.slash);
      assertTrue(contact.kinds.includes(IMPACT_SLASH_HIT));
      assertFalse(contact.kinds.includes(IMPACT_ELECTRIC_HIT));
    }
    const blocked = shear(style, true, 100, facing);
    assertTrue(blocked !== undefined && blocked.shielded);
    if (blocked === undefined) return;
    assertFalse(blocked.shieldElectric);
    assertFalse(blocked.kinds.includes(IMPACT_ELECTRIC_SHIELD));
  }
});

test("Shear's swing cue is Illidan's fel glaive art on every active frame of every angle, never a lightning or zap model [k2 property]", () => {
  for (const style of SHEAR_ANGLES) {
    const owner = createFighter(Character.demonHunter, 0.0, 1);
    beginAttack(owner, style, false);
    const out: AttackCueState = { cue: undefined, x: 0.0, z: 0.0, key: 0 };
    let shown = 0;
    for (let frame = 0; frame < attackStartupFrames(style, owner.tuning.moves) + 12; frame++) {
      owner.attack.frame = frame;
      const model = attackCueState(owner, out).cue?.model;
      if (model === undefined) continue;
      shown++;
      assertFalse(ELECTRIC_MODELS.includes(model));
      assertEquals(model, "Abilities\\Weapons\\IllidanMissile\\IllidanMissile.mdx");
    }
    assertTrue(shown > 0);
  }
});
