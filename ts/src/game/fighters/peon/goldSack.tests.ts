import { assertEquals, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Action, maskOf } from "../../input/actions";
import { adaptInput } from "../../match/inputAdapter";
import { inputRow } from "../../input/inputRow";
import { Phase } from "../../lobby/lobbyState";
import { stepMatch } from "../../match/step";
import { createReplaySnapshot, type ReplayState } from "../../replay/snapshot";
import { copyFighterState } from "../../../generated/state/fighterState";
import { Character, SpecialAction } from "../../sim/codes";
import { createFighter, type Fighter } from "../../sim/fighter";
import { setWorldMotionValue } from "../../sim/motion";
import { fighterAt } from "../../sim/roster";
import { clearSpecialOnStock } from "../../sim/transitions";
import { FOLLOW_UP_FORM, chargeStage } from "../../sim/specials/schema";
import { GOLD_SACK_CHARGE, GOLD_SACK_DAMAGE } from "./specials";

const FULL = GOLD_SACK_CHARGE.full;
const STAGE_FRAMES = FULL / GOLD_SACK_CHARGE.stages;
const IN_REACH = 70.0;

interface Duel {
  readonly state: ReplayState;
  readonly peon: Fighter;
  readonly foe: Fighter;
  tick: number;
}

function duel(foeAhead: number): Duel {
  const state = createReplaySnapshot();
  const peon = fighterAt(state.world, 0);
  const foe = fighterAt(state.world, 1);
  copyFighterState(peon, createFighter(Character.peon, 0.0, 1), 3);
  copyFighterState(foe, createFighter(Character.peon, foeAhead, -1), 3);
  state.match.phase = Phase.match;
  state.match.stageChoice = 0;
  state.match.matchSeed = 1;
  state.match.hazards = false;
  state.match.items.on = false;
  state.match.timeLimitMinutes = 0;
  state.match.ultimatesOff = true;
  return { state, peon, foe, tick: 0 };
}

function step(d: Duel, press: "special" | "shield" | "none"): void {
  d.tick++;
  const mask = press === "special" ? maskOf(Action.special) : press === "shield" ? maskOf(Action.rightTrigger) : 0;
  const row = inputRow({ held: mask, pressed: mask });
  if (row === undefined) throw new Error("Gold Sack input row");
  adaptInput(row, d.peon, d.tick, d.state.controls.inputs[0], d.state.controls.commands[0]);
  stepMatch(d.state.match, d.state.world, d.state.controls, d.tick);
}

function idle(d: Duel, frames: number): void {
  for (let frame = 0; frame < frames; frame++) step(d, "none");
}

function lift(fighter: Fighter, height: number): void {
  fighter.motion.z = height;
  fighter.motion.vz = 0.0;
  fighter.motion.grounded = false;
  fighter.motion.surface = undefined;
  setWorldMotionValue(fighter.motion.meleeZ, fighter.motion.z);
  setWorldMotionValue(fighter.motion.meleeVelocityZ, fighter.motion.vz);
}

function swingFrom(charge: number, foePercent: number): Duel {
  const d = duel(IN_REACH);
  d.peon.special.charge = charge;
  d.foe.status.damage = foePercent;
  step(d, "special");
  if (charge < FULL) {
    idle(d, GOLD_SACK_CHARGE.hold + 1);
    d.peon.special.charge = charge;
    step(d, "special");
  }
  idle(d, 40);
  return d;
}

test("Gold Sack holds the gold-carry pose banking one charge frame a frame, a stage per handful, and stores a full sack on its own [k3 measure docs/design/peasant.md]", () => {
  const d = duel(400.0);
  step(d, "special");
  assertEquals(d.peon.special.action, SpecialAction.heroNeutral, "Gold Sack starts");
  idle(d, GOLD_SACK_CHARGE.hold + STAGE_FRAMES);
  assertEquals(chargeStage(GOLD_SACK_CHARGE, d.peon.special.charge), 1, "one handful in after a stage of frames");
  assertEquals(d.peon.special.action, SpecialAction.heroNeutral, "still charging");
  idle(d, FULL);
  assertEquals(d.peon.special.charge, FULL, "the sack fills and stops at full");
  idle(d, 20);
  assertEquals(d.peon.special.action, SpecialAction.none, "a full sack is stored and the Peon is free");
  assertEquals(d.peon.special.charge, FULL, "the stored sack stays full");
});

