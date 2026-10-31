import { assertEquals, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Action, maskOf } from "../../input/actions";
import { inputRow } from "../../input/inputRow";
import { Phase } from "../../lobby/lobbyState";
import { adaptInput } from "../../match/inputAdapter";
import { stepMatch } from "../../match/step";
import { canonicalState } from "../../replay/canonical";
import { copyReplayState, createReplaySnapshot, type ReplayState } from "../../replay/snapshot";
import { copyFighterState } from "../../../generated/state/fighterState";
import { Character, HeroStatusKind, SpecialAction } from "../../sim/codes";
import { canBeGrabbed } from "../../sim/conditions";
import { createFighter, type Fighter } from "../../sim/fighter";
import { fighterAt } from "../../sim/roster";
import { DEATH_GRIP, DEATH_GRIP_HOLD, DEATH_GRIP_PULL_FRAMES, DEATH_GRIP_SPAWN_FRAME, DEATH_GRIP_SPEED, DEATH_GRIP_STUN_FRAMES, VALKYR } from "./specials";

type Press = "neutral" | "side" | "shield" | "none";

interface Duel {
  readonly state: ReplayState;
  readonly king: Fighter;
  readonly foe: Fighter;
  readonly facing: number;
  tick: number;
}

interface Setup {
  readonly facing: number;
  readonly foeAhead: number;
  readonly height?: number;
}

const AIR_HEIGHT = 900.0;
const LOW_AIR_HEIGHT = 300.0;
const VALKYR_SPAWN_FRAME = 26;
const AIR_LANDING_LAG = 20;

function duel(setup: Setup): Duel {
  const state = createReplaySnapshot();
  const king = fighterAt(state.world, 0);
  const foe = fighterAt(state.world, 1);
  copyFighterState(king, createFighter(Character.lichKing, 0.0, setup.facing), 3);
  copyFighterState(foe, createFighter(Character.warden, f32(setup.facing * setup.foeAhead), -setup.facing), 3);
  state.match.phase = Phase.match;
  state.match.stageChoice = 0;
  state.match.matchSeed = 7;
  state.match.hazards = false;
  state.match.items.on = false;
  state.match.timeLimitMinutes = 0;
  state.match.ultimatesOff = true;
  const d: Duel = { state, king, foe, facing: setup.facing, tick: 0 };
  if (setup.height !== undefined) lift(d, setup.height);
  return d;
}

function lift(d: Duel, z: number): void {
  hover(d.king, z);
  hover(d.foe, z);
}

function hover(f: Fighter, z: number): void {
  f.motion.z = z;
  f.motion.vz = 0.0;
  f.motion.grounded = false;
  f.motion.surface = undefined;
}

function row(d: Readonly<Duel>, press: Press): Parameters<typeof inputRow>[0] {
  const toward = d.facing > 0 ? Action.moveRight : Action.moveLeft;
  switch (press) {
    case "neutral": return { held: maskOf(Action.special), pressed: maskOf(Action.special) };
    case "side": return { held: maskOf(toward, Action.special), pressed: maskOf(Action.special), axisX: d.facing > 0 ? 127 : -127, specialX: d.facing > 0 ? 1 : -1 };
    case "shield": return { held: maskOf(Action.rightTrigger), pressed: maskOf(Action.rightTrigger) };
    default: return {};
  }
}

function step(d: Duel, own: Press, other: Press = "none"): void {
  d.tick++;
  const first = inputRow(row(d, own));
  const second = inputRow(row(d, other));
  if (first === undefined || second === undefined) throw new Error("the Lich King's input row");
  adaptInput(first, d.king, d.tick, d.state.controls.inputs[0], d.state.controls.commands[0]);
  adaptInput(second, d.foe, d.tick, d.state.controls.inputs[1], d.state.controls.commands[1]);
  stepMatch(d.state.match, d.state.world, d.state.controls, d.tick);
}

const pulling = (f: Readonly<Fighter>): boolean => f.status.condition === HeroStatusKind.gripped && f.status.pullBy !== undefined;
const stunned = (f: Readonly<Fighter>): boolean => f.status.condition === HeroStatusKind.gripped && f.status.pullBy === undefined;

