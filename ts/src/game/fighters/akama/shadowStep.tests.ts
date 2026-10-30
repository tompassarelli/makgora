import { assertEquals, assertGreaterThan, assertLessThan, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { imod } from "wisp/src/sim/intMath";
import { squareRoot } from "../../sim/warcraftMath";
import { copyReplayState, createReplaySnapshot } from "../../replay/snapshot";
import { canonicalState } from "../../replay/canonical";
import { LedgeState, SpecialAction } from "../../sim/codes";
import { HERO_REFERENCE_HEIGHT } from "../../sim/heroMoves";
import { FOLLOW_UP_FORM } from "../../sim/specials/schema";
import { AKAMA_HERO } from "./kit";
import {
  ARRIVAL_ANGLE, ARRIVAL_DAMAGE, SECOND_STEP_SHARE, SHADOW_STEP, STEP_AIM_FRAMES, STEP_DISSOLVE, STEP_FRAMES, STEP_INTANGIBLE_FROM, STEP_SPEED,
} from "./shadowStep";
import { type Duel, type Stick, duel, lift, step } from "./testDuel";

const H = HERO_REFERENCE_HEIGHT;
const FAR = 700.0;
const SKY = 2000.0;
const FIRST_END = STEP_DISSOLVE + STEP_FRAMES;
const SECOND_END = (SHADOW_STEP.ground.followUps?.[0]?.special.endFrame ?? 0) - 1;
const UP: Stick = { x: 0, z: 1 };
const ACROSS: Stick = { x: 1, z: 0 };
const SLANT: Stick = { x: f32(0.6), z: f32(0.8) };

const secondLeg = (d: Duel): boolean => d.akama.special.form >= FOLLOW_UP_FORM;
const moved = (d: Duel, x: number, z: number): number => squareRoot(f32(f32((d.akama.motion.x - x) * (d.akama.motion.x - x)) + f32((d.akama.motion.z - z) * (d.akama.motion.z - z))));

function launch(d: Duel, stick: Stick): void {
  step(d, "up", stick);
}

function holdUntil(d: Duel, stick: Stick, done: () => boolean, limit = 200): void {
  for (let tick = 0; tick < limit && !done(); tick++) step(d, "hold", stick);
}

function firstStep(stick: Stick, x = 0.0, z = SKY): { readonly d: Duel; readonly travelled: number; readonly dx: number; readonly dz: number } {
  const d = duel(FAR);
  lift(d.akama, z, x);
  launch(d, stick);
  holdUntil(d, stick, () => d.akama.special.frame >= FIRST_END + 1);
  return { d, travelled: moved(d, x, z), dx: d.akama.motion.x - x, dz: d.akama.motion.z - z };
}

test("The first step covers 2.5 H along the held stick at any angle [k3 measure docs/design/roster.md]", () => {
  assertEquals(STEP_SPEED * STEP_FRAMES, 2.5 * H);
  for (const stick of [UP, ACROSS, SLANT]) {
    const { travelled, dx, dz } = firstStep(stick);
    assertLessThan(Math.abs(travelled - 2.5 * H), 2.0);
    assertLessThan(Math.abs(dx / travelled - stick.x), f32(0.02));
    assertLessThan(Math.abs(dz / travelled - stick.z), f32(0.02));
  }
});

test("Akama is intangible from frame 8 of the dissolve through his last step frame and visible again on arrival [k3 measure docs/design/roster.md]", () => {
  const d = duel(FAR);
  lift(d.akama, SKY);
  const seen: number[] = [];
  launch(d, UP);
  for (let tick = 0; tick < FIRST_END + 6; tick++) {
    if (d.akama.status.invincible > 0) seen.push(d.akama.special.frame);
    step(d, "hold", UP);
  }
  const first = seen[0] ?? -1;
  const last = seen[seen.length - 1] ?? -1;
  assertEquals(seen.length, last - first + 1, "one unbroken window");
  assertEquals(first + 1, STEP_INTANGIBLE_FROM);
  assertEquals(last + 1, FIRST_END);
  assertGreaterThan(SHADOW_STEP.ground.intangible?.first ?? 0, 0);
  assertEquals(SHADOW_STEP.ground.intangible?.first, STEP_INTANGIBLE_FROM);
  assertEquals(SHADOW_STEP.ground.intangible?.last, FIRST_END - 1);
});

test("Holding special at reappearance gives an 8-frame visible aim window, then a second step of 60% in the new direction [k3 measure docs/design/roster.md]", () => {
  const { d, travelled } = firstStep(UP);
  holdUntil(d, UP, () => secondLeg(d));
  assertEquals(secondLeg(d), true, "the second step began");
  const x = d.akama.motion.x;
  const z = d.akama.motion.z;
  let visible = 0;
  for (let tick = 0; tick < STEP_AIM_FRAMES; tick++) {
    if (d.akama.status.invincible === 0) visible++;
    step(d, "hold", ACROSS);
  }
  assertEquals(visible, STEP_AIM_FRAMES, "visible and vulnerable throughout the aim window");
  assertLessThan(moved(d, x, z), 1.0);
  holdUntil(d, ACROSS, () => d.akama.special.frame >= SECOND_END, 40);
  const travelledSecond = moved(d, x, z);
  assertLessThan(Math.abs(travelledSecond - SECOND_STEP_SHARE * travelled), 2.0);
  assertGreaterThan(d.akama.motion.x - x, travelledSecond * f32(0.98));
});

test("Releasing special at the first arrival ends the move there and leaves him helpless [k3 measure docs/design/roster.md]", () => {
  const { d } = firstStep(UP);
  const x = d.akama.motion.x;
  const z = d.akama.motion.z;
  let highest = z;
  for (let tick = 0; tick < 60; tick++) {
    step(d, "none");
    highest = Math.max(highest, d.akama.motion.z);
    assertEquals(secondLeg(d), false);
  }
  assertLessThan(highest, z + 1.0);
  assertEquals(d.akama.special.action, SpecialAction.none, "the move ended");
  assertEquals(d.akama.special.fall, true, "helpless after the one step");
  assertLessThan(Math.abs(d.akama.motion.x - x), 1.0);
  assertLessThan(d.akama.motion.z, z);
});

test("Never more than two steps, and the last one ends helpless [k3 measure docs/design/roster.md]", () => {
  const d = duel(FAR);
  lift(d.akama, SKY);
  launch(d, UP);
  let vanishes = 0;
  let wasOut = false;
  for (let tick = 0; tick < 200; tick++) {
    step(d, "hold", imod(tick, 2) === 0 ? ACROSS : UP);
    const out = d.akama.status.invincible > 0;
    if (out && !wasOut) vanishes++;
    wasOut = out;
  }
  assertEquals(vanishes, 2, "two vanishings and no third");
  assertEquals(d.akama.special.action, SpecialAction.none);
  assertEquals(d.akama.special.fall, true, "helpless after the last step");
  assertLessThan(d.akama.motion.z, SKY + 2.5 * H + 1.5 * H);
});

test("Either arrival snaps to the ledge it lands beside [k3 measure docs/design/roster.md]", () => {
  const first = duel(FAR);
  lift(first.akama, -30.0, -890.0);
  launch(first, ACROSS);
  holdUntil(first, ACROSS, () => first.akama.ledge.state === LedgeState.hang, 40);
  assertEquals(first.akama.ledge.state, LedgeState.hang, "the first step catches the ledge");
  const second = duel(FAR);
  lift(second.akama, -360.0, -758.0);
  launch(second, UP);
  holdUntil(second, UP, () => secondLeg(second));
  for (let tick = 0; tick < STEP_AIM_FRAMES; tick++) step(second, "hold", ACROSS);
  holdUntil(second, ACROSS, () => second.akama.ledge.state === LedgeState.hang, 40);
  assertEquals(second.akama.ledge.state, LedgeState.hang, "the second step catches the ledge");
});

test("The arrival slash hits for 6% at a low launch angle [k3 measure docs/design/roster.md]", () => {
  const regions = [...(SHADOW_STEP.ground.regions ?? []), ...(SHADOW_STEP.ground.followUps?.[0]?.special.regions ?? [])];
  assertEquals(regions.length, 2);
  for (const region of regions) {
    assertEquals(region.hit.effect.damage, ARRIVAL_DAMAGE);
    const angle = Math.atan2(region.hit.effect.launchZ, region.hit.effect.launchX) * 180 / Math.PI;
    assertLessThan(Math.abs(angle - ARRIVAL_ANGLE), 0.5);
  }
  assertEquals(AKAMA_HERO.specials?.up.name, "Shadow Step");
});

const ROLLBACK_END = 80;
const rollbackPress = (tick: number) => tick === 3 ? "up" as const : tick < 70 ? "hold" as const : "none" as const;
const rollbackStick = (tick: number): Stick => tick < 40 ? SLANT : { x: f32(-0.8), z: f32(0.6) };

function replayFrom(saveTick: number): { readonly expected: string; readonly replayed: string } {
  const run = duel(FAR);
  lift(run.akama, SKY);
  const snapshot = createReplaySnapshot();
  for (let tick = 1; tick <= ROLLBACK_END; tick++) {
    if (tick === saveTick) copyReplayState(snapshot, run.state);
    step(run, rollbackPress(tick), rollbackStick(tick));
  }
  const expected = canonicalState(run.state);
  copyReplayState(run.state, snapshot);
  run.tick = saveTick - 1;
  for (let tick = saveTick; tick <= ROLLBACK_END; tick++) step(run, rollbackPress(tick), rollbackStick(tick));
  return { expected, replayed: canonicalState(run.state) };
}

test("A rollback replays both Shadow Steps from mid-vanish, the first arrival and the aim window to the same state [k1 scenario]", () => {
  for (const saveTick of [8, STEP_DISSOLVE + STEP_FRAMES + 3, STEP_DISSOLVE + STEP_FRAMES + 12, 50]) {
    const { expected, replayed } = replayFrom(saveTick);
    assertEquals(replayed, expected);
  }
});
