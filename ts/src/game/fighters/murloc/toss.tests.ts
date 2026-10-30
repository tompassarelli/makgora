import { assertEquals, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Action, maskOf } from "../../input/actions";
import { type RowFields, inputRow } from "../../input/inputRow";
import { Phase } from "../../lobby/lobbyState";
import { adaptInput } from "../../match/inputAdapter";
import { initializeMatchFighters, stepMatch } from "../../match/step";
import { observeDamageContacts } from "../../sim/contacts";
import { createReplaySnapshot, type ReplayState } from "../../replay/snapshot";
import { Character, DuoOrder } from "../../sim/codes";
import { TOSS } from "../../sim/duoToss";
import { canStartAttack } from "../../sim/conditions";
import { createFighter } from "../../sim/fighter";
import { setWorldMotionValue } from "../../sim/motion";
import { createRoster, fighterAt } from "../../sim/roster";

const LEADER = 0;
const FOE = 1;
const PARTNER = 2;
const FOE_X = 250.0;
const PARTNER_X = 20.0;
const GRAB_WAIT = 30;
const FLIGHT = 120;

const GRAB: RowFields = { held: maskOf(Action.grab), pressed: maskOf(Action.grab) };
const JUMP: RowFields = { held: maskOf(Action.jump), pressed: maskOf(Action.jump) };
const WALK = 20;
const WALK_RIGHT: RowFields = { held: maskOf(Action.moveRight), pressed: maskOf(Action.moveRight), axisX: 127 };
const THROW_FORWARD: RowFields = { held: maskOf(Action.moveRight), pressed: maskOf(Action.moveRight), axisX: 127, throwX: 1 };

function duel(): ReplayState {
  const state = createReplaySnapshot();
  const world = createRoster(3, [createFighter(Character.murloc, 0.0, 1), createFighter(Character.peon, FOE_X, -1)]);
  const match = state.match;
  match.phase = Phase.match;
  match.stageChoice = 0;
  match.startHold = 0;
  match.hazards = false;
  match.items.on = false;
  match.timeLimitMinutes = 0;
  match.ultimatesOff = true;
  initializeMatchFighters(match, world);
  const partner = fighterAt(world, PARTNER);
  partner.motion.x = f32(PARTNER_X);
  setWorldMotionValue(partner.motion.meleeX, partner.motion.x);
  return { ...state, world };
}

function tickOnce(state: ReplayState, tick: number, row: RowFields): void {
  const leader = inputRow(row);
  const idle = inputRow({});
  if (leader === undefined || idle === undefined) throw new Error("toss row");
  adaptInput(leader, fighterAt(state.world, LEADER), tick, state.controls.inputs[LEADER], state.controls.commands[LEADER]);
  adaptInput(idle, fighterAt(state.world, FOE), tick, state.controls.inputs[FOE], state.controls.commands[FOE]);
  stepMatch(state.match, state.world, state.controls, tick);
}

function liftAndThrow(state: ReplayState, from: number): number {
  const leader = fighterAt(state.world, LEADER);
  let tick = from;
  tickOnce(state, tick++, GRAB);
  for (let wait = 0; wait < GRAB_WAIT && leader.grab.target === undefined; wait++) tickOnce(state, tick++, {});
  if (leader.grab.target === undefined) return tick;
  for (let wait = 0; wait < GRAB_WAIT && leader.grab.target !== undefined; wait++) tickOnce(state, tick++, THROW_FORWARD);
  return tick;
}

test("A forward toss hits a foe at 250 units once, and Grgl lands back on the copied input [k3 measure docs/design/murloc.md]", () => {
  const state = duel();
  const hits: number[] = [];
  observeDamageContacts((source, target, damage) => {
    if (source === PARTNER && target === FOE) hits.push(damage);
  });
  let tick = liftAndThrow(state, 1);
  const partner = fighterAt(state.world, PARTNER);
  assertEquals(partner.duo?.order, DuoOrder.tossed, "the throw left Grgl tossed");
  let farthest = partner.motion.x;
  for (let frame = 0; frame < FLIGHT; frame++) {
    tickOnce(state, tick++, {});
    farthest = Math.max(farthest, partner.motion.x);
  }
  observeDamageContacts(undefined);
  assertEquals(hits.length, 1, "the foe was hit once");
  assertEquals(hits[0], 6.0, "the toss deals 6%");
  assertEquals(partner.duo?.order !== DuoOrder.hold && partner.duo?.order !== DuoOrder.tossed, true, "Grgl landed out of Hold");
  assertEquals(partner.motion.grounded, true);
  assertEquals(farthest > FOE_X, true, "the toss carried past the foe");
});

