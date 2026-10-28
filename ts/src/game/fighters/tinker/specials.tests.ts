import { assertEquals, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Action, maskOf } from "../../input/actions";
import { adaptInput } from "../../match/inputAdapter";
import { inputRow } from "../../input/inputRow";
import { Phase } from "../../lobby/lobbyState";
import { stepMatch } from "../../match/step";
import { airborne, fighter, frame, scene } from "../../match/padScene";
import { copyReplayState, createReplaySnapshot } from "../../replay/snapshot";
import { copyFighterState } from "../../../generated/state/fighterState";
import { canonicalState } from "../../replay/canonical";
import { Character, SpecialAction } from "../../sim/codes";
import { canAttack } from "../../sim/conditions";
import { createFighter } from "../../sim/fighter";
import { fighterAt } from "../../sim/roster";
import { mainDeckZ } from "../../sim/stage";

const FOE_X = 250.0;
const WATCH = 90;

const LASER_FIRST_FRAME = 20;
const LASER_LAST_FRAME = 27;
const LASER_EARLY_HEIGHT = 120.0;
const LASER_MID_BEAM_HEIGHT = 220.0;
const LASER_PRESS = [Action.special, Action.moveRight] as const;

const ROCKET_FRAMES = [14, 20, 26] as const;
const ROCKETS_EARLY_HEIGHT = 120.0;
const ROCKETS_BETWEEN_HEIGHT = 200.0;
const ROCKETS_PRESS = [Action.special] as const;
const ROCKETS_FOE_X = 900.0;

interface Frame {
  readonly action: number;
  readonly frame: number;
  readonly beamLength: number;
  readonly vx: number;
}

interface Cast {
  readonly trace: readonly Frame[];
  readonly landed: number;
  readonly hit: number;
  readonly ended: number;
  readonly lag: number;
  readonly actionable: number;
  readonly spawns: readonly number[];
}

function cast(press: readonly Action[], height: number, held: readonly Action[] = [], foeX = FOE_X): Cast {
  const s = scene(0, [{ character: Character.tinker, x: 0.0, facing: 1 }, { character: Character.rifleman, x: foeX, facing: -1 }]);
  const tinker = fighter(s, 0);
  const foe = fighter(s, 1);
  for (let n = 0; n < 4; n++) frame(s);
  if (height > 0.0) airborne(tinker, 0.0, f32(mainDeckZ(0) + height));
  const trace: Frame[] = [];
  const spawns: number[] = [];
  const lives = tinker.projectiles.map(() => 0);
  let landed = 0;
  let hit = 0;
  let ended = 0;
  let lag = 0;
  let actionable = 0;
  for (let n = 1; n <= WATCH; n++) {
    frame(s, n === 1 ? press : held);
    if (n === 1 && press.length > 0) assertTrue(tinker.special.action === SpecialAction.heroSide || tinker.special.action === SpecialAction.heroNeutral);
    trace.push({ action: tinker.special.action, frame: tinker.special.frame, beamLength: tinker.special.beamLength, vx: tinker.motion.vx });
    tinker.projectiles.forEach((projectile, index) => {
      if (projectile.life > (lives[index] ?? 0)) spawns.push(n);
      lives[index] = projectile.life;
    });
    if (height > 0.0 && landed === 0 && tinker.motion.grounded) landed = n;
    if (hit === 0 && foe.status.damage > 0.0) hit = n;
    lag = Math.max(lag, tinker.landing.lag);
    if (ended === 0 && tinker.special.action === SpecialAction.none) ended = n;
    if (actionable === 0 && ended > 0 && canAttack(tinker)) actionable = n;
  }
  return { trace, landed, hit, ended, lag, actionable, spawns };
}

function sameCast(carried: Cast, grounded: Cast, height: number): void {
  for (let n = 0; n < grounded.ended; n++) {
    assertEquals(carried.trace[n]?.action, grounded.trace[n]?.action, `action on frame ${n + 1}`);
    assertEquals(carried.trace[n]?.frame, grounded.trace[n]?.frame, `special frame on frame ${n + 1}`);
    assertEquals(carried.trace[n]?.beamLength, grounded.trace[n]?.beamLength, `beam length on frame ${n + 1}`);
  }
  assertEquals(carried.ended, grounded.ended);
  assertEquals(carried.hit, grounded.hit);
  assertEquals(carried.spawns.join(","), grounded.spawns.join(","), "rocket spawn frames");
  assertEquals(carried.lag, cast([], height).lag, "only the touchdown lag every landing has");
  assertGreaterThan(carried.actionable, 0);
  assertEquals(carried.actionable, grounded.actionable, "first frame he can act");
}