interface Grip {
  readonly gripped: boolean;
  readonly pullFrames: number;
  readonly arrivedX: number | undefined;
  readonly arrivedZ: number | undefined;
  readonly kingX: number;
  readonly kingZ: number;
  readonly stunFrames: number;
  readonly d: Duel;
}

function grip(setup: Setup, other: Press = "none", frames = 90): Grip {
  const d = duel(setup);
  step(d, "none");
  step(d, "side", other);
  let gripped = false;
  let pullFrames = 0;
  let stunFrames = 0;
  let arrivedX: number | undefined;
  let arrivedZ: number | undefined;
  let kingX = 0.0;
  let kingZ = 0.0;
  let arrivedTick = 0;
  for (let frame = 0; frame < frames; frame++) {
    const before = pulling(d.foe);
    step(d, "none", other);
    gripped ||= d.foe.status.condition === HeroStatusKind.gripped;
    if (pulling(d.foe) && d.foe.launch.hitlag <= 0) pullFrames++;
    if (before && !pulling(d.foe)) {
      arrivedX = d.foe.motion.x;
      arrivedTick = d.tick;
      arrivedZ = d.foe.motion.z;
      kingX = d.king.motion.x;
      kingZ = d.king.motion.z;
    }
    if (arrivedX !== undefined && stunFrames === 0 && d.foe.status.condition !== HeroStatusKind.gripped) stunFrames = d.tick - arrivedTick + 1;
  }
  return { gripped, pullFrames, arrivedX, arrivedZ, kingX, kingZ, stunFrames, d };
}

test("Val'kyr Shadowguard is his neutral special: she leaves on frame 26 at 5 a frame his way and carries the foe she reaches, in both facings [k3 measure docs/design/roster.md]", () => {
  for (const facing of [1, -1]) {
    const d = duel({ facing, foeAhead: 200.0 });
    step(d, "none");
    step(d, "neutral");
    assertEquals(d.king.special.action, SpecialAction.heroNeutral);
    let spawnedOn: number | undefined;
    let carried = false;
    for (let frame = 0; frame < 80; frame++) {
      step(d, "none");
      const valkyr = d.king.projectiles.find((p) => p.life > 0 && p.spec === VALKYR);
      if (spawnedOn === undefined && valkyr !== undefined) {
        spawnedOn = d.king.special.frame;
        assertEquals(valkyr.velocityX, f32(facing * 5.0));
      }
      carried ||= d.foe.status.condition === HeroStatusKind.carried;
    }
    assertEquals(spawnedOn, VALKYR_SPAWN_FRAME);
    assertTrue(carried);
    assertTrue(d.foe.status.condition !== HeroStatusKind.gripped);
  }
});

test("Death Grip is his side special: the coil leaves on frame 16 and grips a foe 300 ahead but never one 420 ahead, in both facings [k3 measure docs/design/roster.md]", () => {
  for (const facing of [1, -1]) {
    const d = duel({ facing, foeAhead: 900.0 });
    step(d, "none");
    step(d, "side");
    assertEquals(d.king.special.action, SpecialAction.heroSide);
    while (!d.king.projectiles.some((p) => p.life > 0 && p.spec === DEATH_GRIP)) step(d, "none");
    assertEquals(d.king.special.frame, DEATH_GRIP_SPAWN_FRAME);
    assertEquals(d.king.projectiles.find((p) => p.life > 0 && p.spec === DEATH_GRIP)?.velocityX, f32(facing * DEATH_GRIP_SPEED));
    assertTrue(grip({ facing, foeAhead: 300.0 }).gripped);
    const far = grip({ facing, foeAhead: 420.0 });
    assertTrue(!far.gripped);
    assertEquals(far.d.foe.status.damage, 0.0);
  }
});

