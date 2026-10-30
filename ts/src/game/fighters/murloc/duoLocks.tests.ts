import { assertEquals, test } from "wisp/src/runtime/testing";
import { createMatchState } from "../../lobby/lobbyState";
import { initializeMatchFighters } from "../../match/step";
import { Character, ContactKind, GrabAction } from "../../sim/codes";
import { queueDamageContact } from "../../sim/contacts";
import { DUO_CHAIN_CAP, DUO_CHAIN_FREE_FRAMES, DUO_SHIELD_STUN_CAP, advanceDuoLocks } from "../../sim/duoLocks";
import { SHIELD_MAX, createFighter } from "../../sim/fighter";
import { type Roster, createRoster, fighterAt } from "../../sim/roster";
import { contactBatch, hitEffect } from "../../sim/testWorld";

const MRGL = 0;
const FOE = 1;
const GRGL = 2;

const jab = hitEffect(3.0, 100.0, 40.0, 0.699999988079071, 0.699999988079071);
const heavy = hitEffect(25.0, 100.0, 40.0, 0.699999988079071, 0.699999988079071);

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

function hold(world: Roster): void {
  const mrgl = fighterAt(world, MRGL);
  const foe = fighterAt(world, FOE);
  mrgl.grab.target = FOE;
  mrgl.grab.action = GrabAction.hold;
  foe.grab.owner = MRGL;
  foe.grab.grabbedFrames = 90;
}

test("A pummel body's linked partner strikes a held foe for nothing, and without the link the same tilt releases it [k3 measure docs/design/murloc.md]", () => {
  const world = trio();
  hold(world);
  const foe = fighterAt(world, FOE);
  strike(world, GRGL);
  assertEquals(foe.status.damage, 0.0, "the partner's tilt deals no damage to a foe his leader holds");
  assertEquals(foe.grab.owner, MRGL, "the leader still holds the foe");
  assertEquals(foe.grab.grabbedFrames, 90, "the tilt leaves the escape timer alone");
  contactBatch(world, () => queueDamageContact(world, MRGL, FOE, jab, 1, ContactKind.pummel, true, undefined));
  assertEquals(foe.status.damage > 0.0, true, "the leader's own pummel still lands");
  world.linked[GRGL] = -1;
  world.linked[MRGL] = -1;
  strike(world, GRGL);
  assertEquals(foe.grab.owner, undefined, "an unlinked body's tilt releases the foe");
});

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

test("Shieldstun from the pair stops at 30 consecutive frames and returns after the shield is free for 10 [k3 measure docs/design/murloc.md]", () => {
  const world = trio();
  const foe = fighterAt(world, FOE);
  foe.shield.raised = true;
  let run = 0;
  let longest = 0;
  let cappedHits = 0;
  let nextHit = 0;
  for (let frame = 0; frame < 120; frame++) {
    if (frame === nextHit) {
      nextHit += 8;
      foe.shield.energy = SHIELD_MAX;
      const energy = foe.shield.energy;
      strike(world, nextHit > 40 ? MRGL : GRGL, heavy);
      if (foe.shield.stun === 0) {
        cappedHits++;
        assertEquals(foe.shield.energy < energy, true, "a capped hit still damages the shield");
      }
    }
    run = foe.shield.stun > 0 ? run + 1 : 0;
    longest = Math.max(longest, run);
    advanceDuoLocks(world);
    foe.shield.stun = Math.max(0, foe.shield.stun - 1);
  }
  assertEquals(longest, DUO_SHIELD_STUN_CAP, "the longest shieldstun run is the cap");
  assertEquals(cappedHits > 0, true, "hits past the cap stun nothing");
});

test("The partner's hit on a foe already in hitstun adds knockback but not hitstun [k3 measure docs/design/murloc.md]", () => {
  const world = trio();
  const foe = fighterAt(world, FOE);
  foe.launch.hitstun = 6;
  strike(world, GRGL, heavy);
  assertEquals(foe.launch.hitstun <= 6, true, "the partner's hit does not extend hitstun");
  assertEquals(foe.launch.knockbackX !== 0.0 || foe.launch.knockbackZ !== 0.0, true, "the partner's own knockback applies");
  foe.launch.hitstun = 6;
  foe.status.struckBy = MRGL;
  strike(world, MRGL, jab);
  assertEquals(foe.launch.hitstun >= 6, true, "the pair's hitstun takes the maximum");
});
