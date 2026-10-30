import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { Action, maskOf } from "../../input/actions";
import { type RowFields, inputRow } from "../../input/inputRow";
import { Phase } from "../../lobby/lobbyState";
import { adaptInput } from "../../match/inputAdapter";
import { initializeMatchFighters, stepMatch } from "../../match/step";
import { createReplaySnapshot, type ReplayState } from "../../replay/snapshot";
import { observeDamageContacts } from "../../sim/contacts";
import { Character } from "../../sim/codes";
import { partnerDeparts } from "../../sim/duoPartner";
import { createFighter } from "../../sim/fighter";
import { createRoster, fighterAt } from "../../sim/roster";
import { REVIVE } from "./specials";

const LEADER = 0;
const FOE = 1;
const PARTNER = 2;
const CAST_START = 12;
const FOE_AHEAD = 30.0;

const DOWN_SPECIAL: RowFields = { held: maskOf(Action.moveDown, Action.special), pressed: maskOf(Action.special), axisZ: -127, specialZ: -1 };
const FOE_JAB: RowFields = { held: maskOf(Action.attack), pressed: maskOf(Action.attack) };

function duel(): ReplayState {
  const state = createReplaySnapshot();
  const world = createRoster(3, [createFighter(Character.murloc, 0.0, 1), createFighter(Character.peon, FOE_AHEAD, -1)]);
  const match = state.match;
  match.phase = Phase.match;
  match.stageChoice = 0;
  match.startHold = 0;
  match.hazards = false;
  match.items.on = false;
  match.timeLimitMinutes = 0;
  match.ultimatesOff = true;
  initializeMatchFighters(match, world);
  partnerDeparts(world, PARTNER);
  return { ...state, world };
}

function cast(state: ReplayState, tick: number, casts: readonly number[], foeJabFrom: number | undefined): void {
  const leaderFighter = fighterAt(state.world, LEADER);
  const castFrame = leaderFighter.special.frame;
  const leader = inputRow(casts.includes(tick) ? DOWN_SPECIAL : {});
  const foe = inputRow(foeJabFrom !== undefined && castFrame >= foeJabFrom ? FOE_JAB : {});
  if (leader === undefined || foe === undefined) throw new Error("revive row");
  adaptInput(leader, leaderFighter, tick, state.controls.inputs[LEADER], state.controls.commands[LEADER]);
  adaptInput(foe, fighterAt(state.world, FOE), tick, state.controls.inputs[FOE], state.controls.commands[FOE]);
  stepMatch(state.match, state.world, state.controls, tick);
}

function run(state: ReplayState, from: number, to: number, casts: readonly number[], foeJabFrom?: number): void {
  for (let tick = from; tick <= to; tick++) cast(state, tick, casts, foeJabFrom);
}

test("Down B with Grgl down brings him back at 0% beside Mrgl and spends the revive [k3 measure docs/design/murloc.md]", () => {
  const state = duel();
  fighterAt(state.world, PARTNER).status.damage = 55.0;
  let tick = 0;
  while (fighterAt(state.world, LEADER).special.frame < REVIVE.frame - 1) cast(state, ++tick, [CAST_START], undefined);
  assertEquals(fighterAt(state.world, LEADER).special.frame, REVIVE.frame - 1);
  assertEquals(fighterAt(state.world, PARTNER).status.out, true, "Grgl is still down before the cast lands");
  cast(state, ++tick, [CAST_START], undefined);
  const leader = fighterAt(state.world, LEADER);
  const partner = fighterAt(state.world, PARTNER);
  assertEquals(partner.status.out, false, "Grgl is back");
  assertEquals(partner.status.stocks, 1, "Grgl is alive");
  assertEquals(partner.status.damage, 0.0, "he returns at 0%");
  assertTrue(partner.motion.grounded);
  assertTrue(Math.abs(partner.motion.x - leader.motion.x) <= REVIVE.offsetX + 1.0);
  assertEquals(leader.duo?.reviveSpent, true, "the revive is spent");
});

test("A second Down B with Grgl down again does nothing [k3 measure docs/design/murloc.md]", () => {
  const state = duel();
  run(state, 1, CAST_START + REVIVE.endFrame + 20, [CAST_START]);
  assertEquals(fighterAt(state.world, PARTNER).status.out, false);
  partnerDeparts(state.world, PARTNER);
  const again = CAST_START + REVIVE.endFrame + 40;
  run(state, CAST_START + REVIVE.endFrame + 21, again + REVIVE.endFrame + 10, [again]);
  assertEquals(fighterAt(state.world, PARTNER).status.out, true, "Grgl stays down");
  assertEquals(fighterAt(state.world, LEADER).special.frame, 0, "Mrgl is not casting");
});

test("A hit at cast frame 30 cancels the revive and leaves it unspent [k3 measure docs/design/murloc.md]", () => {
  const state = duel();
  const struck: number[] = [];
  observeDamageContacts((_source, target) => {
    if (target === LEADER) struck.push(fighterAt(state.world, LEADER).special.frame);
  });
  run(state, 1, CAST_START + REVIVE.endFrame + 20, [CAST_START], 30);
  observeDamageContacts(undefined);
  assertTrue(struck.length > 0);
  assertTrue((struck[0] ?? 0) >= 30 && (struck[0] ?? 0) < REVIVE.frame);
  assertEquals(fighterAt(state.world, PARTNER).status.out, true, "Grgl stays down");
  assertEquals(fighterAt(state.world, LEADER).duo?.reviveSpent, false, "the revive is unspent");
});
