import { assertEquals, assertFalse, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { floorMod } from "wisp/src/sim/intMath";
import { CARRY_THROW_GAP, produceComputerInput } from "../../match/botPlay";
import { createBufferedFrameControls, createFrameControls } from "../../match/controls";
import { createPacingAndPresentation } from "../../match/pacingAndPresentation";
import { stepMatch } from "../../match/step";
import { Phase, createMatchState } from "../../lobby/lobbyState";
import { grabVoice } from "../../presentation/moveSounds";
import { presentImpactSounds } from "../../presentation/hitPresentation";
import { captureImpactEventsBefore, createImpactEvents, finishImpactEventsAfter } from "../../presentation/impactEvents";
import { captureReplaySnapshot, createReplaySnapshot, restoreReplaySnapshot } from "../../replay/snapshot";
import { AttackStyle, Character, GrabAction } from "../../sim/codes";
import { type Fighter, createFighter } from "../../sim/fighter";
import { applyAttackHit } from "../../sim/hits";
import { type Controls, type Roster, copyControls, createRoster } from "../../sim/roster";
import { duelPair, stepDuel } from "../../sim/testDuel";
import { mainDeckLeft, mainDeckRight } from "../../sim/stage";
import { contactBatch, controls, hitEffect, testBeginAttacks } from "../../sim/testWorld";
import { copyFighterState } from "../../../generated/state/fighterState";
import { firstFighterDifference } from "../../../generated/state/fighterDifference";
import { PEON_MOVES } from "./moves";

const GAP = 40.0;
const CARRY = PEON_MOVES.carry!;
const idle = controls();
const mashing = (frame: number) => controls({ grabMashPressed: true, direction: floorMod(frame, 2) === 0 ? 1 : -1 });

interface Carry { readonly world: Roster; readonly peon: Fighter; readonly target: Fighter; readonly hoistFrames: number }

function carry(world: Roster, peon: Fighter, target: Fighter): Carry {
  testBeginAttacks(world, AttackStyle.grab, undefined);
  let hoistFrames = 0;
  for (let frame = 0; frame < 60 && peon.grab.action !== GrabAction.carry; frame++) {
    stepDuel(world);
    if (peon.grab.action === GrabAction.hoist) hoistFrames++;
  }
  return { world, peon, target, hoistFrames };
}

function carryDuel(): Carry {
  const { world, owner, target } = duelPair(createFighter(Character.peon, 0.0, 1), createFighter(Character.rifleman, GAP, -1));
  return carry(world, owner, target);
}

function onShoulder(peon: Fighter, target: Fighter): boolean {
  return target.motion.x === f32(peon.motion.x + f32(peon.facing * CARRY.shoulderX)) && target.motion.z === f32(peon.motion.z + CARRY.shoulderZ);
}

function release(run: Carry, peonInput: Readonly<Controls>, targetInput: (frame: number) => Readonly<Controls> = () => idle): number {
  let frame = 0;
  while (run.target.grab.owner !== undefined && frame < 600) stepDuel(run.world, frame === 0 ? peonInput : idle, targetInput(frame++));
  return frame;
}

test("Peon's grab hoists the caught fighter over his authored hoist frames into a carry, the fighter riding on his shoulder [k1 scenario]", () => {
  const { peon, target, hoistFrames } = carryDuel();
  assertEquals(peon.grab.action, GrabAction.carry);
  assertEquals(hoistFrames, CARRY.hoistFrames);
  assertEquals(target.grab.owner, 0);
  assertTrue(onShoulder(peon, target));
});

test("Carrying, Peon walks both ways no faster than his carry walk with the fighter on his shoulder, and a shield or special starts nothing [k1 scenario]", () => {
  const { world, peon, target } = carryDuel();
  const speed = f32(peon.tuning.physics.walkSpeed * CARRY.walkScale);
  assertLessThan(speed, peon.tuning.physics.walkSpeed);
  const startX = peon.motion.x;
  for (let frame = 0; frame < 20; frame++) {
    stepDuel(world, controls({ direction: 1 }));
    assertLessThan(peon.motion.vx, f32(speed + f32(0.001)));
  }
  assertEquals(peon.motion.vx, speed);
  assertGreaterThan(peon.motion.x, f32(startX + f32(10 * speed)));
  assertTrue(onShoulder(peon, target));
  stepDuel(world, controls({ direction: -1 }));
  assertEquals(peon.facing, -1);
  assertTrue(onShoulder(peon, target));
  for (const input of [controls({ shield: true, shieldPressed: true, shieldStrength: 1.0 }), controls({ specialPressed: true })]) {
    for (let frame = 0; frame < 4; frame++) stepDuel(world, input);
    assertTrue(peon.motion.grounded);
    assertFalse(peon.shield.raised);
    assertEquals(peon.attack.style, undefined);
    assertEquals(peon.grab.action, GrabAction.carry);
  }
});

const CARGO_THROWS = [
  [controls({ cStickSideFlick: 1 }), GrabAction.throwForward],
  [controls({ attackPressed: true, direction: -1 }), GrabAction.throwBack],
  [controls({ cStickUpFlick: true }), GrabAction.throwUp],
  [controls({ attackPressed: true, verticalDirection: -1 }), GrabAction.throwDown],
] as const;

test("Each cargo throw from the carry launches the fighter along its own authored angle, relative to Peon's facing, with its authored damage [k1 scenario]", () => {
  for (const [input, action] of CARGO_THROWS) {
    const run = carryDuel();
    const damage = run.target.status.damage;
    stepDuel(run.world, input);
    assertEquals(run.peon.grab.action, action);
    assertEquals(run.peon.facing, 1);
    release(run, idle);
    const effect = PEON_MOVES.throws[action]!.effect;
    const x = f32(run.peon.facing * run.target.launch.knockbackX);
    const z = run.target.launch.knockbackZ;
    const length = f32(Math.abs(x) + Math.abs(z));
    assertGreaterThan(length, 0.0);
    assertLessThan(Math.abs(f32(f32(x * effect.launchZ) - f32(z * effect.launchX))), f32(length * f32(0.01)));
    assertGreaterThan(f32(f32(x * effect.launchX) + f32(z * effect.launchZ)), 0.0);
    assertEquals(run.target.status.damage, f32(damage + effect.damage));
  }
});

test("Carrying, Peon jumps lower than his own jump with the fighter kept on his shoulder, and a throw pressed in the air comes out on landing [k1 scenario]", () => {
  const apex = (run: Carry | undefined, world: Roster, peon: Fighter): { readonly height: number; readonly carried: boolean; readonly thrown: number } => {
    const floor = peon.motion.z;
    let height = 0.0;
    let carried = true;
    let thrown = -1;
    for (let frame = 0; frame < 90; frame++) {
      const input = frame === 0 ? controls({ jumpPressed: true, jumpHeld: true }) : frame < 10 ? controls({ jumpHeld: true }) : frame === 20 ? controls({ cStickUpFlick: true }) : idle;
      stepDuel(world, input);
      height = Math.max(height, f32(peon.motion.z - floor));
      if (run === undefined) continue;
      if (!peon.motion.grounded) carried = carried && peon.grab.action === GrabAction.carry && onShoulder(peon, run.target);
      if (thrown < 0 && peon.grab.action === GrabAction.throwUp) {
        thrown = frame;
        assertTrue(peon.motion.grounded);
      }
    }
    return { height, carried, thrown };
  };
  const plain = duelPair(createFighter(Character.peon, 0.0, 1), createFighter(Character.rifleman, -400.0, -1));
  const normal = apex(undefined, plain.world, plain.owner);
  const { world, owner, target } = duelPair(createFighter(Character.peon, 0.0, 1), createFighter(Character.rifleman, GAP, -1));
  target.status.damage = 150.0;
  const run = carry(world, owner, target);
  const carried = apex(run, world, owner);
  assertGreaterThan(carried.height, 0.0);
  assertLessThan(carried.height, normal.height);
  assertTrue(carried.carried);
  assertGreaterThan(carried.thrown, 20);
});

test("A computer Peon walks the carry to within its throw gap of the nearer ledge, then throws the fighter off that side [k1 scenario]", () => {
  for (const start of [f32(mainDeckLeft(0) + 220.0), f32(mainDeckRight(0) - 220.0)]) {
    const match = createMatchState();
    match.phase = Phase.match;
    match.cpuOpponents[0] = "rook";
    match.cpuResolvedOpponents[0] = "rook";
    match.cpuTiers[0] = "expert";
    const side = start > 0.0 ? 1 : -1;
    const peon = createFighter(Character.peon, start, -side);
    const target = createFighter(Character.rifleman, f32(start - f32(side * GAP)), side);
    target.status.damage = 150.0;
    const world = createRoster(3, [peon, target]);
    for (let frame = 0; frame < 3; frame++) stepDuel(world);
    carry(world, peon, target);
    assertEquals(peon.grab.action, GrabAction.carry);
    const runtime = createPacingAndPresentation();
    const produced = createFrameControls();
    const ledge = side > 0 ? mainDeckRight(0) : mainDeckLeft(0);
    let gapAtThrow = -1.0;
    for (let frame = 1; frame < 240 && target.grab.owner !== undefined; frame++) {
      produceComputerInput(match, world, runtime, 0, frame, produced.inputs[0], produced.commands[0]);
      stepDuel(world, produced.inputs[0]);
      const throwing = peon.grab.action >= GrabAction.throwForward && peon.grab.action <= GrabAction.throwDown;
      if (throwing && gapAtThrow < 0.0) gapAtThrow = f32(side * f32(ledge - peon.motion.x));
    }
    assertGreaterThan(gapAtThrow, 0.0);
    assertLessThan(gapAtThrow, f32(CARRY_THROW_GAP + f32(peon.tuning.physics.walkSpeed * CARRY.walkScale)));
    for (let frame = 0; frame < 20; frame++) stepDuel(world);
    assertGreaterThan(f32(side * f32(target.motion.x - peon.motion.x)), 0.0);
  }
});

test("A carried fighter that mashes breaks out before an idle one, and a carry left to time out drops the fighter as a grab release [k1 scenario]", () => {
  const mashed = carryDuel();
  const mashedFrames = release(mashed, idle, mashing);
  const timed = carryDuel();
  const idleFrames = release(timed, idle);
  assertLessThan(mashedFrames, idleFrames);
  for (const run of [mashed, timed]) {
    assertEquals(run.peon.grab.action, GrabAction.escape);
    assertEquals(run.peon.grab.target, undefined);
    assertGreaterThan(run.target.launch.hitstun, 0);
  }
});

test("A hit on Peon while he carries drops the carried fighter [k1 scenario]", () => {
  const peon = createFighter(Character.peon, 0.0, 1);
  const target = createFighter(Character.rifleman, GAP, -1);
  const world = createRoster(3, [peon, target, createFighter(Character.rifleman, -60.0, 1)]);
  for (let frame = 0; frame < 3; frame++) stepDuel(world);
  const run = carry(world, peon, target);
  assertEquals(run.peon.grab.action, GrabAction.carry);
  contactBatch(world, () => applyAttackHit(world, 2, 0, AttackStyle.forwardTilt, 1, hitEffect(10.0, 100.0, 30.0, f32(0.7), f32(0.7)), true, false));
  for (let frame = 0; frame < 3; frame++) stepDuel(world);
  assertEquals(peon.grab.target, undefined);
  assertEquals(target.grab.owner, undefined);
  assertGreaterThan(peon.launch.hitstun, 0);
});

test("A rollback taken mid-hoist restores the hoist, and replaying the same inputs walks, carries and throws to the identical state [k1 scenario]", () => {
  const game = createMatchState();
  game.phase = Phase.match;
  const peon = createFighter(Character.peon, 0.0, 1);
  const target = createFighter(Character.rifleman, GAP, -1);
  const world = createRoster(3, [peon, target]);
  const frameControls = createBufferedFrameControls();
  const runtime = createPacingAndPresentation();
  let frame = 0;
  const step = (input: Readonly<Controls>, held: Readonly<Controls>) => {
    frame++;
    copyControls(frameControls.inputs[0], input);
    copyControls(frameControls.inputs[1], held);
    stepMatch(game, world, frameControls, frame);
  };
  for (let i = 0; i < 3; i++) step(idle, idle);
  testBeginAttacks(world, AttackStyle.grab, undefined);
  while (peon.grab.action !== GrabAction.hoist && frame < 60) step(idle, idle);
  for (let i = 0; i < 4; i++) step(idle, idle);
  const snapshot = createReplaySnapshot();
  captureReplaySnapshot(snapshot, world, game, frameControls, runtime);
  const savedFrame = frame;
  const hoistFrame = peon.grab.frame;
  const script = (index: number): Controls => index < 20 ? controls({ direction: 1 }) : index < 26 ? controls({ direction: -1 }) : index === 26 ? controls({ cStickSideFlick: -1 }) : idle;
  const heldScript = (index: number): Controls => floorMod(index, 3) === 0 ? mashing(index) : idle;
  let sawCarry = false;
  for (let i = 0; i < 70; i++) {
    step(script(i), heldScript(i));
    sawCarry ||= peon.grab.action === GrabAction.carry && peon.motion.vx !== 0.0;
  }
  assertTrue(sawCarry);
  assertEquals(target.grab.owner, undefined);
  const expected = [createFighter(Character.peon, 0.0, 1), createFighter(Character.rifleman, 0.0, -1)];
  copyFighterState(expected[0]!, peon, world.mask);
  copyFighterState(expected[1]!, target, world.mask);
  restoreReplaySnapshot(snapshot, world, game, frameControls, runtime);
  frame = savedFrame;
  assertEquals(peon.grab.action, GrabAction.hoist);
  assertEquals(peon.grab.frame, hoistFrame);
  assertEquals(target.grab.owner, 0);
  for (let i = 0; i < 70; i++) step(script(i), heldScript(i));
  assertEquals(firstFighterDifference(expected[0]!, peon, world.mask, world.mask), undefined);
  assertEquals(firstFighterDifference(expected[1]!, target, world.mask, world.mask), undefined);
});

test("Peon says his Work, work line exactly once for a grab carried and thrown, and a fighter without a grab voice says nothing [k1 scenario]", () => {
  for (const character of [Character.peon, Character.rifleman]) {
    const { world, owner, target } = duelPair(createFighter(character, 0.0, 1), createFighter(Character.rifleman, GAP, -1));
    const events = createImpactEvents();
    const voice = grabVoice(Character.peon)!;
    let spoken = 0;
    let caught = false;
    const sink = (sound: string) => { if (sound === voice) spoken++; };
    testBeginAttacks(world, AttackStyle.grab, undefined);
    for (let frame = 0; frame < 120; frame++) {
      captureImpactEventsBefore(events, owner);
      stepDuel(world, frame === 40 ? controls({ cStickSideFlick: 1, grabThrowX: 1 }) : idle);
      finishImpactEventsAfter(events, owner, world);
      presentImpactSounds(events, sink);
    }
    assertEquals(target.grab.owner, undefined);
    assertEquals(spoken, character === Character.peon ? 1 : 0);
  }
});
