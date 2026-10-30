import { assertEquals, assertFalse, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { imod } from "wisp/src/sim/intMath";
import { firstFighterDifference } from "../../../generated/state/fighterDifference";
import { copyFighterState } from "../../../generated/state/fighterState";
import { Phase } from "../../lobby/lobbyState";
import { stepMatch } from "../../match/step";
import { copyReplayState, createReplaySnapshot, type ReplayState } from "../../replay/snapshot";
import { Character } from "../../sim/codes";
import { type Fighter, type Projectile, createFighter } from "../../sim/fighter";
import { type Controls, copyControls, fighterAt, type Roster } from "../../sim/roster";
import type { SpecialProjectile } from "../../sim/specials/schema";
import { duelPair, stepDuel } from "../../sim/testDuel";
import { controls } from "../../sim/testWorld";
import { projectedProjectile } from "../../presentation/projectilePose";
import { FLAME_STRIKE_BURN, FLAME_STRIKE_BURST, FLAME_STRIKE_COLUMN_RATE, FLAME_STRIKE_COLUMN_SECONDS, FLAME_STRIKE_ORB, FLAME_STRIKE_ORB_FRAMES, FLAME_STRIKE_STEER } from "./specials";

const OLD_RUNE_SPAWN_FRAME = 8;
const OLD_RUNE_SPEED = 8.0;
const press = controls({ specialPressed: true, specialX: 1, specialHeld: true });
const hold = controls({ specialHeld: true });
const idle = controls();
const BEHIND = -300.0;

function live(f: Readonly<Fighter>, spec: Readonly<SpecialProjectile>): Readonly<Projectile> | undefined {
  for (const projectile of f.projectiles) if (projectile.life > 0 && projectile.spec === spec) return projectile;
  return undefined;
}

function liveCasts(f: Readonly<Fighter>): number {
  let count = 0;
  for (const spec of [FLAME_STRIKE_ORB, FLAME_STRIKE_BURST, FLAME_STRIKE_BURN]) if (live(f, spec) !== undefined) count++;
  return count;
}

function present(projectile: Readonly<Projectile> | undefined, what: string): Readonly<Projectile> {
  if (projectile === undefined) throw new Error(`no ${what}`);
  return projectile;
}

function kaelDuel(targetX = BEHIND): { kael: Fighter; target: Fighter; world: Roster } {
  const kael = createFighter(Character.kaelthas, 0.0, 1);
  const target = createFighter(Character.rifleman, targetX, -1);
  const { world } = duelPair(kael, target);
  return { kael, target, world };
}

function stepUntil(world: Roster, kael: Readonly<Fighter>, spec: Readonly<SpecialProjectile>, input = idle, second = idle): Readonly<Projectile> {
  for (let frame = 0; frame < 160 && live(kael, spec) === undefined; frame++) stepDuel(world, input, second);
  return present(live(kael, spec), "projectile");
}

function flyOrb(kael: Readonly<Fighter>, world: Roster, heldFrames: number, steer = hold, second = idle): { speeds: number[]; last: { x: number; z: number } } {
  const speeds: number[] = [];
  let last = { x: 0.0, z: 0.0 };
  for (let frame = 0; frame < heldFrames; frame++) {
    stepDuel(world, steer, second);
    const orb = live(kael, FLAME_STRIKE_ORB);
    if (orb === undefined) break;
    speeds.push(Math.abs(orb.velocityX));
    last = { x: orb.x, z: orb.z };
  }
  return { speeds, last };
}

test("Flame Strike's orb leaves Kael's hand on frame 6, a quarter sooner than the rune's frame 8, starts slow and gathers speed to 12 a frame, faster than the rune's 8 [k3 measure docs/design/kaelthas.md]", () => {
  assertLessThan(FLAME_STRIKE_ORB.spawnFrame, OLD_RUNE_SPAWN_FRAME * f32(0.8) + 1.0);
  assertEquals(FLAME_STRIKE_ORB.spawnFrame, 6);
  const { kael, world } = kaelDuel();
  stepDuel(world, press);
  let frames = 1;
  while (live(kael, FLAME_STRIKE_ORB) === undefined) {
    stepDuel(world, hold);
    frames++;
  }
  assertEquals(frames, FLAME_STRIKE_ORB.spawnFrame);
  assertGreaterThan(present(live(kael, FLAME_STRIKE_ORB), "orb").x, kael.motion.x);
  const { speeds } = flyOrb(kael, world, 40);
  assertLessThan(speeds[0] ?? 99.0, OLD_RUNE_SPEED);
  for (let i = 1; i < speeds.length; i++) assertTrue((speeds[i] ?? 0.0) >= (speeds[i - 1] ?? 0.0));
  assertEquals(speeds[speeds.length - 1], FLAME_STRIKE_STEER.maxSpeed);
  assertGreaterThan(FLAME_STRIKE_STEER.maxSpeed, OLD_RUNE_SPEED);
});

function steersUpAndDown(): void {
  const climb = (z: number): number => {
    const { kael, world } = kaelDuel();
    stepDuel(world, press);
    stepUntil(world, kael, FLAME_STRIKE_ORB, hold);
    const startZ = present(live(kael, FLAME_STRIKE_ORB), "orb").z;
    const { last } = flyOrb(kael, world, 10, controls({ specialHeld: true, verticalDirection: z }));
    return f32(last.z - startZ);
  };
  assertGreaterThan(climb(1), 20.0);
  assertLessThan(climb(-1), -20.0);
  assertEquals(climb(0), 0.0);
}

function eruptsOnReleaseAndTimeout(): void {
  const released = kaelDuel();
  stepDuel(released.world, press);
  stepUntil(released.world, released.kael, FLAME_STRIKE_ORB, hold);
  const { last } = flyOrb(released.kael, released.world, 12);
  stepDuel(released.world, idle);
  assertEquals(live(released.kael, FLAME_STRIKE_ORB), undefined, "the orb is gone");
  const pillar = present(live(released.kael, FLAME_STRIKE_BURST), "pillar");
  assertEquals(pillar.x, last.x);
  assertEquals(pillar.z, last.z);

  const timed = kaelDuel();
  stepDuel(timed.world, press);
  stepUntil(timed.world, timed.kael, FLAME_STRIKE_ORB, hold);
  let flown = 0;
  while (live(timed.kael, FLAME_STRIKE_BURST) === undefined && flown < 200) {
    stepDuel(timed.world, hold);
    flown++;
  }
  assertTrue(flown >= FLAME_STRIKE_ORB_FRAMES - 3 && flown <= FLAME_STRIKE_ORB_FRAMES + 1);
  assertEquals(live(timed.kael, FLAME_STRIKE_ORB), undefined);
}

function eruptsOnContactAndRecasts(): void {
  const { kael, target, world } = kaelDuel(260.0);
  stepDuel(world, press);
  let frames = 0;
  while (target.status.damage === 0.0 && frames++ < 80) stepDuel(world, hold);
  assertGreaterThan(target.status.damage, 0.0);
  assertEquals(live(kael, FLAME_STRIKE_ORB), undefined);
  stepUntil(world, kael, FLAME_STRIKE_BURN);
  while (kael.special.action !== 0) stepDuel(world, idle);
  assertTrue(live(kael, FLAME_STRIKE_BURN) !== undefined);
  stepDuel(world, press);
  stepDuel(world, idle);
  assertEquals(live(kael, FLAME_STRIKE_BURN), undefined, "the recast put out the first pillar");
  for (let frame = 0; frame < 120; frame++) {
    assertTrue(liveCasts(kael) <= 1);
    stepDuel(world, frame < 20 ? hold : idle);
  }
}

function eruptsOnTheFloor(): void {
  const { kael, world } = kaelDuel();
  stepDuel(world, press);
  stepUntil(world, kael, FLAME_STRIKE_ORB, hold);
  const down = controls({ specialHeld: true, verticalDirection: -1 });
  let pillar: Readonly<Projectile> | undefined;
  for (let frame = 0; frame < 40 && pillar === undefined; frame++) {
    stepDuel(world, down);
    pillar = live(kael, FLAME_STRIKE_BURST);
  }
  assertTrue(pillar !== undefined);
  assertEquals(live(kael, FLAME_STRIKE_ORB), undefined);
  assertLessThan(present(pillar, "pillar").z, FLAME_STRIKE_ORB.offsetZ);
}

test("The lingering burn deals damage without hitstun, hitlag or launch [k1 scenario]", () => {
  const { kael, target, world } = kaelDuel();
  stepDuel(world, press);
  stepUntil(world, kael, FLAME_STRIKE_ORB, hold);
  stepDuel(world, idle);
  const burn = stepUntil(world, kael, FLAME_STRIKE_BURN);
  target.motion.x = burn.x;
  const before = target.status.damage;
  let ticks = 0;
  for (let frame = 0; frame < FLAME_STRIKE_BURN.life; frame++) {
    const damage = target.status.damage;
    stepDuel(world, idle);
    if (target.status.damage > damage) ticks++;
    assertEquals(target.launch.hitstun, 0, "no hitstun");
    assertEquals(target.launch.hitlag, 0, "no hitlag");
    assertTrue(target.motion.grounded);
  }
  assertTrue(ticks >= 2);
  assertTrue(target.status.damage > before);
});

test("The burst launches a foe up at its 80° and crushes a shield, where a burn tick neither launches nor dents the shield [k1 scenario]", () => {
  const hit = (into: Readonly<SpecialProjectile>, shield: boolean): { knockbackX: number; knockbackZ: number; shieldLoss: number } => {
    const { kael, target, world } = kaelDuel();
    const guard = controls({ shield });
    stepDuel(world, press, guard);
    stepUntil(world, kael, FLAME_STRIKE_ORB, hold, guard);
    const orbX = flyOrb(kael, world, 4, hold, guard).last.x;
    if (into === FLAME_STRIKE_BURST) target.motion.x = orbX;
    else target.motion.x = stepUntil(world, kael, FLAME_STRIKE_BURN, idle, guard).x;
    let knockbackX = 0.0;
    let knockbackZ = 0.0;
    let shieldLoss = 0.0;
    for (let frame = 0; frame < 60; frame++) {
      const energy = target.shield.energy;
      stepDuel(world, idle, guard);
      shieldLoss = Math.max(shieldLoss, f32(energy - target.shield.energy));
      if (knockbackZ === 0.0) {
        knockbackX = target.launch.knockbackX;
        knockbackZ = target.launch.knockbackZ;
      }
    }
    return { knockbackX, knockbackZ, shieldLoss };
  };
  const burst = hit(FLAME_STRIKE_BURST, false);
  assertTrue(burst.knockbackX > 0.0);
  assertTrue(burst.knockbackZ > f32(burst.knockbackX * 5.0) && burst.knockbackZ < f32(burst.knockbackX * 6.5));
  const crushed = hit(FLAME_STRIKE_BURST, true).shieldLoss;
  assertGreaterThan(crushed, 5.0);
  assertFalse(hit(FLAME_STRIKE_BURN, false).knockbackZ > 0.0);
});

test("The pillar bursts for 6 frames and burns out 30 later, and its column model plays its whole fade across exactly those frames [k3 measure docs/design/kaelthas.md]", () => {
  const { kael, world } = kaelDuel();
  stepDuel(world, press);
  stepUntil(world, kael, FLAME_STRIKE_ORB, hold);
  stepDuel(world, idle);
  let burstFrames = 0;
  let burnFrames = 0;
  const seconds: number[] = [];
  for (let frame = 0; frame < 160 && (live(kael, FLAME_STRIKE_BURST) !== undefined || live(kael, FLAME_STRIKE_BURN) !== undefined); frame++) {
    for (const spec of [FLAME_STRIKE_BURST, FLAME_STRIKE_BURN]) {
      const projectile = live(kael, spec);
      if (projectile === undefined) continue;
      if (spec === FLAME_STRIKE_BURST) burstFrames++; else burnFrames++;
      seconds.push(projectedProjectile(kael, kael.projectiles.indexOf(projectile), true).animationSeconds ?? -1);
    }
    stepDuel(world, idle);
  }
  assertEquals(burstFrames, 6, "the burst hits for 6 frames");
  assertEquals(burnFrames, 30, "the burn lingers 30 frames, so the pillar's active window is 36 frames, 0.6 s");
  assertEquals(seconds.length, burstFrames + burnFrames);
  assertEquals(seconds[0], f32(FLAME_STRIKE_COLUMN_SECONDS.from), "the column starts at its fade-in");
  for (let i = 1; i < seconds.length; i++) assertTrue(seconds[i]! > seconds[i - 1]!);
  const span = f32(FLAME_STRIKE_COLUMN_RATE * (burstFrames + burnFrames) / 60);
  assertTrue(Math.abs(span - (FLAME_STRIKE_COLUMN_SECONDS.to - FLAME_STRIKE_COLUMN_SECONDS.from)) < f32(0.001));
  const last = seconds[seconds.length - 1]!;
  assertTrue(last > f32(4.9) && last <= FLAME_STRIKE_COLUMN_SECONDS.to);
});

test("The stick steers the orb up or down, and release, the timeout, a touch and the floor each erupt the pillar where the orb is, one pillar at a time [k1 scenario]", () => {
  steersUpAndDown();
  eruptsOnReleaseAndTimeout();
  eruptsOnContactAndRecasts();
  eruptsOnTheFloor();
});

function replayState(): ReplayState {
  const state = createReplaySnapshot();
  copyFighterState(fighterAt(state.world, 0), createFighter(Character.kaelthas, -400.0, 1), 3);
  copyFighterState(fighterAt(state.world, 1), createFighter(Character.warden, 900.0, -1), 3);
  state.match.phase = Phase.match;
  state.match.stageChoice = 0;
  state.match.matchSeed = 360;
  state.match.hazards = false;
  state.match.items.on = false;
  state.match.timeLimitMinutes = 0;
  state.match.ultimatesOff = true;
  return state;
}

test("Flame Strike: a rollback mid-flight replays the steered orb and its eruption exactly [k1 scenario]", () => {
  const state = replayState();
  let tick = 0;
  const step = (first: Readonly<Controls>): void => {
    tick++;
    copyControls(state.controls.inputs[0], first);
    copyControls(state.controls.inputs[1], controls());
    stepMatch(state.match, state.world, state.controls, tick);
  };
  for (let frame = 0; frame < 3; frame++) step(controls());
  step(press);
  for (let frame = 0; frame < 10; frame++) step(hold);
  const saved = createReplaySnapshot();
  copyReplayState(saved, state);
  const savedTick = tick;
  const path = (frame: number): Controls => controls({ specialHeld: frame < 36, verticalDirection: imod(frame, 16) < 8 ? 1 : -1 });
  for (let frame = 0; frame < 50; frame++) step(path(frame));
  const expected = createReplaySnapshot();
  copyReplayState(expected, state);
  for (let frame = 0; frame < 20; frame++) step(controls({ verticalDirection: -1 }));
  copyReplayState(state, saved);
  tick = savedTick;
  for (let frame = 0; frame < 50; frame++) step(path(frame));
  const mask = state.world.mask;
  assertEquals(firstFighterDifference(fighterAt(expected.world, 0), fighterAt(state.world, 0), mask, mask), undefined);
  assertEquals(firstFighterDifference(fighterAt(expected.world, 1), fighterAt(state.world, 1), mask, mask), undefined);
  assertTrue(fighterAt(state.world, 0).projectiles.some(projectile => projectile.life > 0 && projectile.spec !== FLAME_STRIKE_ORB));
});
