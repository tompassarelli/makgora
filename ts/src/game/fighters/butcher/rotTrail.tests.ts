import { assertEquals, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { imod } from "wisp/src/sim/intMath";
import { Action, maskOf } from "../../input/actions";
import { adaptInput } from "../../match/inputAdapter";
import { inputRow } from "../../input/inputRow";
import { Phase } from "../../lobby/lobbyState";
import { stepMatch } from "../../match/step";
import { canonicalState } from "../../replay/canonical";
import { copyReplayState, createReplaySnapshot, type ReplayState } from "../../replay/snapshot";
import { copyFighterState } from "../../../generated/state/fighterState";
import { Character, ProjectileKind } from "../../sim/codes";
import { createFighter, type Fighter, type Projectile } from "../../sim/fighter";
import { setWorldMotionValue } from "../../sim/motion";
import { spawnHeroProjectileAt } from "../../sim/specials/heroProjectiles";
import { fighterAt } from "../../sim/roster";
import { ROT, ROT_PATCH, ROT_PATCH_FRAMES, ROT_PATCH_LIMIT, ROT_TRAIL } from "./specials";

type Press = "rot" | "run" | "back" | "none";

interface Duel {
  readonly state: ReplayState;
  readonly butcher: Fighter;
  readonly foe: Fighter;
  tick: number;
}

const ROWS: Readonly<Record<Press, Parameters<typeof inputRow>[0]>> = {
  rot: { held: maskOf(Action.moveDown, Action.special), pressed: maskOf(Action.special), axisZ: -127, specialZ: -1 },
  run: { held: maskOf(Action.moveRight), axisX: 127 },
  back: { held: maskOf(Action.moveLeft), axisX: -127 },
  none: {},
};

const FAR_AWAY = -450.0;
const ROT_ON = 3;
const TRAIL = ROT_TRAIL;

function duel(foeAhead = FAR_AWAY): Duel {
  const state = createReplaySnapshot();
  const butcher = fighterAt(state.world, 0);
  const foe = fighterAt(state.world, 1);
  copyFighterState(butcher, createFighter(Character.butcher, 0.0, 1), 3);
  copyFighterState(foe, createFighter(Character.medivh, foeAhead, -1), 3);
  state.match.phase = Phase.match;
  state.match.stageChoice = 0;
  state.match.matchSeed = 1;
  state.match.hazards = false;
  state.match.items.on = false;
  state.match.timeLimitMinutes = 0;
  state.match.ultimatesOff = true;
  return { state, butcher, foe, tick: 0 };
}

function step(d: Duel, own: Press, other: Press = "none"): void {
  d.tick++;
  const first = inputRow(ROWS[own]);
  const second = inputRow(ROWS[other]);
  if (first === undefined || second === undefined) throw new Error("the Butcher's input row");
  adaptInput(first, d.butcher, d.tick, d.state.controls.inputs[0], d.state.controls.commands[0]);
  adaptInput(second, d.foe, d.tick, d.state.controls.inputs[1], d.state.controls.commands[1]);
  stepMatch(d.state.match, d.state.world, d.state.controls, d.tick);
}

const patches = (f: Readonly<Fighter>): Projectile[] => f.projectiles.filter((projectile) => projectile.life > 0 && projectile.kind === ProjectileKind.hero && projectile.spec === ROT_PATCH);

function rotOn(d: Duel): void {
  for (let tick = 1; tick <= ROT_ON + 20; tick++) step(d, tick === ROT_ON ? "rot" : "none");
  assertTrue(d.butcher.status.aura);
}

function rotOff(d: Duel): void {
  step(d, "rot");
  for (let frame = 0; frame < 10; frame++) step(d, "none");
  assertTrue(!d.butcher.status.aura);
}

function runFor(d: Duel, frames: number, press: Press = "run", watch?: () => void): void {
  for (let frame = 0; frame < frames; frame++) {
    step(d, press);
    watch?.();
  }
}

function placeOn(fighter: Fighter, patch: Readonly<Projectile>, x = patch.x): void {
  fighter.motion.x = x;
  fighter.motion.z = patch.z;
  fighter.motion.surface = patch.surface;
  setWorldMotionValue(fighter.motion.meleeX, x);
  setWorldMotionValue(fighter.motion.meleeZ, patch.z);
}

test("Rot drops a patch under him as he runs, one every 12 frames at most and at least 24 apart, and none while he stands [k3 measure docs/design/butcher.md]", () => {
  const d = duel();
  rotOn(d);
  assertEquals(patches(d.butcher).length, 1, "the patch he stands in");
  for (let frame = 0; frame < 100; frame++) step(d, "none");
  assertEquals(patches(d.butcher).length, 1, "standing still drops no more");
  const born: number[] = [];
  const seen = new Set<number>();
  runFor(d, 60, "run", () => {
    for (const patch of patches(d.butcher)) if (!seen.has(patch.x)) {
      seen.add(patch.x);
      born.push(patch.x);
    }
  });
  assertGreaterThan(born.length, 3);
  assertLessThan(born.length, 60 / TRAIL.every + 2);
  for (let index = 1; index < born.length; index++) assertTrue(Math.abs(f32((born[index] ?? 0) - (born[index - 1] ?? 0))) >= TRAIL.minTravel);
  for (const patch of patches(d.butcher)) assertEquals(patch.z, d.butcher.motion.z);
});

test("Rot leaves no patch while it is off, and none while he is in the air [k3 measure docs/design/butcher.md]", () => {
  const off = duel();
  runFor(off, 40);
  assertEquals(patches(off.butcher).length, 0);
  const air = duel();
  rotOn(air);
  const before = patches(air.butcher).length;
  air.butcher.motion.grounded = false;
  air.butcher.motion.surface = undefined;
  air.butcher.motion.x = f32(air.butcher.motion.x + 100.0);
  setWorldMotionValue(air.butcher.motion.meleeX, air.butcher.motion.x);
  air.butcher.status.auraFrames = ROT.every * TRAIL.every - 1;
  air.butcher.motion.z = f32(air.butcher.motion.z + 200.0);
  air.butcher.motion.vz = 0.0;
  setWorldMotionValue(air.butcher.motion.meleeZ, air.butcher.motion.z);
  let dropped = false;
  for (let frame = 0; frame < 12; frame++) {
    step(air, "run");
    if (air.butcher.motion.grounded) break;
    if (patches(air.butcher).length > before) dropped = true;
  }
  assertTrue(!dropped);
});

test("A patch stays exactly 180 frames, outlasting the aura that dropped it [k3 measure docs/design/butcher.md]", () => {
  const d = duel();
  rotOn(d);
  rotOff(d);
  const [patch] = patches(d.butcher);
  assertTrue(patch !== undefined);
  if (patch === undefined) return;
  const droppedAt = patch.x;
  let age = ROT_PATCH_FRAMES - patch.life;
  assertEquals(patches(d.butcher).length, 1);
  while (patches(d.butcher).some((live) => live.x === droppedAt)) {
    step(d, "none");
    age++;
    assertLessThan(age, 400);
  }
  assertEquals(ROT_PATCH.life, ROT_PATCH_FRAMES);
  assertEquals(age, ROT_PATCH_FRAMES);
  assertEquals(patches(d.butcher).length, 0, "nothing renews it once the aura is off");
});

function wounds(d: Duel, frames: number): number[] {
  const at: number[] = [];
  for (let frame = 0; frame < frames; frame++) {
    const before = d.foe.status.damage;
    step(d, "none");
    const dealt = f32(d.foe.status.damage - before);
    if (dealt > 0.0) {
      assertEquals(dealt, ROT.damage, "one wound a tick");
      at.push(d.tick);
    }
  }
  return at;
}

function everyTen(at: readonly number[]): void {
  assertGreaterThan(at.length, 2);
  for (let index = 1; index < at.length; index++) assertEquals((at[index] ?? 0) - (at[index - 1] ?? 0), ROT.every);
}

test("A foe standing in a patch after the aura is off is wounded and slowed at the aura's own cadence [k3 measure docs/design/butcher.md]", () => {
  const d = duel();
  rotOn(d);
  runFor(d, 30);
  rotOff(d);
  const patch = patches(d.butcher).reduce((a, b) => (b.life < a.life ? b : a));
  assertGreaterThan(Math.abs(f32(patch.x - d.butcher.motion.x)), 150.0);
  placeOn(d.foe, patch);
  const before = d.foe.status.damage;
  const at = wounds(d, 60);
  everyTen(at);
  assertEquals(d.foe.status.damage, f32(before + f32(at.length * ROT.damage)));
  assertEquals(d.foe.status.slowScale, ROT.slowScale);
  assertGreaterThan(d.foe.status.slowFrames, 0);
});

test("A foe on a patch just off the ground, or beside it past its reach, is not touched [k3 measure docs/design/butcher.md]", () => {
  const d = duel();
  rotOn(d);
  runFor(d, 30);
  rotOff(d);
  const patch = patches(d.butcher).reduce((a, b) => (b.life < a.life ? b : a));
  placeOn(d.foe, patch, -300.0);
  assertEquals(wounds(d, 40).length, 0);
  placeOn(d.foe, patch);
  d.foe.motion.z = f32(patch.z + 3.0 * ROT_PATCH.radius);
  d.foe.motion.grounded = false;
  d.foe.motion.surface = undefined;
  let hit = false;
  for (let frame = 0; frame < 3; frame++) {
    const before = d.foe.status.damage;
    step(d, "none");
    hit ||= d.foe.status.damage > before;
  }
  assertTrue(!hit);
});

test("A foe in the aura and in overlapping patches takes one wound every 10 frames, not one per source [k3 measure docs/design/butcher.md]", () => {
  const d = duel();
  rotOn(d);
  runFor(d, 30);
  for (let frame = 0; frame < 4; frame++) step(d, "none");
  const newest = patches(d.butcher).reduce((a, b) => (b.life > a.life ? b : a));
  for (const offset of [-30.0, 25.0]) spawnHeroProjectileAt(d.butcher, ROT_PATCH, f32(newest.x + offset), newest.z, 1, false, 99, newest.surface);
  const touching = patches(d.butcher).filter((patch) => Math.abs(f32(patch.x - newest.x)) < ROT_PATCH.radius);
  assertEquals(touching.length, 3);
  placeOn(d.butcher, newest);
  placeOn(d.foe, newest);
  everyTen(wounds(d, 50));
});

test("At most 15 patches live, enough for a run to keep every patch its full 180 frames: the drop that would be the 16th removes the oldest [k3 measure docs/design/butcher.md]", () => {
  const d = duel();
  rotOn(d);
  for (let index = 0; index < ROT_PATCH_LIMIT - 1; index++) {
    spawnHeroProjectileAt(d.butcher, ROT_PATCH, f32(2.0 * index), d.butcher.motion.z, 1, false, 99, d.butcher.motion.surface);
    step(d, "none");
  }
  const lives = patches(d.butcher).map((patch) => patch.life).sort((a, b) => a - b);
  assertEquals(lives.length, ROT_PATCH_LIMIT);
  const [oldest = 0, second = 0] = lives;
  assertEquals(ROT_PATCH_LIMIT * TRAIL.every >= ROT_PATCH_FRAMES, true);
  let steps = 0;
  while (!patches(d.butcher).some((patch) => patch.life === ROT_PATCH_FRAMES) && steps < 40) {
    step(d, "run");
    steps++;
  }
  const after = patches(d.butcher).map((patch) => patch.life).sort((a, b) => a - b);
  assertEquals(after.length, ROT_PATCH_LIMIT);
  assertEquals(after[0], second - steps);
  assertTrue(after[0] !== oldest - steps);
  let most = 0;
  for (let leg = 0; leg < 6; leg++) runFor(d, 50, imod(leg, 2) === 0 ? "run" : "back", () => { most = Math.max(most, patches(d.butcher).length); });
  assertTrue(most <= ROT_PATCH_LIMIT);
});

const SCRIPT = (tick: number): Press => (tick === ROT_ON ? "rot" : tick > 20 && tick < 50 ? "run" : tick >= 50 && tick < 80 ? "back" : tick === 150 ? "rot" : "none");

test("A rollback replays a Rot trail from before, during and after the run to the live checksum [k1 scenario]", () => {
  const end = 220;
  for (const save of [10, 40, 60, 100, 145, 160]) {
    const run = duel(300.0);
    const snapshot = createReplaySnapshot();
    let showed = false;
    for (let tick = 1; tick <= end; tick++) {
      if (tick === save) copyReplayState(snapshot, run.state);
      step(run, SCRIPT(tick));
      showed ||= patches(run.butcher).length > 1;
    }
    assertTrue(showed);
    const expected = canonicalState(run.state);
    copyReplayState(run.state, snapshot);
    run.tick = save - 1;
    for (let tick = save; tick <= end; tick++) step(run, SCRIPT(tick));
    assertEquals(canonicalState(run.state), expected, `replay from ${save}`);
  }
});
