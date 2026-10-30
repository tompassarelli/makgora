import { assertEquals, test } from "wisp/src/runtime/testing";
import { at } from "wisp/src/runtime/lookup";
import { lineTokens, parseRecord, recordTokens } from "wisp/src/runtime/recordText";
import { multiplyFloat32 } from "wisp/src/sim/binary32";
import { f32 } from "wisp/src/sim/f32";
import { Action, maskOf } from "../../input/actions";
import { type RowFields, inputRow } from "../../input/inputRow";
import { Phase } from "../../lobby/lobbyState";
import { adaptInput } from "../../match/inputAdapter";
import { initializeMatchFighters, stepMatch } from "../../match/step";
import { canonicalState } from "../../replay/canonical";
import { KEYED_BY_ACTION, savedState, savedView, section } from "../../replay/moment";
import { copyReplayState, createReplaySnapshot, type ReplayState } from "../../replay/snapshot";
import { Character, ContactKind } from "../../sim/codes";
import { observeDamageContacts, queueDamageContact } from "../../sim/contacts";
import { type Fighter, createFighter } from "../../sim/fighter";
import { knockbackWeight } from "../../sim/itemBuffs";
import { effectKnockback } from "../../sim/knockback";
import { setWorldMotionValue } from "../../sim/motion";
import { createRoster, fighterAt } from "../../sim/roster";
import { contactBatch, hitEffect } from "../../sim/testWorld";
import { MURLOC_PARTNER } from "./partner";

const LEADER = 0;
const FOE = 1;
const PARTNER = 2;
const REACH = 30.0;
const OFF_STAGE = 10000.0;
const PAIR_PERCENT = 40.0;

const JAB: RowFields = { held: maskOf(Action.attack), pressed: maskOf(Action.attack) };
const heavy = hitEffect(12.0, 100.0, 40.0, 0.699999988079071, 0.699999988079071);

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

const launchSpeed = (f: Readonly<Fighter>): number => Math.sqrt(f.launch.knockbackX * f.launch.knockbackX + f.launch.knockbackZ * f.launch.knockbackZ);

test("A hit on Grgl and a hit on Mrgl each add to the pair's one percent, Grgl's at 1.02x [k3 measure docs/design/murloc.md]", () => {
  const state = duel();
  place(fighterAt(state.world, PARTNER), -200.0, 1);
  const onGrgl = jab(state, 1, PARTNER);
  const afterGrgl = multiplyFloat32(onGrgl.damage, MURLOC_PARTNER.taken);
  assertEquals(percents(state)[1], afterGrgl, "Grgl takes 1.02x the jab");
  assertEquals(percents(state)[0], afterGrgl, "Mrgl shows the same percent");
  const onMrgl = jab(state, onGrgl.frame, LEADER);
  assertEquals(percents(state)[0], f32(afterGrgl + onMrgl.damage), "Mrgl's hit adds to the pair's percent");
  assertEquals(percents(state)[1], percents(state)[0], "Grgl shows the same percent");
});

test("Knockback on Grgl reads the pair's percent and takes 1.02x with his own weight [k3 measure docs/design/murloc.md]", () => {
  const fresh = duel();
  contactBatch(fresh.world, () => queueDamageContact(fresh.world, FOE, PARTNER, heavy, 1, ContactKind.launch, true, undefined));
  const hurt = duel();
  place(fighterAt(hurt.world, PARTNER), -200.0, 1);
  jab(hurt, 1, LEADER);
  const pair = percents(hurt)[0];
  assertEquals(pair > 0.0 && percents(hurt)[1] === pair, true, "a hit on Mrgl alone raises Grgl's percent");
  const grgl = fighterAt(hurt.world, PARTNER);
  grgl.launch.hitstun = 0;
  contactBatch(hurt.world, () => queueDamageContact(hurt.world, FOE, PARTNER, heavy, 1, ContactKind.launch, true, undefined));
  assertEquals(launchSpeed(grgl) > launchSpeed(fighterAt(fresh.world, PARTNER)), true, "the same hit launches Grgl farther at the pair's percent");
  const leader = duel();
  contactBatch(leader.world, () => queueDamageContact(leader.world, FOE, LEADER, heavy, 1, ContactKind.launch, true, undefined));
  const grglFresh = fighterAt(fresh.world, PARTNER);
  const mrglFresh = fighterAt(leader.world, LEADER);
  const grglRatio = launchSpeed(grglFresh) / effectKnockback(heavy, grglFresh.status.damage, heavy.damage, knockbackWeight(grglFresh));
  const mrglRatio = launchSpeed(mrglFresh) / effectKnockback(heavy, mrglFresh.status.damage, heavy.damage, knockbackWeight(mrglFresh));
  assertEquals(Math.abs(grglRatio / mrglRatio - MURLOC_PARTNER.taken) < f32(1e-4), true, `Grgl's launch is 1.02x his weight's (${grglRatio / mrglRatio})`);
  assertEquals(knockbackWeight(grglFresh) < knockbackWeight(mrglFresh), true, "Grgl keeps his lighter weight");
});

test("Grgl's blast-zone KO leaves the pair's percent with Mrgl [k3 measure docs/design/murloc.md]", () => {
  const state = duel();
  fighterAt(state.world, LEADER).status.damage = PAIR_PERCENT;
  fighterAt(state.world, PARTNER).status.damage = PAIR_PERCENT;
  place(fighterAt(state.world, PARTNER), OFF_STAGE, 1);
  run(state, 1, 300);
  assertEquals(fighterAt(state.world, PARTNER).status.out, true, "Grgl is out");
  assertEquals(percents(state)[0], PAIR_PERCENT, "Mrgl keeps the pair's percent");
});

test("No order, rule or cue faints Grgl at any percent [k3 measure docs/design/murloc.md]", () => {
  const state = duel();
  fighterAt(state.world, LEADER).status.damage = 150.0;
  fighterAt(state.world, PARTNER).status.damage = 150.0;
  run(state, 1, 120);
  assertEquals(fighterAt(state.world, PARTNER).status.out, false, "Grgl at 150% plays on");
  assertEquals(percents(state)[1], 150.0);
});

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