test("A second grab inside the toss cooldown lifts nothing, and the same grab lifts Grgl once the cooldown ends [k3 measure docs/design/murloc.md]", () => {
  const state = duel();
  let tick = liftAndThrow(state, 1);
  for (let frame = 0; frame < FLIGHT; frame++) tickOnce(state, tick++, {});
  const leader = fighterAt(state.world, LEADER);
  const partner = fighterAt(state.world, PARTNER);
  assertEquals(partner.duo?.order !== DuoOrder.tossed, true);
  assertEquals(leader.duo?.tossCooldown !== undefined && leader.duo.tossCooldown > 0 && leader.duo.tossCooldown < TOSS.cooldownFrames, true, "the cooldown is running");
  partner.motion.x = f32(PARTNER_X);
  setWorldMotionValue(partner.motion.meleeX, partner.motion.x);
  tick = liftAndThrow(state, tick);
  assertEquals(partner.duo?.order !== DuoOrder.tossed, true, "the second grab refused the lift");
  assertEquals(partner.grab.owner, undefined);
  if (leader.duo === undefined) throw new Error("leader duo");
  for (let frame = 0; frame < GRAB_WAIT; frame++) tickOnce(state, tick++, {});
  leader.duo.tossCooldown = 0;
  partner.motion.x = f32(leader.motion.x + PARTNER_X);
  setWorldMotionValue(partner.motion.meleeX, partner.motion.x);
  liftAndThrow(state, tick);
  assertEquals(partner.duo?.order, DuoOrder.tossed, "with the cooldown spent the grab lifts and tosses him");
});

function flyFarthest(state: ReplayState, tick: number): number {
  const partner = fighterAt(state.world, PARTNER);
  let farthest = partner.motion.x;
  for (let frame = 0; frame < FLIGHT; frame++) {
    tickOnce(state, tick++, {});
    farthest = Math.max(farthest, partner.motion.x);
  }
  return farthest;
}

test("A forward toss with no foe in the way carries Grgl about 375 units [k3 measure docs/design/murloc.md]", () => {
  const state = duel();
  fighterAt(state.world, FOE).motion.x = f32(5000.0);
  const tick = liftAndThrow(state, 1);
  const start = fighterAt(state.world, PARTNER).motion.x;
  const reach = flyFarthest(state, tick) - start;
  assertEquals(reach >= 368.0 && reach <= 385.0, true, `the toss carried ${reach} units`);
});

test("Grgl takes no hitlag from his body's hit and can act the frame he touches ground after a toss [k3 measure docs/design/murloc.md]", () => {
  const state = duel();
  let tick = liftAndThrow(state, 1);
  const partner = fighterAt(state.world, PARTNER);
  let struck = false;
  let landed = false;
  for (let frame = 0; frame < FLIGHT && !landed; frame++) {
    tickOnce(state, tick++, {});
    if (fighterAt(state.world, FOE).launch.hitlag > 0) {
      struck = true;
      assertEquals(partner.launch.hitlag, 0, "Grgl took no hitlag from the hit");
    }
    landed = partner.motion.grounded;
  }
  assertEquals(struck, true, "the toss struck the foe");
  assertEquals(landed, true, "Grgl touched ground");
  assertEquals(partner.landing.lag, 0, "Grgl landed with no landing lag");
  assertEquals(canStartAttack(partner), true, "Grgl can start an action the frame he lands");
});

test("A jump pressed the frame after release double-jumps Grgl while Mrgl, still in end lag, stays put [k3 measure docs/design/murloc.md]", () => {
  const state = duel();
  fighterAt(state.world, FOE).motion.x = f32(5000.0);
  let tick = liftAndThrow(state, 1);
  const leader = fighterAt(state.world, LEADER);
  const partner = fighterAt(state.world, PARTNER);
  assertEquals(partner.duo?.order, DuoOrder.tossed);
  const remaining = partner.jump.remaining;
  const leaderBefore = { x: leader.motion.x, z: leader.motion.z, grounded: leader.motion.grounded };
  const peak = partner.motion.vz;
  tickOnce(state, tick++, JUMP);
  assertEquals(partner.jump.remaining, remaining - 1, "Grgl spent an air jump the frame the press arrived");
  assertEquals(partner.motion.vz > peak - 1.0, true, "the jump lifted Grgl");
  assertEquals(leader.motion.x, leaderBefore.x, "Mrgl did not move");
  assertEquals(leader.motion.z, leaderBefore.z);
  assertEquals(leader.motion.grounded, leaderBefore.grounded);
  assertEquals(leader.jump.squat, 0, "Mrgl did not start a jump");
});

test("After a forward toss lands, Grgl is back on the copied input and a held walk moves him instead of leaving him planted [k3 measure docs/design/murloc.md]", () => {
  const state = duel();
  fighterAt(state.world, FOE).motion.x = f32(5000.0);
  let tick = liftAndThrow(state, 1);
  const partner = fighterAt(state.world, PARTNER);
  for (let frame = 0; frame < FLIGHT && !partner.motion.grounded; frame++) tickOnce(state, tick++, {});
  assertEquals(partner.motion.grounded, true, "Grgl landed");
  tickOnce(state, tick++, {});
  assertEquals(partner.duo?.order, DuoOrder.copy, "the toss ended in copy, not Hold");
  const landed = partner.motion.x;
  for (let frame = 0; frame < WALK; frame++) tickOnce(state, tick++, WALK_RIGHT);
  assertEquals(Math.abs(partner.motion.x - landed) > 5.0, true, "Grgl walked on the next frames");
});
