import { f32 } from "wisp/src/sim/f32";
import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { Action, maskOf } from "../../input/actions";
import { type RowFields, inputRow } from "../../input/inputRow";
import { Phase } from "../../lobby/lobbyState";
import { adaptInput } from "../../match/inputAdapter";
import { initializeMatchFighters, stepMatch } from "../../match/step";
import { observeDamageContacts } from "../../sim/contacts";
import { createReplaySnapshot, type ReplayState } from "../../replay/snapshot";
import { Character } from "../../sim/codes";
import { createFighter } from "../../sim/fighter";
import { createRoster, fighterAt } from "../../sim/roster";
import { BELLY_SLIDE } from "./specials";

const LEADER = 0;
const FOE = 1;
const PARTNER = 2;
const FOE_AHEAD = 60.0;

const SIDE_SPECIAL: RowFields = { held: maskOf(Action.special), pressed: maskOf(Action.special), specialX: 1, axisX: 127 };
const SHIELD: RowFields = { held: maskOf(Action.leftTrigger), pressed: 0, triggerLeft: 255 };

interface Hit { readonly source: number; readonly damage: number }

function duel(foeX: number): ReplayState {
  const state = createReplaySnapshot();
  const world = createRoster(3, [createFighter(Character.murloc, 0.0, 1), createFighter(Character.peon, foeX, -1)]);
  const match = state.match;
  match.phase = Phase.match;
  match.stageChoice = 0;
  match.startHold = 0;
  match.hazards = false;
  match.items.on = false;
  match.timeLimitMinutes = 0;
  match.ultimatesOff = true;
  initializeMatchFighters(match, world);
  return { ...state, world };
}

function slide(foeX: number, shielding: boolean): { readonly hits: Hit[]; readonly state: ReplayState } {
  const state = duel(foeX);
  const hits: Hit[] = [];
  observeDamageContacts((source, target, damage) => {
    if (target === FOE) hits.push({ source, damage });
  });
  for (let tick = 1; tick <= 12 + BELLY_SLIDE.lastFrame + 40; tick++) {
    const leader = inputRow(tick === 12 ? SIDE_SPECIAL : {});
    const foe = inputRow(shielding ? SHIELD : {});
    if (leader === undefined || foe === undefined) throw new Error("slide row");
    adaptInput(leader, fighterAt(state.world, LEADER), tick, state.controls.inputs[LEADER], state.controls.commands[LEADER]);
    adaptInput(foe, fighterAt(state.world, FOE), tick, state.controls.inputs[FOE], state.controls.commands[FOE]);
    stepMatch(state.match, state.world, state.controls, tick);
  }
  observeDamageContacts(undefined);
  return { hits, state };
}

test("A synced pair's Belly Slide hits a standing foe once per body, Mrgl first for 5% [k3 measure docs/design/murloc.md]", () => {
  const { hits } = slide(FOE_AHEAD, false);
  assertEquals(hits.length, 2, "one hit per body");
  assertEquals(hits[0]?.source, LEADER);
  assertEquals(hits[0]?.damage, 5.0);
  assertEquals(hits[1]?.source, PARTNER);
  assertEquals(hits[1]?.damage, f32(5.0 * 0.75), "Grgl's slide hit deals three quarters of Mrgl's, 3.75%");
});

test("A raised shield stops both bodies' Belly Slides [k3 measure docs/design/murloc.md]", () => {
  const { hits, state } = slide(FOE_AHEAD, true);
  assertEquals(hits.length, 0, "no damage reaches the foe");
  assertEquals(fighterAt(state.world, FOE).status.damage, 0);
  assertTrue(fighterAt(state.world, LEADER).motion.x < fighterAt(state.world, FOE).motion.x);
  assertTrue(fighterAt(state.world, PARTNER).motion.x < fighterAt(state.world, FOE).motion.x);
});
