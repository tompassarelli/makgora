import { assertEquals, test } from "wisp/src/runtime/testing";
import { createMatchState } from "../../lobby/lobbyState";
import { initializeMatchFighters } from "../../match/step";
import { canonicalState } from "../../replay/canonical";
import { createReplaySnapshot } from "../../replay/snapshot";
import { Character, DuoRole } from "../../sim/codes";
import { createFighter } from "../../sim/fighter";
import { createRoster, fighterAt, type Roster } from "../../sim/roster";
import { canHit } from "../../sim/teams";

function seated(mask: number, characters: readonly Character[]): Roster {
  const world = createRoster(mask, characters.map((character, slot) => createFighter(character, slot * 100.0, slot === 0 || slot === 2 ? 1 : -1)));
  initializeMatchFighters(createMatchState(), world);
  return world;
}

test("A Murlocs duel seats the partner in slot 2, linked to the leader in slot 0 [k3 measure docs/design/murloc.md]", () => {
  const world = seated(3, [Character.murloc, Character.peon]);
  assertEquals(world.mask, 7, "the partner's world bit is set");
  const partner = fighterAt(world, 2);
  assertEquals(partner.character, Character.murloc, "the partner is a Murloc");
  assertEquals(partner.duo.role, DuoRole.partner, "slot 2 is the partner");
  assertEquals(partner.duo.link, 0, "the partner links to the leader");
  assertEquals(fighterAt(world, 0).duo.role, DuoRole.leader, "slot 0 is the leader");
  assertEquals(fighterAt(world, 0).duo.link, 2, "the leader links to the partner");
  assertEquals(world.linked[2], 0, "the world links slot 2 to slot 0");
  assertEquals(world.linked[0], 2, "the world links slot 0 to slot 2");
  assertEquals(fighterAt(world, 1).duo.role, DuoRole.solo, "the foe is no duo");
});

test("Four participants leave no free slot, so the Murloc plays solo [k3 measure docs/design/murloc.md]", () => {
  const world = seated(15, [Character.murloc, Character.peon, Character.peon, Character.peon]);
  assertEquals(world.mask, 15, "no body is added");
  assertEquals(fighterAt(world, 0).duo.role, DuoRole.solo, "the Murloc is solo");
  assertEquals(fighterAt(world, 0).duo.link, -1, "a solo Murloc links to nobody");
  assertEquals(world.linked[0], -1, "the world links nothing");
});

test("Two Murlocs in a three-slot match give the one free slot to the lower slot [k3 measure docs/design/murloc.md]", () => {
  const world = seated(7, [Character.murloc, Character.murloc, Character.peon]);
  assertEquals(world.mask, 15, "the free slot is filled");
  assertEquals(fighterAt(world, 3).duo.link, 0, "the lower Murloc has the partner");
  assertEquals(fighterAt(world, 0).duo.role, DuoRole.leader, "slot 0 leads");
  assertEquals(fighterAt(world, 1).duo.role, DuoRole.solo, "slot 1 is solo");
});

test("The partner's role is in the canonical text and a linked pair cannot hit each other under friendly fire [k3 measure docs/design/murloc.md]", () => {
  const state = { ...createReplaySnapshot(), world: seated(3, [Character.murloc, Character.peon]) };
  assertEquals(canonicalState(state).includes("fighter[2].duo.role"), true, "the canonical text carries fighter[2].duo.role");
  state.world.teamBattle = true;
  state.world.friendlyFire = true;
  state.world.teamChoices[1] = state.world.teamChoices[0];
  assertEquals(canHit(state.world, 0, 2), false, "leader and partner never hit each other");
  assertEquals(canHit(state.world, 2, 0), false, "partner and leader never hit each other");
  assertEquals(canHit(state.world, 0, 1), true, "friendly fire still lets unlinked teammates hit");
});
