import { assertEquals, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Action, maskOf } from "../../input/actions";
import { type RowFields, inputRow } from "../../input/inputRow";
import { Phase } from "../../lobby/lobbyState";
import { adaptInput } from "../../match/inputAdapter";
import { initializeMatchFighters, stepMatch } from "../../match/step";
import { observeDamageContacts } from "../../sim/contacts";
import { createReplaySnapshot, type ReplayState } from "../../replay/snapshot";
import { Character, DuoOrder, HeroStatusKind } from "../../sim/codes";
import { createFighter } from "../../sim/fighter";
import { setWorldMotionValue } from "../../sim/motion";
import { createRoster, fighterAt } from "../../sim/roster";
import { MURLOC_DUO } from "./duo";
import { ORDER } from "./specials";

const LEADER = 0;
const FOE = 1;
const PARTNER = 2;
const LEADER_X = 100.0;
const PARTNER_X = -100.0;
const ORDER_TICK = 12;
const ACT_TICK = ORDER_TICK + ORDER.endFrame + 20;

const DOWN_SPECIAL: RowFields = { held: maskOf(Action.moveDown, Action.special), pressed: maskOf(Action.special), axisZ: -127, specialZ: -1 };
const SIDE_SPECIAL_TOWARD_FOE: RowFields = { held: maskOf(Action.special), pressed: maskOf(Action.special), specialX: -1, axisX: -127 };
const NEUTRAL_SPECIAL: RowFields = { held: maskOf(Action.special), pressed: maskOf(Action.special) };

interface Hit { readonly source: number; readonly damage: number }

function pincer(): ReplayState {
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
  return { ...state, world };
}

function tickOnce(state: ReplayState, tick: number, row: RowFields): void {
  const leader = inputRow(row);
  const idle = inputRow({});
  if (leader === undefined || idle === undefined) throw new Error("orders row");
  adaptInput(leader, fighterAt(state.world, LEADER), tick, state.controls.inputs[LEADER], state.controls.commands[LEADER]);
  adaptInput(idle, fighterAt(state.world, FOE), tick, state.controls.inputs[FOE], state.controls.commands[FOE]);
  stepMatch(state.match, state.world, state.controls, tick);
}

function ordered(act: RowFields, length: number): { readonly hits: Hit[]; readonly rooted: number; readonly state: ReplayState; readonly heldX: number } {
  const state = pincer();
  const hits: Hit[] = [];
  let rooted = 0;
  let heldX = Number.NaN;
  let wasRooted = false;
  observeDamageContacts((source, target, damage) => {
    if (target === FOE) hits.push({ source, damage });
  });
  for (let tick = 1; tick <= ACT_TICK + length; tick++) {
    if (tick === ACT_TICK) heldX = fighterAt(state.world, PARTNER).motion.x;
    tickOnce(state, tick, tick === ORDER_TICK ? DOWN_SPECIAL : tick === ACT_TICK ? act : {});
    const isRooted = fighterAt(state.world, FOE).status.condition === HeroStatusKind.root;
    if (isRooted && !wasRooted) rooted++;
    wasRooted = isRooted;
  }
  observeDamageContacts(undefined);
  return { hits, rooted, state, heldX };
}

test("With a foe between them, Hold plus Side B slides both bodies toward the foe [k3 measure docs/design/murloc.md]", () => {
  const { hits, state, heldX } = ordered(SIDE_SPECIAL_TOWARD_FOE, 40);
  assertEquals(fighterAt(state.world, PARTNER).duo?.order, DuoOrder.hold);
  assertEquals(heldX, PARTNER_X, "Grgl planted where the order found him");
  assertEquals(fighterAt(state.world, LEADER).motion.x < LEADER_X - 20.0, true, "Mrgl slid toward the foe");
  assertEquals(fighterAt(state.world, PARTNER).motion.x > PARTNER_X + 20.0, true, "Grgl slid toward the foe");
  assertEquals(hits.some(hit => hit.source === LEADER), true, "Mrgl's slide hit");
  assertEquals(hits.some(hit => hit.source === PARTNER), true, "Grgl's slide hit");
});

test("With a foe between them, Hold plus Neutral B roots the foe once [k3 measure docs/design/murloc.md]", () => {
  const { hits, rooted } = ordered(NEUTRAL_SPECIAL, 90);
  assertEquals(hits.some(hit => hit.source === LEADER) && hits.some(hit => hit.source === PARTNER), true, "both nets land");
  assertEquals(rooted, 1);
});

test("A second Down B regroups Grgl, and Hold ends by itself after the hold limit [k3 measure docs/design/murloc.md]", () => {
  const again = ordered({}, 0);
  tickOnce(again.state, ACT_TICK + 1, DOWN_SPECIAL);
  for (let tick = ACT_TICK + 2; tick <= ACT_TICK + 1 + ORDER.endFrame; tick++) tickOnce(again.state, tick, {});
  const regrouping = fighterAt(again.state.world, PARTNER).duo?.order;
  assertEquals(regrouping === DuoOrder.regroup || regrouping === DuoOrder.copy, true, "the second tap leaves Hold");
  const left = pincer();
  for (let tick = 1; tick <= ORDER_TICK + MURLOC_DUO.holdFrames + 5; tick++) tickOnce(left, tick, tick === ORDER_TICK ? DOWN_SPECIAL : {});
  const order = fighterAt(left.world, PARTNER).duo?.order;
  assertEquals(order === DuoOrder.regroup || order === DuoOrder.copy, true, "Hold ran out");
});
