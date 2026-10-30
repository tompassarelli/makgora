import { assertEquals, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Action, maskOf } from "../../input/actions";
import { type RowFields, inputRow } from "../../input/inputRow";
import { Phase } from "../../lobby/lobbyState";
import { adaptInput } from "../../match/inputAdapter";
import { initializeMatchFighters, stepMatch } from "../../match/step";
import { createReplaySnapshot, type ReplayState } from "../../replay/snapshot";
import { Character, DuoOrder } from "../../sim/codes";
import { createFighter } from "../../sim/fighter";
import { setWorldMotionValue } from "../../sim/motion";
import { createRoster, fighterAt } from "../../sim/roster";
import { MURLOC_DUO } from "./duo";
import { SWAP } from "./specials";

const LEADER = 0;
const FOE = 1;
const PARTNER = 2;
const LEADER_X = 100.0;
const PARTNER_X = -100.0;
const LEADER_PERCENT = 31.0;
const PARTNER_PERCENT = 47.0;
const CAST_LENGTH = SWAP.frame + 2;

const DOWN_SPECIAL: RowFields = { held: maskOf(Action.moveDown, Action.special), pressed: maskOf(Action.special), axisZ: -127, specialZ: -1 };
const DOWN_HELD: RowFields = { held: maskOf(Action.moveDown, Action.special), axisZ: -127 };

function duoMatch(): ReplayState {
  const state = createReplaySnapshot();
  const world = createRoster(3, [createFighter(Character.murloc, LEADER_X, -1), createFighter(Character.peon, 0.0, 1)]);
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
  partner.facing = -1;
  fighterAt(world, LEADER).status.damage = LEADER_PERCENT;
  partner.status.damage = PARTNER_PERCENT;
  return { ...state, world };
}

function tickOnce(state: ReplayState, tick: number, row: RowFields): void {
  const leader = inputRow(row);
  const idle = inputRow({});
  if (leader === undefined || idle === undefined) throw new Error("swap row");
  adaptInput(leader, fighterAt(state.world, LEADER), tick, state.controls.inputs[LEADER], state.controls.commands[LEADER]);
  adaptInput(idle, fighterAt(state.world, FOE), tick, state.controls.inputs[FOE], state.controls.commands[FOE]);
  stepMatch(state.match, state.world, state.controls, tick);
}

function holdDownSpecial(state: ReplayState, from: number, length: number, each?: (tick: number) => void): number {
  for (let tick = from; tick < from + length; tick++) {
    each?.(tick);
    tickOnce(state, tick, tick === from ? DOWN_SPECIAL : DOWN_HELD);
  }
  return from + length;
}

function wait(state: ReplayState, from: number, length: number): number {
  for (let tick = from; tick < from + length; tick++) tickOnce(state, tick, {});
  return from + length;
}

test("Holding Down B for the swap exchanges the two bodies' positions and leaves percent, stock and order with each [k3 measure docs/design/murloc.md]", () => {
  const state = duoMatch();
  let tick = holdDownSpecial(state, 12, CAST_LENGTH);
  tick = wait(state, tick, 20);
  const leader = fighterAt(state.world, LEADER);
  const partner = fighterAt(state.world, PARTNER);
  assertEquals(Math.abs(leader.motion.x - PARTNER_X) < 5.0, true, "Mrgl stands where Grgl stood");
  assertEquals(Math.abs(partner.motion.x - LEADER_X) < 5.0, true, "Grgl stands where Mrgl stood");
  assertEquals(leader.status.damage, LEADER_PERCENT);
  assertEquals(partner.status.damage, PARTNER_PERCENT);
  assertEquals(partner.duo?.order, DuoOrder.copy);
});

test("A second swap inside the cooldown is refused and one after it succeeds [k3 measure docs/design/murloc.md]", () => {
  const state = duoMatch();
  let tick = holdDownSpecial(state, 12, CAST_LENGTH);
  tick = wait(state, tick, 20);
  const leaderAfterFirst = fighterAt(state.world, LEADER).motion.x;
  const partnerAfterFirst = fighterAt(state.world, PARTNER).motion.x;
  tick = holdDownSpecial(state, tick, CAST_LENGTH);
  tick = wait(state, tick, 20);
  assertEquals(fighterAt(state.world, LEADER).motion.x, leaderAfterFirst, "the second swap inside the cooldown moved Mrgl");
  assertEquals(fighterAt(state.world, PARTNER).motion.x, partnerAfterFirst, "the second swap inside the cooldown moved Grgl");
  tick = wait(state, tick, MURLOC_DUO.swapCooldown);
  tick = holdDownSpecial(state, tick, CAST_LENGTH);
  wait(state, tick, 20);
  assertEquals(Math.abs(fighterAt(state.world, LEADER).motion.x - LEADER_X) < 5.0, true, "the swap after the cooldown returned Mrgl");
});

test("A swap with Grgl in hitstun is refused and spends no cooldown [k3 measure docs/design/murloc.md]", () => {
  const state = duoMatch();
  holdDownSpecial(state, 12, CAST_LENGTH, (tick) => {
    if (tick === 12 + SWAP.holdFrame - 2) fighterAt(state.world, PARTNER).launch.hitstun = SWAP.frame + 30;
  });
  const leader = fighterAt(state.world, LEADER);
  assertEquals(Math.abs(leader.motion.x - LEADER_X) < 5.0, true, "Mrgl stayed");
  assertEquals(leader.duo?.swapCooldown, 0);
});