function rollbackReplays(press: readonly Action[], specialX: number, height: number, window: (landing: number) => boolean): void {
  const state = createReplaySnapshot();
  const tinker = fighterAt(state.world, 0);
  const foe = fighterAt(state.world, 1);
  const start = createFighter(Character.tinker, 0.0, 1);
  start.motion.grounded = false;
  start.motion.surface = undefined;
  start.motion.z = f32(mainDeckZ(0) + height);
  copyFighterState(tinker, start, 3);
  copyFighterState(foe, createFighter(Character.rifleman, FOE_X, -1), 3);
  state.match.phase = Phase.match;
  state.match.stageChoice = 0;
  state.match.matchSeed = 611;
  state.match.hazards = false;
  state.match.items.on = false;
  state.match.timeLimitMinutes = 0;
  state.match.ultimatesOff = true;
  const mask = maskOf(...press);
  const tickOnce = (tick: number): void => {
    for (const slot of [0, 1]) {
      const pressing = slot === 0 && tick === 1;
      const row = inputRow({ held: pressing ? mask : 0, pressed: pressing ? mask : 0, axisX: pressing ? specialX * 127 : 0, specialX: pressing ? specialX : 0 });
      if (row === undefined) throw new Error("input row");
      const input = state.controls.inputs[slot];
      const commands = state.controls.commands[slot];
      if (input === undefined || commands === undefined) throw new Error("controls slot");
      adaptInput(row, fighterAt(state.world, slot), tick, input, commands);
    }
    stepMatch(state.match, state.world, state.controls, tick);
  };
  const snapshot = createReplaySnapshot();
  let saved = 0;
  for (let tick = 1; tick <= WATCH; tick++) {
    tickOnce(tick);
    if (saved === 0 && tinker.motion.grounded && tinker.special.action !== SpecialAction.none) {
      saved = tick;
      copyReplayState(snapshot, state);
    }
  }
  assertTrue(window(saved));
  const expected = canonicalState(state);
  copyReplayState(state, snapshot);
  for (let tick = saved + 1; tick <= WATCH; tick++) tickOnce(tick);
  assertEquals(canonicalState(state), expected, "replayed state");
}


test("A Laser cast that lands before the beam fires still fires on the same frame, hits, ends on the same frame and adds no landing lag [k1 scenario]", () => {
  const ground = cast(LASER_PRESS, 0.0);
  const early = cast(LASER_PRESS, LASER_EARLY_HEIGHT);
  assertGreaterThan(early.landed, 1);
  assertLessThan(early.landed, LASER_FIRST_FRAME);
  assertGreaterThan(ground.hit, 0);
  sameCast(early, ground, LASER_EARLY_HEIGHT);
});

test("A Laser cast that lands mid-beam keeps the beam to its end and the same total duration [k1 scenario]", () => {
  const ground = cast(LASER_PRESS, 0.0);
  const mid = cast(LASER_PRESS, LASER_MID_BEAM_HEIGHT);
  assertGreaterThan(mid.landed, LASER_FIRST_FRAME);
  assertLessThan(mid.landed, LASER_LAST_FRAME);
  sameCast(mid, ground, LASER_MID_BEAM_HEIGHT);
  for (let n = mid.landed; n <= LASER_LAST_FRAME; n++) assertGreaterThan(mid.trace[n - 1]?.beamLength ?? 0.0, 0.0);
});

test("A Laser cast that lands while drifting slides under ground friction instead of keeping its air speed [k1 scenario]", () => {
  const slide = cast(LASER_PRESS, LASER_EARLY_HEIGHT, [Action.moveRight]);
  assertGreaterThan(slide.landed, 1);
  let previous = slide.trace[slide.landed - 1]?.vx ?? 0.0;
  assertGreaterThan(previous, 0.0);
  for (let n = slide.landed; n < slide.landed + 4; n++) {
    const speed = slide.trace[n]?.vx ?? 0.0;
    assertTrue(speed < previous || previous === 0.0);
    previous = speed;
  }
  assertEquals(slide.trace[slide.ended - 2]?.vx, 0.0);
});

test("A rollback taken on the landing frame of a Laser cast replays the same cast [k1 scenario]", () => {
  rollbackReplays(LASER_PRESS, 1, LASER_MID_BEAM_HEIGHT, landing => landing > LASER_FIRST_FRAME && landing < LASER_LAST_FRAME);
});

test("A Cluster Rockets cast that lands before the first rocket still fires all three on their frames, ends on the same frame and adds no landing lag [k1 scenario]", () => {
  const ground = cast(ROCKETS_PRESS, 0.0, [], ROCKETS_FOE_X);
  const early = cast(ROCKETS_PRESS, ROCKETS_EARLY_HEIGHT, [], ROCKETS_FOE_X);
  assertEquals(ground.spawns.length, ROCKET_FRAMES.length);
  assertGreaterThan(early.landed, 1);
  assertLessThan(early.landed, ROCKET_FRAMES[0]);
  assertEquals(early.spawns.length, ROCKET_FRAMES.length);
  sameCast(early, ground, ROCKETS_EARLY_HEIGHT);
});

test("A Cluster Rockets cast that lands between rockets still fires the rest on their frames [k1 scenario]", () => {
  const ground = cast(ROCKETS_PRESS, 0.0, [], ROCKETS_FOE_X);
  const between = cast(ROCKETS_PRESS, ROCKETS_BETWEEN_HEIGHT, [], ROCKETS_FOE_X);
  assertGreaterThan(between.landed, ROCKET_FRAMES[0]);
  assertLessThan(between.landed, ROCKET_FRAMES[2]);
  assertEquals(between.spawns.length, ROCKET_FRAMES.length);
  sameCast(between, ground, ROCKETS_BETWEEN_HEIGHT);
});

test("A rollback taken on the landing frame of a Cluster Rockets cast replays the same rockets [k1 scenario]", () => {
  rollbackReplays(ROCKETS_PRESS, 0, ROCKETS_BETWEEN_HEIGHT, landing => landing > ROCKET_FRAMES[0] && landing < ROCKET_FRAMES[2]);
});
