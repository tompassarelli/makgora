import { assertEquals, assertFalse, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { at } from "wisp/src/runtime/lookup";
import { idiv } from "wisp/src/sim/intMath";
import { Action, maskOf } from "../../input/actions";
import { adaptInput } from "../../match/inputAdapter";
import { inputRow } from "../../input/inputRow";
import { Phase } from "../../lobby/lobbyState";
import { stepMatch } from "../../match/step";
import { airborne, fighter, frame, scene } from "../../match/padScene";
import { pressHeroFollowUp } from "../../match/botHeroKit";
import { copyReplayState, createReplaySnapshot } from "../../replay/snapshot";
import { canonicalState } from "../../replay/canonical";
import { copyFighterState } from "../../../generated/state/fighterState";
import { Character, SpecialAction } from "../../sim/codes";
import { type Fighter, createFighter } from "../../sim/fighter";
import { fighterAt, neutralControls } from "../../sim/roster";
import { runningHeroSpecial } from "../../sim/specials/runningMove";
import { mainDeckZ } from "../../sim/stage";
import { FOLLOW_UP_FORM, chargeStage } from "../../sim/specials/schema";
import { length } from "./moves";
import { AIR_LANDING_LAG, QUICKDRAW_CHARGE, QUICKDRAW_DASH_FIRST, quickdrawDamage } from "./specials";

const FAR_FOE_X = 900.0;
const NEAR_FOE_X = length(f32(0.8));
const WATCH = 160;
const FULL_HOLD = QUICKDRAW_CHARGE.hold + QUICKDRAW_CHARGE.full + 20;
const HALF_HOLD = QUICKDRAW_CHARGE.hold + idiv(QUICKDRAW_CHARGE.full, 2);
const AIR_HEIGHT = 900.0;

interface Draw { readonly stage: number; readonly travel: number; readonly damage: number; readonly blademaster: Fighter; readonly foe: Fighter }

function draw(holdFrames: number, foeX: number, facing = 1): Draw {
  const s = scene(0, [{ character: Character.blademaster, x: 0.0, facing }, { character: Character.rifleman, x: f32(foeX * facing), facing: -facing }]);
  const blademaster = fighter(s, 0);
  const foe = fighter(s, 1);
  let stage = -1;
  let startX = 0.0;
  for (let n = 1; n <= WATCH; n++) {
    frame(s, n <= holdFrames ? [Action.special] : []);
    if (n === 1) assertEquals(blademaster.special.action, SpecialAction.heroNeutral, "the stance starts");
    if (stage < 0 && blademaster.special.form >= FOLLOW_UP_FORM) {
      stage = idiv(blademaster.special.form, FOLLOW_UP_FORM) - 1;
      startX = blademaster.motion.x;
    }
    if (stage >= 0 && blademaster.special.action === SpecialAction.none) break;
  }
  return { stage, travel: f32(f32(blademaster.motion.x - startX) * facing), damage: foe.status.damage, blademaster, foe };
}

test("Quickdraw deals its uncharged, half and full damage, 7% rising 1% a stage to 24%, both facings [k1 scenario]", () => {
  for (const facing of [1, -1]) {
    const tap = draw(1, NEAR_FOE_X, facing);
    const half = draw(HALF_HOLD, NEAR_FOE_X, facing);
    const full = draw(FULL_HOLD, NEAR_FOE_X, facing);
    assertEquals(`${tap.stage} ${half.stage} ${full.stage}`, `0 ${idiv(QUICKDRAW_CHARGE.stages, 2)} ${QUICKDRAW_CHARGE.stages}`, "charge stages");
    assertEquals(tap.damage, quickdrawDamage(0), "uncharged");
    assertEquals(half.damage, quickdrawDamage(idiv(QUICKDRAW_CHARGE.stages, 2)), "half");
    assertEquals(full.damage, quickdrawDamage(QUICKDRAW_CHARGE.stages), "full");
    assertEquals(tap.damage, 7.0, "uncharged is 7%");
    assertEquals(half.damage, 15.0, "half is 15%");
    assertEquals(full.damage, 24.0, "full is 24%");
  }
});

test("Quickdraw's dash covers 0.3H uncharged and 2.2H at full charge on an empty stage [k1 scenario]", () => {
  const tap = draw(1, FAR_FOE_X);
  const full = draw(FULL_HOLD, FAR_FOE_X);
  assertLessThan(Math.abs(f32(tap.travel - length(f32(0.3)))), 1.0);
  assertLessThan(Math.abs(f32(full.travel - length(f32(2.2)))), 1.0);
  assertEquals(tap.damage, 0.0, "nobody is in reach");
});

test("A low-charge Quickdraw stops in front of a standing foe 0.8H away and a full one passes through to land behind them, both facings [k1 scenario]", () => {
  for (const facing of [1, -1]) {
    const tap = draw(1, NEAR_FOE_X, facing);
    const full = draw(FULL_HOLD, NEAR_FOE_X, facing);
    assertGreaterThan(tap.damage, 0.0);
    assertGreaterThan(full.damage, 0.0);
    assertLessThan(f32(f32(tap.blademaster.motion.x - tap.foe.motion.x) * facing), 0.0);
    assertGreaterThan(f32(f32(full.blademaster.motion.x - full.foe.motion.x) * facing), 0.0);
  }
});

test("Holding special past a full charge draws on its own on the frame the charge fills [k1 scenario]", () => {
  const s = scene(0, [{ character: Character.blademaster, x: 0.0, facing: 1 }, { character: Character.rifleman, x: FAR_FOE_X, facing: -1 }]);
  const blademaster = fighter(s, 0);
  let drawn = 0;
  for (let n = 1; n <= FULL_HOLD && drawn === 0; n++) {
    frame(s, [Action.special]);
    if (blademaster.special.form >= FOLLOW_UP_FORM) drawn = n;
  }
  assertGreaterThan(drawn, QUICKDRAW_CHARGE.full);
  assertLessThan(drawn, QUICKDRAW_CHARGE.hold + QUICKDRAW_CHARGE.full + 3);
  assertEquals(idiv(blademaster.special.form, FOLLOW_UP_FORM) - 1, QUICKDRAW_CHARGE.stages, "the full-charge draw");
  assertEquals(blademaster.special.charge, 0, "the draw spends the charge");
});

test("An air Quickdraw neither stalls nor lifts him while he charges, and its draw dashes [k1 scenario]", () => {
  const s = scene(0, [{ character: Character.blademaster, x: 0.0, facing: 1 }, { character: Character.rifleman, x: FAR_FOE_X, facing: -1 }]);
  const blademaster = fighter(s, 0);
  const startZ = f32(mainDeckZ(0) + AIR_HEIGHT);
  airborne(blademaster, 0.0, startZ);
  let highest = startZ;
  let dashed = false;
  for (let n = 1; n <= HALF_HOLD + 20; n++) {
    frame(s, n <= HALF_HOLD ? [Action.special] : []);
    if (n === 1) assertEquals(blademaster.special.action, SpecialAction.heroNeutral, "the air stance starts");
    if (n > 1 && n < HALF_HOLD) assertLessThan(blademaster.motion.vz, 0.0);
    if (blademaster.special.form >= FOLLOW_UP_FORM && blademaster.special.frame >= QUICKDRAW_DASH_FIRST) dashed = true;
    highest = Math.max(highest, blademaster.motion.z);
  }
  assertTrue(dashed);
  assertEquals(highest, startZ, "never above where he started");
});

test("Quickdraw works once per airtime and comes back after landing [k1 scenario]", () => {
  const s = scene(0, [{ character: Character.blademaster, x: 0.0, facing: 1 }, { character: Character.rifleman, x: FAR_FOE_X, facing: -1 }]);
  const blademaster = fighter(s, 0);
  airborne(blademaster, 0.0, f32(mainDeckZ(0) + AIR_HEIGHT));
  frame(s, [Action.special]);
  assertEquals(blademaster.special.action, SpecialAction.heroNeutral, "the first air Quickdraw starts");
  for (let n = 1; n <= WATCH && blademaster.special.action !== SpecialAction.none; n++) frame(s, []);
  assertFalse(blademaster.motion.grounded);
  frame(s, [Action.special]);
  assertTrue(blademaster.special.action !== SpecialAction.heroNeutral);
  for (let n = 1; n <= 400 && !blademaster.motion.grounded; n++) frame(s, []);
  for (let n = 1; n <= 40; n++) frame(s, []);
  frame(s, [Action.special]);
  assertEquals(blademaster.special.action, SpecialAction.heroNeutral, "landing restores it");
});

const LANDING_DROP = 120.0;

interface CarriedCharge { readonly blademaster: Fighter; readonly foe: Fighter; readonly landedCharge: number; readonly landedForm: number; readonly landedLag: number; readonly total: number; readonly stage: number }

function carriedCharge(holdFrames: number): CarriedCharge {
  const s = scene(0, [{ character: Character.blademaster, x: 0.0, facing: 1 }, { character: Character.rifleman, x: NEAR_FOE_X, facing: -1 }]);
  const blademaster = fighter(s, 0);
  const foe = fighter(s, 1);
  airborne(blademaster, 0.0, f32(mainDeckZ(0) + LANDING_DROP));
  let landedCharge = -1;
  let landedForm = -1;
  let landedLag = -1;
  let total = 0;
  let stage = -1;
  for (let n = 1; n <= WATCH; n++) {
    frame(s, n <= holdFrames ? [Action.special] : []);
    if (landedCharge < 0 && blademaster.motion.grounded) {
      landedCharge = blademaster.special.charge;
      landedForm = blademaster.special.form;
      landedLag = blademaster.landing.lag;
    }
    if (stage < 0 && blademaster.special.form >= FOLLOW_UP_FORM) {
      stage = idiv(blademaster.special.form, FOLLOW_UP_FORM) - 1;
      total = n;
    }
    if (stage >= 0 && blademaster.special.action === SpecialAction.none) break;
  }
  return { blademaster, foe, landedCharge, landedForm, landedLag, total, stage };
}

test("An air Quickdraw charge held through landing continues as the ground stance with its charge and no landing lag, then fires the ground draw at the summed charge [k1 scenario]", () => {
  const air = carriedCharge(FULL_HOLD);
  assertGreaterThan(air.landedCharge, 0);
  assertLessThan(air.landedCharge, QUICKDRAW_CHARGE.full);
  assertEquals(air.landedForm, 0, "the stance is the ground form on the landing frame");
  assertEquals(air.landedLag, 0, "no landing lag");
  const ground = draw(FULL_HOLD, NEAR_FOE_X);
  assertEquals(air.stage, ground.stage, "the summed charge reaches the same stage as a charge held on the ground");
  assertEquals(air.stage, QUICKDRAW_CHARGE.stages);
  assertEquals(air.foe.status.damage, quickdrawDamage(QUICKDRAW_CHARGE.stages), "the ground release lands the full draw");
  assertEquals(air.blademaster.landing.lag, 0, "the ground draw leaves no air landing lag");
});

test("A release in the air still fires the air Quickdraw with its landing lag, and a draw after landing keeps today's landing behavior [k1 scenario]", () => {
  const s = scene(0, [{ character: Character.blademaster, x: 0.0, facing: 1 }, { character: Character.rifleman, x: FAR_FOE_X, facing: -1 }]);
  const blademaster = fighter(s, 0);
  airborne(blademaster, 0.0, f32(mainDeckZ(0) + AIR_HEIGHT));
  for (let n = 1; n <= 40 && blademaster.special.form < FOLLOW_UP_FORM; n++) frame(s, n <= 12 ? [Action.special] : []);
  assertTrue(blademaster.special.form >= FOLLOW_UP_FORM);
  assertFalse(blademaster.motion.grounded);
  assertEquals(runningHeroSpecial(blademaster)?.landingLag, AIR_LANDING_LAG, "the air draw keeps its landing lag");
  blademaster.motion.z = f32(mainDeckZ(0) + 10.0);
  for (let n = 1; n <= 60 && !blademaster.motion.grounded; n++) frame(s, []);
  assertTrue(blademaster.motion.grounded);
  assertEquals(blademaster.special.form < FOLLOW_UP_FORM ? 0 : 1, 1, "landing during the slash does not turn it into a stance");
});

test("A rollback from inside the iaido charge replays the same draw, dash and hit [k1 scenario]", () => {
  const state = createReplaySnapshot();
  const blademaster = fighterAt(state.world, 0);
  const foe = fighterAt(state.world, 1);
  copyFighterState(blademaster, createFighter(Character.blademaster, 0.0, 1), 3);
  copyFighterState(foe, createFighter(Character.rifleman, NEAR_FOE_X, -1), 3);
  state.match.phase = Phase.match;
  state.match.stageChoice = 0;
  state.match.matchSeed = 528;
  state.match.hazards = false;
  state.match.items.on = false;
  state.match.timeLimitMinutes = 0;
  state.match.ultimatesOff = true;
  let previous = 0;
  const tickOnce = (tick: number) => {
    for (const slot of [0, 1]) {
      const mask = slot === 0 && tick <= HALF_HOLD ? maskOf(Action.special) : 0;
      const row = inputRow({ held: mask, pressed: slot === 0 ? mask & ~previous : 0, axisX: 0, specialX: 0 });
      if (row === undefined) throw new Error("input row");
      adaptInput(row, fighterAt(state.world, slot), tick, at(state.controls.inputs, slot), at(state.controls.commands, slot));
      if (slot === 0) previous = mask;
    }
    stepMatch(state.match, state.world, state.controls, tick);
  };
  const snapshot = createReplaySnapshot();
  let saved = 0;
  for (let tick = 1; tick <= WATCH; tick++) {
    tickOnce(tick);
    if (saved === 0 && blademaster.special.action === SpecialAction.heroNeutral && chargeStage(QUICKDRAW_CHARGE, blademaster.special.charge) === 2) {
      saved = tick;
      copyReplayState(snapshot, state);
    }
  }
  assertGreaterThan(saved, 0);
  assertGreaterThan(foe.status.damage, 0.0);
  const expected = canonicalState(state);
  copyReplayState(state, snapshot);
  previous = maskOf(Action.special);
  for (let tick = saved + 1; tick <= WATCH; tick++) tickOnce(tick);
  assertEquals(canonicalState(state), expected, "replayed state");
});

test("The computer keeps holding Quickdraw while its foe is beyond the current draw and lets go once the draw reaches it [k1 scenario]", () => {
  const s = scene(0, [{ character: Character.blademaster, x: 0.0, facing: 1 }, { character: Character.rifleman, x: FAR_FOE_X, facing: -1 }]);
  const blademaster = fighter(s, 0);
  const foe = fighter(s, 1);
  frame(s, [Action.special]);
  assertEquals(blademaster.special.action, SpecialAction.heroNeutral, "the stance starts");
  const far = neutralControls();
  assertTrue(pressHeroFollowUp(blademaster, foe, 0, 0, far));
  assertTrue(far.specialHeld);
  foe.motion.x = NEAR_FOE_X;
  const near = neutralControls();
  assertTrue(pressHeroFollowUp(blademaster, foe, 0, 0, near));
  assertFalse(near.specialHeld);
});
