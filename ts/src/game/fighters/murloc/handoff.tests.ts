import { assertEquals, test } from "wisp/src/runtime/testing";
import { createMatchState } from "../../lobby/lobbyState";
import { initializeMatchFighters } from "../../match/step";
import { AttackStyle, Character, GrabAction } from "../../sim/codes";
import { HANDOFF_IMMUNE_FRAMES, HANDOFF_REPEAT_IMMUNE_FRAMES, HANDOFF_REPEAT_WINDOW_FRAMES, advanceDuoLocks } from "../../sim/duoLocks";
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

test("A chain allows one handoff, and its second throw shuts both bodies out of the foe for 90 frames [k3 measure docs/design/murloc.md]", () => {
  const world = trio();
  const foe = fighterAt(world, FOE);
  chain(world);
  assertEquals(foe.victim.grabImmuneDuo, HANDOFF_IMMUNE_FRAMES, "the second throw sets the immunity");
  assertEquals(grab(world, MRGL) || grab(world, GRGL), false, "neither body regrabs out of the second throw");
  settle(world, HANDOFF_IMMUNE_FRAMES - 1);
  assertEquals(grab(world, MRGL) || grab(world, GRGL), false, "89 frames on, both bodies are still shut out");
  settle(world, 1);
  assertEquals(grab(world, GRGL), true, "at 90 frames the foe can be grabbed again");
});

test("A repeat chain within 300 frames doubles the grab immunity to 180, and one after it does not [k3 measure docs/design/murloc.md]", () => {
  const world = trio();
  const foe = fighterAt(world, FOE);
  chain(world);
  settle(world, HANDOFF_IMMUNE_FRAMES);
  assertEquals(foe.victim.grabImmuneDuo, 0, "the first immunity has run out");
  chain(world);
  assertEquals(foe.victim.grabImmuneDuo, HANDOFF_REPEAT_IMMUNE_FRAMES, "a repeat inside the window doubles it");
  settle(world, HANDOFF_REPEAT_IMMUNE_FRAMES + HANDOFF_REPEAT_WINDOW_FRAMES);
  chain(world);
  assertEquals(foe.victim.grabImmuneDuo, HANDOFF_IMMUNE_FRAMES, "a chain after the window is a first one again");
});

test("A throw nobody follows up does not count toward a later chain [k3 measure docs/design/murloc.md]", () => {
  const world = trio();
  const foe = fighterAt(world, FOE);
  assertEquals(grab(world, MRGL), true, "the leader grabs the foe");
  throwFoe(world, MRGL);
  settle(world, 1);
  assertEquals(foe.victim.handoffs, 0, "the chain ended when the foe got up");
  assertEquals(grab(world, GRGL), true, "the partner grabs the standing foe");
  throwFoe(world, GRGL);
  assertEquals(foe.victim.grabImmuneDuo, 0, "a lone throw sets no immunity");
  assertEquals(grab(world, MRGL), true, "the leader can hand off out of it");
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
