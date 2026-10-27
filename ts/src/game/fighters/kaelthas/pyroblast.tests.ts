import { assertEquals, assertFalse, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { imod } from "wisp/src/sim/intMath";
import { firstFighterDifference } from "../../../generated/state/fighterDifference";
import { copyFighterState } from "../../../generated/state/fighterState";
import { Phase } from "../../lobby/lobbyState";
import { stepMatch } from "../../match/step";
import { copyReplayState, createReplaySnapshot, type ReplayState } from "../../replay/snapshot";
import { AttackStyle, Character, SpecialAction } from "../../sim/codes";
import { clearDamageContacts, finishDamageContacts } from "../../sim/contacts";
import { createFighter, type Fighter, type Projectile } from "../../sim/fighter";
import { applyAttackHit } from "../../sim/hits";
import { stageBounds } from "../../sim/stageBounds";
import { type Controls, copyControls, fighterAt } from "../../sim/roster";
import { controls } from "../../sim/testWorld";
import { kaelHit } from "./moves";
import { PYROBLAST, PYROBLAST_COAST_FRAMES, PYROBLAST_HIT_RECOVERY, PYROBLAST_MISS_RECOVERY, PYROBLAST_SPEED, PYROBLAST_STARTUP_FRAMES, PYROBLAST_STEER, PYROBLAST_STEER_FRAMES } from "./specials";

const KAEL_X = -400.0;
const FAR_FOE_X = 900.0;
const TURN_COS = f32(0.994);

interface Bout {
  readonly state: ReplayState;
  readonly kael: Fighter;
  readonly foe: Fighter;
  tick: number;
}

function bout(foeX = FAR_FOE_X, foe: Character = Character.warden): Bout {
  const state = createReplaySnapshot();
  const kael = fighterAt(state.world, 0);
  copyFighterState(kael, createFighter(Character.kaelthas, KAEL_X, 1), 3);
  copyFighterState(fighterAt(state.world, 1), createFighter(foe, foeX, -1), 3);
  state.match.phase = Phase.match;
  state.match.stageChoice = 0;
  state.match.matchSeed = 360;
  state.match.hazards = false;
  state.match.items.on = false;
  state.match.timeLimitMinutes = 0;
  state.match.ultimatesOff = true;
  const b: Bout = { state, kael, foe: fighterAt(state.world, 1), tick: 0 };
  for (let frame = 0; frame < 3; frame++) step(b);
  return b;
}

function step(b: Bout, first: Readonly<Controls> = controls(), second: Readonly<Controls> = controls()): void {
  b.tick++;
  copyControls(b.state.controls.inputs[0], first);
  copyControls(b.state.controls.inputs[1], second);
  stepMatch(b.state.match, b.state.world, b.state.controls, b.tick);
}

const cast = (): Controls => controls({ specialPressed: true });
const stick = (x: number, z: number): Controls => controls({ direction: x, verticalDirection: z });

function ball(kael: Readonly<Fighter>): Readonly<Projectile> | undefined {
  for (const projectile of kael.projectiles) if (projectile.life > 0 && projectile.spec === PYROBLAST) return projectile;
  return undefined;
}

function liveBalls(kael: Readonly<Fighter>): number {
  let count = 0;
  for (const projectile of kael.projectiles) if (projectile.life > 0 && projectile.spec === PYROBLAST) count++;
  return count;
}

function castAndSpawn(b: Bout): void {
  step(b, cast());
  while (ball(b.kael) === undefined && b.tick < 60) step(b);
}

function strikeKael(b: Bout): void {
  clearDamageContacts();
  applyAttackHit(b.state.world, 1, 0, AttackStyle.jab, 1, kaelHit(4.0, 45, 30.0, 30.0), true, false);
  finishDamageContacts(b.state.world);
}

test("Pyroblast: the ball appears ahead of his hands only on the startup frame, after a readable windup, on the ground and in the air [k3 measure docs/design/kaelthas.md]", () => {
  for (const air of [false, true]) {
    const b = bout();
    if (air) {
      b.kael.motion.grounded = false;
      b.kael.motion.surface = undefined;
      b.kael.motion.z = 400.0;
    }
    step(b, cast());
    assertEquals(b.kael.special.action, SpecialAction.heroNeutral);
    let frames = 1;
    while (ball(b.kael) === undefined) {
      assertLessThan(frames, PYROBLAST_STARTUP_FRAMES);
      step(b);
      frames++;
    }
    assertEquals(frames, PYROBLAST_STARTUP_FRAMES);
    const shot = ball(b.kael);
    assertTrue(shot !== undefined && f32(shot.x - b.kael.motion.x) > 0.0);
    assertEquals(shot?.velocityX, PYROBLAST_SPEED);
  }
});

test("Pyroblast: holding the stick turns the ball a few degrees a frame toward it, and a neutral stick keeps it level [k3 measure docs/design/kaelthas.md]", () => {
  const level = bout();
  castAndSpawn(level);
  for (let frame = 0; frame < 30; frame++) {
    step(level);
    assertEquals(ball(level.kael)?.velocityZ, 0.0);
    assertEquals(ball(level.kael)?.velocityX, PYROBLAST_SPEED);
  }
  const steered = bout();
  castAndSpawn(steered);
  let headingX = 1.0;
  let headingZ = 0.0;
  let turning = 0;
  while (headingX > -f32(0.99) && turning < PYROBLAST_STEER_FRAMES) {
    step(steered, stick(-1, 0));
    const shot = ball(steered.kael);
    assertTrue(shot !== undefined);
    if (shot === undefined) return;
    const x = f32(shot.velocityX / PYROBLAST_SPEED);
    const z = f32(shot.velocityZ / PYROBLAST_SPEED);
    assertGreaterThan(f32(f32(headingX * x) + f32(headingZ * z)), TURN_COS);
    assertLessThan(x, headingX);
    headingX = x;
    headingZ = z;
    turning++;
  }
  assertGreaterThan(turning, 25);
  assertLessThan(turning, 35);
  assertEquals(ball(steered.kael)?.direction, -1, "a ball turned back launches the other way");
});

test("Pyroblast: he stays rooted while he steers, standing on the ground and sinking slowly in the air [k1 scenario]", () => {
  const ground = bout();
  castAndSpawn(ground);
  const x = ground.kael.motion.x;
  for (let frame = 0; frame < 40; frame++) {
    step(ground, stick(1, imod(frame, 2) === 0 ? 1 : -1));
    assertEquals(ground.kael.motion.x, x);
    assertTrue(ground.kael.motion.grounded);
    assertEquals(ground.kael.special.action, SpecialAction.heroNeutral);
  }
  const air = bout();
  air.kael.motion.grounded = false;
  air.kael.motion.surface = undefined;
  air.kael.motion.z = 600.0;
  air.kael.motion.vx = 4.0;
  castAndSpawn(air);
  step(air, stick(1, 0));
  const airX = air.kael.motion.x;
  const start = air.kael.motion.z;
  for (let frame = 0; frame < 40; frame++) {
    const before = air.kael.motion.z;
    step(air, stick(1, 0));
    assertEquals(air.kael.motion.x, airX);
    assertLessThan(f32(before - air.kael.motion.z), f32(PYROBLAST_STEER.fallSpeed + 0.5));
  }
  assertGreaterThan(f32(start - air.kael.motion.z), 10.0);
  assertLessThan(f32(start - air.kael.motion.z), 80.0);
});

test("Pyroblast: a hit on Kael while he steers puts the ball out at once [k1 scenario]", () => {
  const b = bout();
  castAndSpawn(b);
  for (let frame = 0; frame < 10; frame++) step(b);
  assertEquals(liveBalls(b.kael), 1);
  strikeKael(b);
  assertEquals(liveBalls(b.kael), 0);
  assertEquals(b.kael.special.action, SpecialAction.none);
});

test("Pyroblast: one ball at a time; special mashed through the cast lets it go and never casts a second [k1 scenario]", () => {
  const b = bout();
  let casts = 0;
  let firstBallFrames = 0;
  for (let frame = 0; frame < 200; frame++) {
    const before = b.kael.special.action;
    step(b, cast());
    if (before === SpecialAction.none && b.kael.special.action === SpecialAction.heroNeutral) casts++;
    assertTrue(liveBalls(b.kael) <= 1);
    if (casts === 1 && ball(b.kael) !== undefined) firstBallFrames++;
  }
  assertGreaterThan(casts, 1);
  assertLessThan(firstBallFrames, PYROBLAST_COAST_FRAMES + 3);
});

test("Pyroblast: struck squarely it deals 17 percent and launches the foe away hard, and Kael recovers quickly [k3 measure docs/design/kaelthas.md]", () => {
  const b = bout(KAEL_X + 300.0);
  castAndSpawn(b);
  let frames = 0;
  while (b.foe.status.damage === 0.0 && frames < PYROBLAST_STEER_FRAMES) {
    step(b);
    frames++;
  }
  assertEquals(b.foe.status.damage, 17.0);
  assertGreaterThan(b.foe.launch.hitstun, 20);
  assertEquals(liveBalls(b.kael), 0);
  let recovery = 0;
  while (b.kael.special.action !== SpecialAction.none) {
    step(b);
    recovery++;
  }
  assertLessThan(recovery, PYROBLAST_HIT_RECOVERY + 4);
  for (let frame = 0; frame < 20; frame++) step(b);
  assertGreaterThan(b.foe.motion.x, KAEL_X + 360.0);
});

test("Pyroblast: a shield takes the full 17 and drains far more than a light shot [k3 measure docs/design/kaelthas.md]", () => {
  const b = bout(KAEL_X + 300.0);
  const raise = controls({ shield: true });
  step(b, controls(), controls({ shield: true, shieldPressed: true }));
  step(b, cast(), raise);
  while (ball(b.kael) === undefined) step(b, controls(), raise);
  const energy = b.foe.shield.energy;
  let frames = 0;
  while (ball(b.kael) !== undefined && frames < PYROBLAST_STEER_FRAMES) {
    step(b, controls(), raise);
    frames++;
  }
  assertTrue(b.foe.shield.raised);
  assertGreaterThan(f32(energy - b.foe.shield.energy), 15.0);
  assertEquals(b.foe.status.damage, 0.0);
});

test("Pyroblast: a miss, let go early with shield or timed out, leaves him unable to act for the long end lag [k3 measure docs/design/kaelthas.md]", () => {
  const released = bout();
  castAndSpawn(released);
  for (let frame = 0; frame < 5; frame++) step(released);
  step(released, controls({ shield: true, shieldPressed: true }));
  assertEquals(ball(released.kael)?.life, PYROBLAST_COAST_FRAMES - 1, "the release leaves only the coast");
  let coast = 0;
  while (ball(released.kael) !== undefined) {
    step(released);
    coast++;
    assertEquals(released.kael.special.action, SpecialAction.heroNeutral);
  }
  assertEquals(coast, PYROBLAST_COAST_FRAMES - 1);
  let lag = 0;
  while (released.kael.special.action !== SpecialAction.none) {
    step(released, controls({ attackRequested: true, jumpPressed: true }));
    lag++;
  }
  assertGreaterThan(lag, PYROBLAST_MISS_RECOVERY - 3);
  const timed = bout();
  castAndSpawn(timed);
  let held = 0;
  while (ball(timed.kael) !== undefined) {
    step(timed, stick(0, 1));
    held++;
  }
  assertEquals(held, PYROBLAST_STEER_FRAMES + PYROBLAST_COAST_FRAMES - 1);
  assertEquals(timed.kael.special.action, SpecialAction.heroNeutral);
  assertFalse(timed.kael.special.hit);
});

test("Pyroblast: a rollback mid-steer replays the same steered path exactly [k1 scenario]", () => {
  const b = bout();
  castAndSpawn(b);
  for (let frame = 0; frame < 8; frame++) step(b, stick(0, 1));
  const saved = createReplaySnapshot();
  copyReplayState(saved, b.state);
  const savedTick = b.tick;
  const path = (frame: number): Controls => stick(imod(frame, 20) < 10 ? 1 : -1, imod(frame, 7) < 3 ? -1 : 1);
  for (let frame = 0; frame < 30; frame++) step(b, path(frame));
  const expected = createReplaySnapshot();
  copyReplayState(expected, b.state);
  for (let frame = 0; frame < 12; frame++) step(b, stick(-1, -1));
  copyReplayState(b.state, saved);
  b.tick = savedTick;
  for (let frame = 0; frame < 30; frame++) step(b, path(frame));
  const mask = b.state.world.mask;
  assertEquals(firstFighterDifference(fighterAt(expected.world, 0), b.kael, mask, mask), undefined);
  assertEquals(firstFighterDifference(fighterAt(expected.world, 1), b.foe, mask, mask), undefined);
  assertTrue(ball(b.kael) !== undefined && ball(b.kael)?.velocityZ !== 0.0);
});

function sideKo(percent: number): boolean {
  const b = bout(0.0);
  copyFighterState(b.kael, createFighter(Character.kaelthas, -250.0, 1), 3);
  b.foe.status.damage = percent;
  step(b, cast());
  let lastX = b.foe.motion.x;
  for (let frame = 0; frame < 240 && !b.foe.status.out; frame++) {
    lastX = b.foe.motion.x;
    step(b);
  }
  return b.foe.status.out && lastX > stageBounds(0).blast.right - 100.0;
}

test("Pyroblast: from centre stage it kills a Warden off the side at high percent but not at middling percent [k3 measure docs/design/kaelthas.md]", () => {
  assertFalse(sideKo(70));
  assertTrue(sideKo(120));
});
