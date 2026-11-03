import { assertEquals, test } from "wisp/src/runtime/testing";
import { createMatchState } from "../../lobby/lobbyState";
import { initializeMatchFighters } from "../../match/step";
import { AttackStyle, Character, GrabAction } from "../../sim/codes";
import { advanceDuoLocks } from "../../sim/duoLocks";
import { createFighter } from "../../sim/fighter";
import { advanceGrabs } from "../../sim/grabs";
import { applyAttackHit } from "../../sim/hits";
import { type Roster, createRoster, fighterAt } from "../../sim/roster";
import { controls, hitEffect } from "../../sim/testWorld";

const MRGL = 0;
const FOE = 1;
const GRGL = 2;
const THROW_FRAMES = 120;

const grabHit = hitEffect(0.0, 0.0, 0.0, 0.0, 0.0);

function trio(): Roster {
  const world = createRoster(3, [createFighter(Character.murloc, 0.0, 1), createFighter(Character.peon, 40.0, -1)]);
  initializeMatchFighters(createMatchState(), world);
  return world;
}

function grab(world: Roster, slot: number): boolean {
  applyAttackHit(world, slot, FOE, AttackStyle.grab, 1, grabHit, true, false);
  return fighterAt(world, FOE).grab.owner === slot;
}

function throwFoe(world: Roster, slot: number): void {
  const thrower = fighterAt(world, slot);
  const input = [controls(), controls(), controls()];
  input[slot] = controls({ grabThrowX: thrower.facing });
  let frame = 0;
  while (thrower.grab.target !== undefined && frame++ < THROW_FRAMES) advanceGrabs(world, input);
  assertEquals(thrower.grab.target, undefined, "the throw released the foe");
}

function settle(world: Roster, frames: number): void {
  const foe = fighterAt(world, FOE);
  foe.launch.hitstun = 0;
  foe.launch.throwHitstun = false;
  for (let frame = 0; frame < frames; frame++) advanceDuoLocks(world);
}

function chain(world: Roster): void {
  assertEquals(grab(world, MRGL), true, "the leader grabs the foe");
  throwFoe(world, MRGL);
  assertEquals(grab(world, GRGL), true, "the partner regrabs out of the leader's throw");
  throwFoe(world, GRGL);
}

test("A pair chain sets no grab immunity: either body can regrab out of every throw, as any grab can [k3 measure docs/design/murloc.md]", () => {
  const world = trio();
  chain(world);
  assertEquals(grab(world, MRGL), true, "the leader regrabs out of the partner's throw");
  throwFoe(world, MRGL);
  assertEquals(grab(world, GRGL), true, "the partner regrabs again");
});

test("A throw nobody follows up ends the chain once the foe is free [k3 measure docs/design/murloc.md]", () => {
  const world = trio();
  const foe = fighterAt(world, FOE);
  assertEquals(grab(world, MRGL), true, "the leader grabs the foe");
  throwFoe(world, MRGL);
  settle(world, 1);
  assertEquals(foe.victim?.handoffs ?? 0, 0, "the chain ended when the foe got up");
});

test("The pummel count carries across a handoff [k3 measure docs/design/murloc.md]", () => {
  const world = trio();
  assertEquals(grab(world, MRGL), true, "the leader grabs the foe");
  const mrgl = fighterAt(world, MRGL);
  mrgl.grab.pummels = 3;
  mrgl.grab.action = GrabAction.hold;
  throwFoe(world, MRGL);
  assertEquals(grab(world, GRGL), true, "the partner regrabs out of the throw");
  assertEquals(fighterAt(world, GRGL).grab.pummels, 3, "the partner starts at the leader's pummel count");
});
