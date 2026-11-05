import { assertEquals, test } from "wisp/src/runtime/testing";
import { at } from "wisp/src/runtime/lookup";
import { lineTokens, parseRecord, recordTokens } from "wisp/src/runtime/recordText";
import { f32 } from "wisp/src/sim/f32";
import { Action, maskOf } from "../../input/actions";
import { type RowFields, inputRow } from "../../input/inputRow";
import { Phase } from "../../lobby/lobbyState";
import { adaptInput } from "../../match/inputAdapter";
import { initializeMatchFighters, stepMatch } from "../../match/step";
import { canonicalState } from "../../replay/canonical";
import { KEYED_BY_ACTION, savedState, savedView, section } from "../../replay/moment";
import { copyReplayState, createReplaySnapshot, type ReplayState } from "../../replay/snapshot";
import { Character } from "../../sim/codes";
import { observeDamageContacts } from "../../sim/contacts";
import { type Fighter, createFighter } from "../../sim/fighter";
import { setWorldMotionValue } from "../../sim/motion";
import { createRoster, fighterAt } from "../../sim/roster";

const LEADER = 0;
const FOE = 1;
const PARTNER = 2;
const REACH = 30.0;

const JAB: RowFields = { held: maskOf(Action.attack), pressed: maskOf(Action.attack) };

function duel(): ReplayState {
  const state = createReplaySnapshot();
  const world = createRoster(3, [createFighter(Character.murloc, 0.0, 1), createFighter(Character.peon, 400.0, -1)]);
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

function place(f: Fighter, x: number, facing: number): void {
  f.motion.x = f32(x);
  setWorldMotionValue(f.motion.meleeX, f.motion.x);
  f.facing = facing;
}

function tick(state: ReplayState, frame: number, foe: RowFields): void {
  const idle = inputRow({});
  const row = inputRow(foe);
  if (idle === undefined || row === undefined) throw new Error("shared percent row");
  adaptInput(idle, fighterAt(state.world, LEADER), frame, at(state.controls.inputs, LEADER), at(state.controls.commands, LEADER));
  adaptInput(row, fighterAt(state.world, FOE), frame, at(state.controls.inputs, FOE), at(state.controls.commands, FOE));
  stepMatch(state.match, state.world, state.controls, frame);
}

function run(state: ReplayState, from: number, frames: number, jabAt = -1): number {
  for (let frame = from; frame < from + frames; frame++) tick(state, frame, frame === jabAt ? JAB : {});
  return from + frames;
}

function jab(state: ReplayState, from: number, target: number): { readonly frame: number; readonly damage: number } {
  const victim = fighterAt(state.world, target);
  place(fighterAt(state.world, FOE), victim.motion.x + victim.facing * REACH, -victim.facing);
  let damage = 0.0;
  observeDamageContacts((source, struck, dealt) => {
    if (source === FOE && struck === target) damage = dealt;
  });
  const frame = run(state, from, 40, from);
  observeDamageContacts(undefined);
  assertEquals(damage > 0.0, true, `the foe's jab reaches slot ${target}`);
  return { frame, damage };
}

function throughText(state: ReplayState): ReplayState {
  const tokens = recordTokens(savedView(state), KEYED_BY_ACTION);
  const record = tokens === undefined ? undefined : parseRecord(lineTokens(section("state", tokens).map(line => line.substring("state ".length))));
  const loaded = record === undefined ? undefined : savedState(record);
  if (loaded === undefined) throw new Error("the saved state did not load");
  const restored = createReplaySnapshot();
  copyReplayState(restored, loaded);
  return restored;
}

const percents = (state: ReplayState): readonly [number, number] => [fighterAt(state.world, LEADER).status.damage, fighterAt(state.world, PARTNER).status.damage];

test("The pair's percent survives a saved-state load and a rollback [k1 scenario]", () => {
  const live = duel();
  place(fighterAt(live.world, PARTNER), -200.0, 1);
  const saved = jab(live, 1, PARTNER).frame;
  const loaded = throughText(live);
  assertEquals(percents(loaded)[0], percents(live)[0], "the saved state restores Mrgl's percent");
  assertEquals(percents(loaded)[1], percents(live)[1], "the saved state restores Grgl's percent");
  const back = createReplaySnapshot();
  copyReplayState(back, live);
  const end = jab(live, saved, LEADER).frame;
  const ahead = canonicalState(live);
  copyReplayState(live, back);
  assertEquals(jab(live, saved, LEADER).frame, end);
  assertEquals(canonicalState(live), ahead, "the resimulated frames reach the same state");
  jab(loaded, saved, LEADER);
  assertEquals(canonicalState(loaded), ahead, "the loaded state reaches the same state");
  assertEquals(percents(live)[0], percents(live)[1], "both bodies show one percent");
});
