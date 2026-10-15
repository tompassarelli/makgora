import { assertEquals, test } from "wisp/src/runtime/testing";
import { beginDamageContacts, finishDamageContacts, queueDamageContact } from "./contacts";
import { Character, ContactKind } from "./codes";
import { createReferenceFighter } from "./referenceRig";
import { controls, hitEffect, soloWorld, testWorld } from "./testWorld";
import { advanceFighter } from "./step";
import { digitalShieldstunDuration } from "./shield";



test("a held-down shield regenerates by the measured float32 amount each frame [k3 measure docs/physics.md]", () => {
  const fighter = createReferenceFighter(Character.sylvanas, 0.0, 1);
  fighter.shield.energy = 20.0;

  advanceFighter(soloWorld(fighter), 0, 0, controls(), 0.0);

  assertEquals(fighter.shield.energy, 20.06999969482422);
});

test("shieldstun duration for a digital shield equals the measured float32 value [k3 measure docs/physics.md]", () => {
  assertEquals(digitalShieldstunDuration(9.0), 6.050000190734863);
  assertEquals(digitalShieldstunDuration(3.0), 3.3500001430511475);
});

test("two hits on the same shield in one frame sum their damage and drain it to exactly zero without breaking it [k4 reference native]", () => {
  const defender = createReferenceFighter(Character.sylvanas, 0.0, 1);
  const attacker = createReferenceFighter(Character.rifleman, 100.0, -1);
  const world = testWorld(defender, attacker);
  defender.shield.raised = true;
  defender.shield.energy = 8.0;

  beginDamageContacts();
  queueDamageContact(world, 1, 0, hitEffect(9.0, 0.0, 0.0, 0.0, 0.0), 1, ContactKind.damageOnly, false, undefined);
  queueDamageContact(world, 1, 0, hitEffect(1.0, 0.0, 0.0, 0.0, 0.0), 1, ContactKind.damageOnly, false, undefined);
  finishDamageContacts(world);

  assertEquals(defender.shield.energy, 1.0);
  assertEquals(defender.shield.raised, true);
});