test("Death Grip yanks the foe over 10 frames to 70 in front of him and lands it there, in both facings [k3 measure docs/design/roster.md]", () => {
  for (const facing of [1, -1]) {
    for (const foeAhead of [150.0, 300.0]) {
      const g = grip({ facing, foeAhead });
      assertTrue(g.gripped);
      assertEquals(g.pullFrames, DEATH_GRIP_PULL_FRAMES);
      assertTrue(g.arrivedX !== undefined);
      assertLessThan(Math.abs((g.arrivedX ?? 0.0) - f32(g.kingX + f32(facing * DEATH_GRIP_HOLD))), 1.0);
      assertEquals(g.d.foe.facing, -facing);
      assertTrue(g.d.foe.motion.grounded);
      assertGreaterThan(g.d.foe.status.damage, 0.0);
    }
  }
});

test("A raised shield stops Death Grip: the foe is neither gripped nor moved [k3 measure docs/design/roster.md]", () => {
  for (const facing of [1, -1]) {
    const g = grip({ facing, foeAhead: 250.0 }, "shield", 60);
    assertTrue(!g.gripped);
    assertEquals(g.d.foe.status.damage, 0.0);
    assertLessThan(Math.abs(g.d.foe.motion.x - f32(facing * 250.0)), 30.0);
  }
});

test("Death Grip in the air pulls an airborne foe to his height and his side, and his landing takes the air landing lag [k3 measure docs/design/roster.md]", () => {
  for (const facing of [1, -1]) {
    const d = duel({ facing, foeAhead: 250.0, height: AIR_HEIGHT });
    step(d, "side");
    assertEquals(d.king.special.action, SpecialAction.heroSide);
    let arrived = false;
    let landingLag = 0;
    for (let frame = 0; frame < 120; frame++) {
      const before = pulling(d.foe);
      if (d.foe.status.condition !== HeroStatusKind.gripped) hover(d.foe, f32(AIR_HEIGHT - 200.0));
      step(d, "none");
      if (before && !pulling(d.foe)) {
        arrived = true;
        assertLessThan(Math.abs(d.foe.motion.x - f32(d.king.motion.x + f32(facing * DEATH_GRIP_HOLD))), 1.0);
        assertLessThan(Math.abs(d.foe.motion.z - d.king.motion.z), 30.0);
      }
    }
    assertTrue(arrived);
    const low = duel({ facing, foeAhead: 900.0, height: LOW_AIR_HEIGHT });
    step(low, "side");
    for (let frame = 0; frame < 60; frame++) {
      step(low, "none");
      if (low.king.motion.grounded) landingLag = Math.max(landingLag, low.king.landing.lag);
    }
    assertGreaterThan(landingLag, AIR_LANDING_LAG - 2);
  }
});

test("From the frame it arrives the foe is stunned for exactly 18 frames, cannot be grabbed in them, and is free on the next [k3 measure docs/design/roster.md]", () => {
  for (const facing of [1, -1]) {
    const g = grip({ facing, foeAhead: 300.0 });
    assertEquals(g.stunFrames, DEATH_GRIP_STUN_FRAMES);
    assertTrue(g.d.foe.status.condition === HeroStatusKind.none);
    const d = duel({ facing, foeAhead: 300.0 });
    step(d, "none");
    step(d, "side");
    while (!stunned(d.foe)) step(d, "none");
    let grabbable = false;
    while (stunned(d.foe)) {
      grabbable ||= canBeGrabbed(d.foe);
      step(d, "none");
    }
    assertTrue(!grabbable);
    assertTrue(canBeGrabbed(d.foe));
  }
});

test("A rollback across Death Grip's coil, pull and stun replays to the live checksum [k1 scenario]", () => {
  const end = 70;
  const script = (tick: number): Press => tick === 2 ? "side" : "none";
  for (const facing of [1, -1]) {
    for (const save of [10, 20, 26, 30, 36, 44]) {
      const run = duel({ facing, foeAhead: 300.0 });
      const snapshot = createReplaySnapshot();
      let shown = false;
      for (let tick = 1; tick <= end; tick++) {
        if (tick === save) copyReplayState(snapshot, run.state);
        step(run, script(tick));
        shown ||= pulling(run.foe);
      }
      assertTrue(shown);
      const expected = canonicalState(run.state);
      copyReplayState(run.state, snapshot);
      run.tick = save - 1;
      for (let tick = save; tick <= end; tick++) step(run, script(tick));
      assertEquals(canonicalState(run.state), expected);
    }
  }
});
