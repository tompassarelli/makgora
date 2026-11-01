import { assertEquals, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { canonicalState } from "../../replay/canonical";
import { copyReplayState, createReplaySnapshot } from "../../replay/snapshot";
import { ProjectileKind } from "../../sim/codes";
import { type Fighter, placedObject } from "../../sim/fighter";
import { setWorldMotionValue } from "../../sim/motion";
import { untouchable } from "../../sim/placedWalk";
import { CompanionMode } from "../../sim/specials/schema";
import { mainDeckLeft, mainDeckRight, surfaceCount, surfaceLeft, surfaceRight, surfaceZAt } from "../../sim/stage";
import { LAVA_SPAWN, SPAWN_WALK } from "./lavaSpawn";
import { CRATER, RAZE_END_FRAME, SUBMERGE_FALLBACK_REACH, SUBMERGE_SURFACE_FRAME } from "./specials";
import { type Duel, duel, idle, lift, step } from "./testDuel";

const FOE = 520.0;
const NEAR = SPAWN_WALK.near;
const FAR = SPAWN_WALK.far;

const spawn = (d: Duel) => placedObject(d.caster, 0);
const fireballs = (f: Readonly<Fighter>): number => f.projectiles.filter((shot) => shot.life > 0 && shot.kind === ProjectileKind.hero && shot.spec === LAVA_SPAWN.shot).length;
const gap = (d: Duel): number => Math.abs(f32(spawn(d).x - d.caster.motion.x));
const near = (actual: number, expected: number, label: string): void => assertEquals(Math.abs(f32(actual - expected)) < f32(0.01), true, `${label}: ${actual} is not ${expected}`);
const craterX = (d: Duel): number | undefined => d.caster.projectiles.find((shot) => shot.life > 0 && shot.spec === CRATER)?.x;

function stand(fighter: Fighter, x: number, z = fighter.motion.z, surface = fighter.motion.surface): void {
  const { motion } = fighter;
  motion.x = x;
  motion.z = z;
  motion.vx = 0.0;
  motion.vz = 0.0;
  motion.surface = surface;
  motion.grounded = true;
  setWorldMotionValue(motion.meleeX, x);
  setWorldMotionValue(motion.meleeZ, z);
}

function summoned(foeAhead: number, facing = 1, casterX = 0.0): Duel {
  const d = duel(foeAhead, facing, casterX);
  step(d, "down");
  for (let guard = 0; guard < 60 && spawn(d).life <= 0; guard++) step(d, "hold");
  assertEquals(spawn(d).life > 0, true, "the spawn is out");
  idle(d, 30);
  return d;
}

function submerge(d: Duel): void {
  step(d, "down", { x: d.caster.facing, z: 0 });
}

function diveWithSpawn(d: Duel, label: string): void {
  const lifeBefore = spawn(d).life;
  submerge(d);
  for (let frame = 1; frame < SUBMERGE_SURFACE_FRAME; frame++) {
    const shotsBefore = fireballs(d.caster);
    assertEquals(spawn(d).mode, CompanionMode.burrowed, `${label}: under with him at frame ${frame}`);
    assertEquals(untouchable(spawn(d)), true, `${label}: cannot be hit at frame ${frame}`);
    step(d, "none");
    assertEquals(fireballs(d.caster) <= shotsBefore, true, `${label}: threw nothing while under at frame ${frame}`);
  }
  assertEquals(spawn(d).mode, CompanionMode.rising, `${label}: comes up on his surfacing frame`);
  near(gap(d), NEAR, `${label}: beside him`);
  assertEquals(spawn(d).z, d.caster.motion.z, `${label}: on his floor`);
  assertEquals(spawn(d).surface, d.caster.motion.surface, `${label}: on his surface`);
  assertEquals(spawn(d).life, lifeBefore - SUBMERGE_SURFACE_FRAME, `${label}: life kept running`);
  idle(d, SPAWN_WALK.riseFrames);
  assertEquals(spawn(d).mode, CompanionMode.follow, `${label}: back to work after it rises`);
}

test("A live Lava Spawn sinks with Submerge, cannot be hit or throw while under, and comes up beside him on the foe's side, at the crater or the fallback step [k3 measure docs/design/roster.md]", () => {
  const d = summoned(FOE);
  step(d, "down", { x: 0, z: -1 }, { x: 0, z: -1 });
  idle(d, RAZE_END_FRAME + 1);
  for (let guard = 0; guard < 120 && craterX(d) === undefined; guard++) step(d, "none");
  const crater = craterX(d);
  assertEquals(crater !== undefined, true, "a crater formed");
  stand(d.caster, -300.0);
  diveWithSpawn(d, "crater");
  assertEquals(d.caster.motion.x, crater ?? NaN, "he came up at the crater");
  for (const facing of [1, -1]) {
    const fallback = summoned(FOE, facing);
    diveWithSpawn(fallback, `facing ${facing}`);
    assertEquals(fallback.caster.motion.x, f32(facing * SUBMERGE_FALLBACK_REACH), "he came up a step ahead");
    assertEquals(f32(spawn(fallback).x - fallback.caster.motion.x) * facing > 0.0, true, "between him and the foe");
  }
});

test("The spawn walks after him to stay within its leash, no faster than its walk speed [k3 measure docs/design/roster.md]", () => {
  for (const moved of [480.0, -480.0]) {
    const d = summoned(FOE);
    stand(d.caster, moved);
    let last = spawn(d).x;
    for (let frame = 0; frame < 400; frame++) {
      step(d, "none");
      assertEquals(Math.abs(f32(spawn(d).x - last)) <= f32(SPAWN_WALK.speed + f32(0.01)), true, `stride at frame ${frame}`);
      last = spawn(d).x;
    }
    assertEquals(gap(d) >= NEAR && gap(d) <= FAR, true, `within ${NEAR}-${FAR} of him after he moved to ${moved}: ${gap(d)}`);
    assertEquals(f32(d.foe.motion.x - spawn(d).x) * f32(d.foe.motion.x - d.caster.motion.x) > 0.0, true, "on the foe's side of him");
  }
});

test("The spawn closes on a foe out of its missile range as far as the leash allows, and stands still once both hold [k2 property]", () => {
  const d = summoned(880.0, 1, -300.0);
  idle(d, 200);
  near(f32(spawn(d).x - d.caster.motion.x), FAR, "at the far end of the leash toward the distant foe");
  const close = summoned(300.0);
  idle(close, 60);
  const start = spawn(close).x;
  idle(close, 60);
  assertEquals(spawn(close).x, start, "foe in range and spawn in the band, so it stays");
});

test("The spawn stops at the ledge instead of walking off it after him or a foe [k3 measure docs/design/roster.md]", () => {
  const edge = f32(mainDeckRight(0) - 20.0);
  const d = summoned(FOE, 1, f32(edge - 200.0));
  stand(d.caster, edge);
  lift(d.foe, 200.0, f32(mainDeckRight(0) + 900.0));
  for (let frame = 0; frame < 300; frame++) {
    step(d, "none");
    d.foe.motion.vz = 0.0;
    assertEquals(spawn(d).x <= f32(mainDeckRight(0) - LAVA_RADIUS), true, `on the deck at frame ${frame}`);
    assertEquals(spawn(d).z, 0.0, `on the floor at frame ${frame}`);
  }
  const left = summoned(FOE, -1, f32(mainDeckLeft(0) + 220.0));
  stand(left.caster, f32(mainDeckLeft(0) + 20.0));
  idle(left, 300);
  assertEquals(spawn(left).x >= f32(mainDeckLeft(0) + LAVA_RADIUS), true, "left ledge too");
});

const LAVA_RADIUS = 25.0;

interface Platform { readonly stage: number; readonly index: number; readonly left: number; readonly right: number; readonly z: number }

function platform(): Platform {
  for (let stage = 0; stage < 12; stage++) {
    for (let index = 1; index < surfaceCount(stage); index++) {
      const left = surfaceLeft(stage, index, 0);
      const right = surfaceRight(stage, index, 0);
      const middle = f32((left + right) / 2.0);
      const z = surfaceZAt(stage, index, 0, middle);
      const fixed = surfaceLeft(stage, index, 900) === left && surfaceRight(stage, index, 900) === right && surfaceZAt(stage, index, 900, middle) === z;
      if (fixed && z > 40.0 && f32(right - left) > f32(4.0 * NEAR)) return { stage, index, left, right, z };
    }
  }
  throw new Error("no fixed platform on any stage");
}

test("Left on another floor than his, the spawn sinks after a short delay and re-forms beside him on his platform [k3 measure docs/design/roster.md]", () => {
  const above = platform();
  const middle = f32((above.left + above.right) / 2.0);
  const d = summoned(FOE, 1, middle);
  d.state.match.stageChoice = above.stage;
  const deck = spawn(d).surface;
  stand(d.caster, middle, above.z, above.index);
  for (let frame = 1; frame < SPAWN_WALK.strandedFrames; frame++) {
    step(d, "none");
    stand(d.caster, middle, above.z, above.index);
    assertEquals(spawn(d).mode === CompanionMode.follow || spawn(d).mode === CompanionMode.throwing, true, `still waiting at frame ${frame}`);
  }
  step(d, "none");
  assertEquals(spawn(d).mode, CompanionMode.burrowed, "sinks once stranded");
  for (let frame = 0; frame < 40 && spawn(d).mode === CompanionMode.burrowed; frame++) {
    stand(d.caster, middle, above.z, above.index);
    step(d, "none");
  }
  assertEquals(spawn(d).mode, CompanionMode.rising, "re-forms");
  assertEquals(spawn(d).surface, above.index, "on his platform");
  assertEquals(spawn(d).surface !== deck, true);
  assertEquals(spawn(d).z, above.z, "standing on it");
  near(gap(d), NEAR, "beside him");
});

test("A rollback across the spawn's stranded wait, its sinking and its rising replays to the same canonical state [k1 scenario]", () => {
  const above = platform();
  const middle = f32((above.left + above.right) / 2.0);
  const frames = SPAWN_WALK.strandedFrames + SPAWN_WALK.underFrames + SPAWN_WALK.riseFrames + 20;
  for (const saveAt of [5, 20, SPAWN_WALK.strandedFrames + 4]) {
    const d = summoned(FOE, 1, middle);
    d.state.match.stageChoice = above.stage;
    const snapshot = createReplaySnapshot();
    const start = d.tick;
    const play = (): void => {
      stand(d.caster, middle, above.z, above.index);
      step(d, "none");
    };
    for (let tick = 1; tick <= frames; tick++) {
      if (tick === saveAt) copyReplayState(snapshot, d.state);
      play();
    }
    assertEquals(spawn(d).surface, above.index, "it re-formed on his platform");
    const expected = canonicalState(d.state);
    copyReplayState(d.state, snapshot);
    d.tick = start + saveAt - 1;
    for (let tick = saveAt; tick <= frames; tick++) play();
    assertEquals(canonicalState(d.state), expected, `saved at ${saveAt}`);
  }
});