test("Shield stores a partial Gold Sack charge and the next press resumes from it, in the air too [k3 measure docs/design/peasant.md]", () => {
  const d = duel(400.0);
  lift(d.peon, 300.0);
  step(d, "special");
  idle(d, GOLD_SACK_CHARGE.hold + 30);
  const banked = d.peon.special.charge;
  assertGreaterThan(banked, 20);
  step(d, "shield");
  idle(d, 12);
  assertEquals(d.peon.special.action, SpecialAction.none, "shield puts the sack away");
  assertEquals(d.peon.special.charge, banked, "the charge is kept");
  step(d, "special");
  idle(d, GOLD_SACK_CHARGE.hold + 5);
  assertGreaterThan(d.peon.special.charge, banked);
});

test("A Gold Sack bonk deals its stage's damage and empties the sack; a stored full sack swings at once [k3 measure docs/design/peasant.md]", () => {
  const light = swingFrom(0, 0.0);
  assertEquals(light.foe.status.damage, f32(GOLD_SACK_DAMAGE[0]), "an empty-sack bonk");
  assertEquals(light.peon.special.charge, 0);
  const full = duel(IN_REACH);
  full.peon.special.charge = FULL;
  step(full, "special");
  assertTrue(full.peon.special.form >= FOLLOW_UP_FORM);
  idle(full, 40);
  assertEquals(full.foe.status.damage, f32(GOLD_SACK_DAMAGE[4]), "a full-sack bonk");
  assertEquals(full.peon.special.charge, 0, "the swing empties the sack");
});

const killed = (d: Duel): boolean => d.foe.status.stocks < d.peon.status.stocks || d.foe.status.out;

test("A full Gold Sack kills a Peon from 65% at centre stage, not at 55%, and an empty one does not kill at 70% [k3 measure docs/design/peasant.md]", () => {
  const empty = swingFrom(0, 70.0);
  idle(empty, 240);
  assertEquals(killed(empty), false, "an empty sack leaves the foe alive");
  const early = swingFrom(FULL, 55.0);
  idle(early, 240);
  assertEquals(killed(early), false, "a full sack does not kill at 55%");
  const full = swingFrom(FULL, 70.0);
  idle(full, 240);
  assertTrue(killed(full));
});

test("The Gold Sack charge survives a rollback snapshot copy and empties on stock loss [k3 measure docs/design/peasant.md]", () => {
  const source = createFighter(Character.peon, 0.0, 1);
  source.special.charge = 37;
  const copy = createFighter(Character.peon, 0.0, 1);
  copyFighterState(copy, source, 3);
  assertEquals(copy.special.charge, 37);
  clearSpecialOnStock(copy);
  assertEquals(copy.special.charge, 0);
});

test("An air Gold Sack bonk that lands before its first active frame still swings and hits, and the sack is spent on a swing that came out [k3 measure docs/design/peasant.md]", () => {
  const d = duel(IN_REACH);
  lift(d.peon, 40.0);
  d.peon.special.charge = FULL;
  step(d, "special");
  idle(d, 40);
  assertEquals(d.foe.status.damage, f32(GOLD_SACK_DAMAGE[4]), "the full bonk lands on the ground");
  assertEquals(d.peon.special.charge, 0);
});

test("A press in the frames after the sack fills on its own swings the full sack [k3 measure docs/design/peasant.md]", () => {
  const d = duel(IN_REACH);
  step(d, "special");
  idle(d, GOLD_SACK_CHARGE.hold + FULL + 2);
  assertEquals(d.peon.special.action, SpecialAction.heroNeutral, "still putting the full sack away");
  step(d, "special");
  idle(d, 40);
  assertEquals(d.foe.status.damage, f32(GOLD_SACK_DAMAGE[4]), "the press swings the full sack");
});
