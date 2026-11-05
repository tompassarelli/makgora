import { assertEquals, test } from "wisp/src/runtime/testing";
import { createMatchState } from "../../lobby/lobbyState";
import { initializeMatchFighters } from "../../match/step";
import { Character, ContactKind } from "../../sim/codes";
import { queueDamageContact } from "../../sim/contacts";
import { DUO_CHAIN_CAP, DUO_CHAIN_FREE_FRAMES, advanceDuoLocks } from "../../sim/duoLocks";
import { createFighter } from "../../sim/fighter";
import { type Roster, createRoster, fighterAt } from "../../sim/roster";
import { contactBatch, hitEffect } from "../../sim/testWorld";

const MRGL = 0;
const FOE = 1;
const GRGL = 2;

const jab = hitEffect(3.0, 100.0, 40.0, 0.699999988079071, 0.699999988079071);

function trio(): Roster {
  const world = createRoster(3, [createFighter(Character.murloc, 0.0, 1), createFighter(Character.peon, 40.0, -1)]);
  initializeMatchFighters(createMatchState(), world);
  return world;
}

function strike(world: Roster, source: number, effect = jab): void {
  contactBatch(world, () => queueDamageContact(world, source, FOE, effect, 1, ContactKind.launch, true, undefined));
}

function expire(world: Roster): void {
  const foe = fighterAt(world, FOE);
  foe.launch.hitstun = 0;
  foe.launch.hitlag = 0;
  foe.launch.knockbackX = 0.0;
  foe.launch.knockbackZ = 0.0;
  advanceDuoLocks(world);
}

test("The 13th duo hit leaves zero hitstun and knockback until the foe has been actionable 20 frames [k3 measure docs/design/murloc.md]", () => {
  const world = trio();
  const foe = fighterAt(world, FOE);
  for (let hit = 0; hit < DUO_CHAIN_CAP; hit++) {
    strike(world, hit < 6 ? MRGL : GRGL);
    assertEquals(foe.launch.hitstun > 0, true, "a hit inside the cap stuns");
    expire(world);
  }
  const before = foe.status.damage;
  strike(world, MRGL);
  assertEquals(foe.status.damage > before, true, "the capped hit still deals damage");
  assertEquals(foe.launch.hitstun, 0, "the capped hit leaves no hitstun");
  assertEquals(foe.launch.knockbackX, 0.0, "the capped hit leaves no knockback");
  for (let frame = 0; frame < DUO_CHAIN_FREE_FRAMES - 2; frame++) expire(world);
  strike(world, GRGL);
  assertEquals(foe.launch.hitstun, 0, "19 actionable frames since the last stunning hit do not lift the cap");
  expire(world);
  strike(world, MRGL);
  assertEquals(foe.launch.hitstun > 0, true, "20 actionable frames lift it");
});
