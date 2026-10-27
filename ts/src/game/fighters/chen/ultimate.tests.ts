import { assertEquals, assertFalse, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { Action, maskOf } from "../../input/actions";
import { adaptInput } from "../../match/inputAdapter";
import { inputRow } from "../../input/inputRow";
import { Phase } from "../../lobby/lobbyState";
import { stepMatch } from "../../match/step";
import { canonicalState } from "../../replay/canonical";
import { copyReplayState, createReplaySnapshot, type ReplayState } from "../../replay/snapshot";
import { copyFighterState } from "../../../generated/state/fighterState";
import { Character, SpecialAction } from "../../sim/codes";
import { type Fighter, createFighter, placedObject } from "../../sim/fighter";
import { ROSTER_MANA } from "../../sim/mana";
import { fighterAt } from "../../sim/roster";
import { CompanionMode } from "../../sim/specials/schema";
import { EARTH_SPIRIT, FIRE_SPIRIT, STORM_SPIRIT } from "../../sim/ultimates";

const ULTIMATE = maskOf(Action.attack, Action.special);
const JAB = maskOf(Action.attack);
const EARTH = 0;
const STORM = 1;
const FIRE = 2;

interface Duel {
  readonly state: ReplayState;
  readonly chen: Fighter;
  readonly foe: Fighter;
  tick: number;
}

function duel(foeX: number, foeFacing = -1): Duel {
  const state = createReplaySnapshot();
  const chen = fighterAt(state.world, 0);
  const foe = fighterAt(state.world, 1);
  copyFighterState(chen, createFighter(Character.chen, 0.0, 1), 3);
  copyFighterState(foe, createFighter(Character.warden, foeX, foeFacing), 3);
  state.match.phase = Phase.match;
  state.match.stageChoice = 0;
  state.match.matchSeed = 911;
  state.match.hazards = false;
  state.match.items.on = false;
  state.match.timeLimitMinutes = 0;
  chen.mana.points = ROSTER_MANA.max;
  return { state, chen, foe, tick: 0 };
}

function press(d: Duel, slot: number, pressed: number): void {
  const row = inputRow({ held: pressed, pressed });
  if (row === undefined) throw new Error("Storm, Earth and Fire input row");
  const input = d.state.controls.inputs[slot];
  const command = d.state.controls.commands[slot];
  if (input === undefined || command === undefined) throw new Error("Storm, Earth and Fire controls");
  adaptInput(row, fighterAt(d.state.world, slot), d.tick, input, command);
}

function step(d: Duel, chenPressed = 0, foePressed = 0): void {
  d.tick++;
  press(d, 0, chenPressed);
  press(d, 1, foePressed);
  stepMatch(d.state.match, d.state.world, d.state.controls, d.tick);
}

function summon(d: Duel, frames: number): void {
  step(d, ULTIMATE);
  for (let frame = 1; frame < frames; frame++) step(d);
}

const live = (f: Readonly<Fighter>, slot: number): boolean => placedObject(f, slot).life > (placedObject(f, slot).spec?.crumble ?? 0);

test("Storm, Earth and Fire calls Earth ahead, then Storm behind, then Fire between, each on its own frame [k1 scenario]", () => {
  const d = duel(900.0);
  const arrivals: number[] = [0, 0, 0];
  const arrival = (slot: number): number => arrivals[slot] ?? 0;
  step(d, ULTIMATE);
  for (let frame = 2; frame <= 40; frame++) {
    step(d);
    for (const slot of [EARTH, STORM, FIRE]) if (arrivals[slot] === 0 && live(d.chen, slot)) arrivals[slot] = frame;
  }
  assertGreaterThan(arrival(EARTH), 0);
  assertEquals(arrival(STORM) - arrival(EARTH), STORM_SPIRIT.frame - EARTH_SPIRIT.frame);
  assertEquals(arrival(FIRE) - arrival(STORM), FIRE_SPIRIT.frame - STORM_SPIRIT.frame);
  assertTrue(placedObject(d.chen, EARTH).spec === EARTH_SPIRIT && placedObject(d.chen, STORM).spec === STORM_SPIRIT && placedObject(d.chen, FIRE).spec === FIRE_SPIRIT);
  assertTrue(placedObject(d.chen, EARTH).x > placedObject(d.chen, FIRE).x && placedObject(d.chen, FIRE).x > d.chen.motion.x && placedObject(d.chen, STORM).x < d.chen.motion.x);
  for (let frame = 0; frame < 30; frame++) step(d);
  assertEquals(d.chen.special.action, SpecialAction.none);
});

test("Earth taunts: a foe standing near it is drawn toward it while it stands [k1 scenario]", () => {
  const d = duel(380.0);
  summon(d, EARTH_SPIRIT.frame + 2);
  const start = d.foe.motion.x;
  for (let frame = 0; frame < 20; frame++) step(d);
  const earth = placedObject(d.chen, EARTH).x;
  assertLessThan(Math.abs(d.foe.motion.x - earth), Math.abs(start - earth));
  assertGreaterThan(start - d.foe.motion.x, 30.0);
});

test("Earth absorbs one hit: a single jab breaks it and its taunt stops [k1 scenario]", () => {
  const d = duel(305.0);
  summon(d, EARTH_SPIRIT.frame + 2);
  assertTrue(live(d.chen, EARTH));
  step(d, 0, JAB);
  for (let frame = 0; frame < 12; frame++) step(d);
  assertFalse(live(d.chen, EARTH));
  const after = d.foe.motion.x;
  for (let frame = 0; frame < 20; frame++) step(d);
  assertLessThan(Math.abs(d.foe.motion.x - after), 1.0);
});

test("Fire's Immolation bursts around it and launches a foe beside it hard [k1 scenario]", () => {
  const d = duel(FIRE_SPIRIT.offsetX + 90.0);
  summon(d, FIRE_SPIRIT.frame + (FIRE_SPIRIT.fireAges[0] ?? 0) - 6);
  const before = d.foe.status.damage;
  let launched = false;
  for (let frame = 0; frame < 12; frame++) {
    step(d);
    if (d.foe.launch.hitstun > 0) launched = true;
  }
  assertGreaterThan(d.foe.status.damage - before, 12.0);
  assertTrue(launched);
});

test("Storm's Cyclone carries forward from behind Chen and lifts a foe off the floor [k1 scenario]", () => {
  const d = duel(STORM_SPIRIT.offsetX + 70.0);
  summon(d, STORM_SPIRIT.frame + 2);
  let peak = 0.0;
  for (let age = 0; age < 70; age++) {
    step(d);
    peak = Math.max(peak, d.foe.motion.z - d.chen.motion.z);
  }
  assertGreaterThan(d.foe.status.damage, 2.0);
  assertGreaterThan(peak, 40.0);
});

test("Struck, Storm Wind Walks: it vanishes, reappears away from the striker, and is not worn down [k1 scenario]", () => {
  const d = duel(-210.0, 1);
  summon(d, STORM_SPIRIT.frame + 2);
  const storm = placedObject(d.chen, STORM);
  const from = storm.x;
  step(d, 0, JAB);
  let vanished = false;
  for (let frame = 0; frame < 12; frame++) {
    step(d);
    if (storm.mode === CompanionMode.vanished) vanished = true;
  }
  assertTrue(vanished);
  assertEquals(storm.durability, STORM_SPIRIT.durability);
  assertGreaterThan(storm.x - from, 100.0);
  for (let frame = 0; frame < (STORM_SPIRIT.windWalk?.frames ?? 0); frame++) step(d);
  assertEquals(storm.mode, CompanionMode.follow);
  assertTrue(live(d.chen, STORM));
});

const ROLLBACK_END = 160;
const rollbackInputs = (tick: number): readonly [number, number] => [tick === 3 ? ULTIMATE : 0, tick === STORM_SPIRIT.frame + 6 ? JAB : 0];

interface Rollback {
  readonly earthAtSave: boolean;
  readonly stormModeAtSave: number;
  readonly expected: string;
  readonly replayed: string;
  readonly expectedSerials: string;
  readonly replayedSerials: string;
}

const serials = (f: Readonly<Fighter>): string => [EARTH, STORM, FIRE].map((slot) => placedObject(f, slot).serial).join(",");

function rollBackTo(saveTick: number): Rollback {
  const run = duel(-210.0, 1);
  const snapshot = createReplaySnapshot();
  for (let tick = 1; tick <= ROLLBACK_END; tick++) {
    if (tick === saveTick) copyReplayState(snapshot, run.state);
    const [chen, foe] = rollbackInputs(tick);
    step(run, chen, foe);
  }
  const expected = canonicalState(run.state);
  const expectedSerials = serials(run.chen);
  copyReplayState(run.state, snapshot);
  const resumed: Duel = { state: run.state, chen: run.chen, foe: run.foe, tick: saveTick - 1 };
  const earthAtSave = live(run.chen, EARTH);
  const stormModeAtSave = placedObject(run.chen, STORM).mode;
  for (let tick = saveTick; tick <= ROLLBACK_END; tick++) {
    const [chen, foe] = rollbackInputs(tick);
    step(resumed, chen, foe);
  }
  return { earthAtSave, stormModeAtSave, expected, replayed: canonicalState(run.state), expectedSerials, replayedSerials: serials(run.chen) };
}

test("A rollback from before the summon replays the same three spirits [k1 scenario]", () => {
  const rollback = rollBackTo(8);
  assertFalse(rollback.earthAtSave);
  assertEquals(rollback.replayed, rollback.expected);
  assertEquals(rollback.replayedSerials, rollback.expectedSerials);
});

test("A rollback from mid Wind Walk restores the vanished Storm, Earth's taunt and Fire [k1 scenario]", () => {
  const rollback = rollBackTo(40);
  assertTrue(rollback.earthAtSave);
  assertEquals(rollback.stormModeAtSave, CompanionMode.vanished);
  assertEquals(rollback.replayed, rollback.expected);
});
