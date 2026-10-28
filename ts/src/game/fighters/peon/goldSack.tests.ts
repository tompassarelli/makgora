import { assertEquals, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { at } from "wisp/src/runtime/lookup";
import { idiv } from "wisp/src/sim/intMath";
import { f32 } from "wisp/src/sim/f32";
import { Action, maskOf } from "../../input/actions";
import { adaptInput } from "../../match/inputAdapter";
import { inputRow } from "../../input/inputRow";
import { Phase } from "../../lobby/lobbyState";
import { stepMatch } from "../../match/step";
import { canonicalState } from "../../replay/canonical";
import { copyReplayState, createReplaySnapshot, type ReplayState } from "../../replay/snapshot";
import { copyFighterState } from "../../../generated/state/fighterState";
import { Character, SpecialAction } from "../../sim/codes";
import { createFighter, type Fighter } from "../../sim/fighter";
import { setWorldMotionValue } from "../../sim/motion";
import { fighterAt } from "../../sim/roster";
import { clearSpecialOnStock } from "../../sim/transitions";
import { FOLLOW_UP_FORM, chargeStage } from "../../sim/specials/schema";
import { GOLD_SACK_CHARGE, GOLD_SACK_DAMAGE, GOLD_SACK_FIRST_ACTIVE } from "./specials";

const FULL = GOLD_SACK_CHARGE.full;
const HOLD = GOLD_SACK_CHARGE.hold;
const IN_REACH = 70.0;

type Press = "press" | "hold" | "shield" | "none";

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

const PRESSES: Readonly<Record<Press, { readonly held: number; readonly pressed: number }>> = {
  press: { held: maskOf(Action.special), pressed: maskOf(Action.special) },
  hold: { held: maskOf(Action.special), pressed: 0 },
  shield: { held: maskOf(Action.special) | maskOf(Action.rightTrigger), pressed: maskOf(Action.rightTrigger) },
  none: { held: 0, pressed: 0 },
};

function step(d: Duel, press: Press): void {
  d.tick++;
  const row = inputRow(PRESSES[press]);
  if (row === undefined) throw new Error("Gold Sack input row");
  adaptInput(row, d.peon, d.tick, d.state.controls.inputs[0], d.state.controls.commands[0]);
  stepMatch(d.state.match, d.state.world, d.state.controls, d.tick);
}

function idle(d: Duel, frames: number): void {
  for (let frame = 0; frame < frames; frame++) step(d, "none");
}

function held(d: Duel, frames: number): void {
  for (let frame = 0; frame < frames; frame++) step(d, "hold");
}

function lift(fighter: Fighter, height: number): void {
  fighter.motion.z = height;
  fighter.motion.vz = 0.0;
  fighter.motion.grounded = false;
  fighter.motion.surface = undefined;
  setWorldMotionValue(fighter.motion.meleeZ, fighter.motion.z);
  setWorldMotionValue(fighter.motion.meleeVelocityZ, fighter.motion.vz);
}

const swungStage = (f: Readonly<Fighter>): number => f.special.form >= FOLLOW_UP_FORM ? idiv(f.special.form, FOLLOW_UP_FORM) - 1 : -1;

function swingFrom(charge: number, foePercent: number): Duel {
  const d = duel(IN_REACH);
  d.peon.special.charge = charge;
  d.foe.status.damage = foePercent;
  step(d, "press");
  if (charge === 0) step(d, "none");
  idle(d, 60);
  return d;
}

function chargeHold(d: Duel, ticks: number): number {
  step(d, "press");
  held(d, ticks - 1);
  return d.peon.special.charge;
}

for (const [label, airborne] of [["on the ground", false], ["in the air", true]] as const) {
  const arena = (): Duel => {
    const d = duel(airborne ? 400.0 : IN_REACH);
    if (airborne) lift(d.peon, 300.0);
    return d;
  };

  test(`Gold Sack ${label}: a one-frame tap swings the stage-0 bonk at once [k3 measure docs/design/peasant.md]`, () => {
    const d = arena();
    step(d, "press");
    step(d, "none");
    assertEquals(swungStage(d.peon), 0, "the release swings the empty-sack bonk");
    assertEquals(d.peon.special.charge, 0, "the swing empties the sack");
    if (!airborne) {
      idle(d, 60);
      assertEquals(d.foe.status.damage, f32(at(GOLD_SACK_DAMAGE, 0)), "an empty-sack bonk lands");
    }
  });

  test(`Gold Sack ${label}: holding to frame 40 then releasing swings the matching middle stage [k3 measure docs/design/peasant.md]`, () => {
    const d = arena();
    const banked = chargeHold(d, 40);
    const stage = chargeStage(GOLD_SACK_CHARGE, banked);
    assertGreaterThan(stage, 0);
    assertLessThan(stage, GOLD_SACK_CHARGE.stages);
    assertEquals(d.peon.special.action, SpecialAction.heroNeutral, "still charging while held");
    assertEquals(swungStage(d.peon), -1, "nothing swings while special is held");
    step(d, "none");
    assertEquals(swungStage(d.peon), stage, "the release swings the stage reached");
    if (!airborne) {
      idle(d, 60);
      assertEquals(d.foe.status.damage, f32(at(GOLD_SACK_DAMAGE, stage)), "the middle stage's damage");
    }
  });

  test(`Gold Sack ${label}: holding past full keeps the full bonk ready until release [k3 measure docs/design/peasant.md]`, () => {
    const d = arena();
    chargeHold(d, HOLD + FULL + 40);
    assertEquals(d.peon.special.charge, FULL, "the sack fills and stops at full");
    assertEquals(d.peon.special.action, SpecialAction.heroNeutral, "the full sack stays ready");
    assertEquals(swungStage(d.peon), -1, "a full sack does not swing on its own");
    const before = d.peon.motion.x;
    step(d, "none");
    assertEquals(swungStage(d.peon), GOLD_SACK_CHARGE.stages, "the release swings the full bonk");
    idle(d, at(GOLD_SACK_FIRST_ACTIVE, GOLD_SACK_CHARGE.stages));
    assertGreaterThan(d.peon.motion.x, before + 20.0);
    if (!airborne) {
      idle(d, 60);
      assertEquals(d.foe.status.damage, f32(at(GOLD_SACK_DAMAGE, GOLD_SACK_CHARGE.stages)), "the full bonk's damage");
    }
  });

  test(`Gold Sack ${label}: shield stores the charge and the next tap spends it at the stored stage [k3 measure docs/design/peasant.md]`, () => {
    const d = arena();
    const banked = chargeHold(d, 45);
    const stage = chargeStage(GOLD_SACK_CHARGE, banked);
    assertGreaterThan(stage, 0);
    step(d, "shield");
    idle(d, 12);
    assertEquals(d.peon.special.action, SpecialAction.none, "shield puts the sack away");
    assertEquals(d.peon.special.charge >= banked, true, "the charge is kept");
    const kept = d.peon.special.charge;
    step(d, "press");
    step(d, "none");
    assertEquals(swungStage(d.peon), chargeStage(GOLD_SACK_CHARGE, kept), "the tap swings the stored stage");
    assertEquals(d.peon.special.charge, 0, "the swing empties the sack");
    if (!airborne) {
      idle(d, 60);
      assertEquals(d.foe.status.damage, f32(at(GOLD_SACK_DAMAGE, chargeStage(GOLD_SACK_CHARGE, kept))), "the stored stage's damage");
    }
  });

  test(`Gold Sack ${label}: holding special again over a stored partial charge resumes charging past the stored stage and the release swings the higher stage [k3 measure docs/design/peasant.md]`, () => {
    const d = arena();
    const banked = chargeHold(d, 45);
    step(d, "shield");
    idle(d, 12);
    assertEquals(d.peon.special.action, SpecialAction.none, "shield puts the sack away");
    const kept = d.peon.special.charge;
    const storedStage = chargeStage(GOLD_SACK_CHARGE, kept);
    assertGreaterThan(kept, 0);
    assertLessThan(kept, FULL);
    assertEquals(kept >= banked, true, "the charge is kept");
    step(d, "press");
    held(d, 2 * HOLD);
    assertEquals(d.peon.special.action, SpecialAction.heroNeutral, "the press resumes charging");
    assertEquals(swungStage(d.peon), -1, "holding does not force the swing");
    assertGreaterThan(d.peon.special.charge, kept);
    held(d, 30);
    const resumed = d.peon.special.charge;
    const resumedStage = chargeStage(GOLD_SACK_CHARGE, resumed);
    assertGreaterThan(resumedStage, storedStage);
    assertEquals(swungStage(d.peon), -1, "still charging past the stored stage");
    step(d, "none");
    assertEquals(swungStage(d.peon), resumedStage, "the release swings the stage reached");
    assertEquals(d.peon.special.charge, 0, "the swing empties the sack");
    if (!airborne) {
      idle(d, 60);
      assertEquals(d.foe.status.damage, f32(at(GOLD_SACK_DAMAGE, resumedStage)), "the higher stage's damage");
    }
  });

  test(`Gold Sack ${label}: shield during a resumed charge stores it again [k3 measure docs/design/peasant.md]`, () => {
    const d = arena();
    chargeHold(d, 45);
    step(d, "shield");
    idle(d, 12);
    const first = d.peon.special.charge;
    step(d, "press");
    held(d, 2 * HOLD + 10);
    const resumed = d.peon.special.charge;
    assertGreaterThan(resumed, first);
    step(d, "shield");
    idle(d, 12);
    assertEquals(d.peon.special.action, SpecialAction.none, "shield puts the sack away again");
    assertEquals(d.peon.special.charge >= resumed, true, "the resumed charge is kept");
    assertLessThan(d.peon.special.charge, FULL);
  });
}

test("A Gold Sack bonk deals its stage's damage and empties the sack; a stored full sack swings at once [k3 measure docs/design/peasant.md]", () => {
  const light = swingFrom(0, 0.0);
  assertEquals(light.foe.status.damage, f32(at(GOLD_SACK_DAMAGE, 0)), "an empty-sack bonk");
  assertEquals(light.peon.special.charge, 0);
  const full = duel(IN_REACH);
  full.peon.special.charge = FULL;
  step(full, "press");
  assertEquals(full.peon.special.form >= FOLLOW_UP_FORM, true, "the press itself swings");
  idle(full, 60);
  assertEquals(full.foe.status.damage, f32(at(GOLD_SACK_DAMAGE, GOLD_SACK_CHARGE.stages)), "a full-sack bonk");
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

const ROLLBACK_END = 200;
const RELEASE_TICK = 41;
const rollbackPress = (tick: number): Press => tick === 3 ? "press" : tick > 3 && tick < RELEASE_TICK ? "hold" : "none";

function replayFrom(saveTick: number): { readonly expected: string; readonly replayed: string; readonly swungAtSave: number } {
  const run = duel(IN_REACH);
  const snapshot = createReplaySnapshot();
  let swungAtSave = -1;
  for (let tick = 1; tick <= ROLLBACK_END; tick++) {
    if (tick === saveTick) {
      copyReplayState(snapshot, run.state);
      swungAtSave = swungStage(run.peon);
    }
    step(run, rollbackPress(tick));
  }
  const expected = canonicalState(run.state);
  copyReplayState(run.state, snapshot);
  run.tick = saveTick - 1;
  for (let tick = saveTick; tick <= ROLLBACK_END; tick++) step(run, rollbackPress(tick));
  return { expected, replayed: canonicalState(run.state), swungAtSave };
}

test("A rollback replays a Gold Sack charge through its release to the same state [k1 scenario]", () => {
  const midCharge = replayFrom(20);
  assertEquals(midCharge.replayed, midCharge.expected);
  const midSwing = replayFrom(RELEASE_TICK + 8);
  assertEquals(midSwing.swungAtSave >= 0, true, "saved after the release swung");
  assertEquals(midSwing.replayed, midSwing.expected);
});

test("An air Gold Sack bonk that lands before its first active frame still swings and hits, and the sack is spent on a swing that came out [k3 measure docs/design/peasant.md]", () => {
  const d = duel(IN_REACH);
  lift(d.peon, 40.0);
  d.peon.special.charge = FULL;
  step(d, "press");
  idle(d, 60);
  assertEquals(d.foe.status.damage, f32(at(GOLD_SACK_DAMAGE, GOLD_SACK_CHARGE.stages)), "the full bonk lands on the ground");
  assertEquals(d.peon.special.charge, 0);
});
