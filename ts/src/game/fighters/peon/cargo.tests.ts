import { assertEquals, assertFalse, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { floorMod } from "wisp/src/sim/intMath";
import { CARRY_THROW_GAP, produceComputerInput } from "../../match/botPlay";
import { createBufferedFrameControls, createFrameControls } from "../../match/controls";
import { captureFrame, createMatchFrameInput, executeMatchFrame } from "../../match/frameInput";
import { clipFor } from "../../presentation/fighterClips";
import { originalClipNamed } from "../../../generated/clips/fighterOriginalClipInfo";
import { peonLook } from "./look";
import { createPacingAndPresentation } from "../../match/pacingAndPresentation";
import { stepMatch } from "../../match/step";
import { Phase, createMatchState } from "../../lobby/lobbyState";
import { hoistVoice } from "../../presentation/moveSounds";
import { presentFighterSounds } from "../../presentation/hitPresentation";
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
import { MASH_FRAMES } from "../../sim/mash";
import { PEON_MOVES } from "./moves";

const GAP = 40.0;
const CARRY = PEON_MOVES.carry!;
const idle = controls();
const mashing = (frame: number) => controls({ grabMashPressed: true, direction: floorMod(frame, 2) === 0 ? 1 : -1 });

interface Carry { readonly world: Roster; readonly peon: Fighter; readonly target: Fighter; readonly hoistFrames: number }

const forwardThrow = (peon: Readonly<Fighter>): Controls => controls({ grabThrowX: peon.facing });

function hold(world: Roster, peon: Fighter): number {
  testBeginAttacks(world, AttackStyle.grab, undefined);
  let frames = 0;
  for (let frame = 0; frame < 60 && peon.grab.action !== GrabAction.hold; frame++) stepDuel(world);
  for (; frames < 10 && peon.grab.action === GrabAction.hold; frames++) stepDuel(world);
  return frames;
}

function carry(world: Roster, peon: Fighter, target: Fighter): Carry {
  hold(world, peon);
  stepDuel(world, forwardThrow(peon));
  let hoistFrames = peon.grab.action === GrabAction.hoist ? 1 : 0;
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

test("Peon's grab holds the caught fighter, and his forward throw from the hold hoists it over his authored hoist frames into a carry on his shoulder [k1 scenario]", () => {
  const pair = duelPair(createFighter(Character.peon, 0.0, 1), createFighter(Character.rifleman, GAP, -1));
  assertEquals(hold(pair.world, pair.owner), 10);
  assertEquals(pair.owner.grab.action, GrabAction.hold);
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
  [controls({ cStickSideFlick: 1 }), GrabAction.cargoThrowForward],
  [controls({ attackPressed: true, direction: -1 }), GrabAction.cargoThrowBack],
  [controls({ cStickUpFlick: true }), GrabAction.cargoThrowUp],
  [controls({ attackPressed: true, verticalDirection: -1 }), GrabAction.cargoThrowDown],
] as const;

const HOLD_THROWS = [
  [controls({ grabThrowX: -1 }), GrabAction.throwBack],
  [controls({ grabThrowZ: 1 }), GrabAction.throwUp],
  [controls({ grabThrowZ: -1 }), GrabAction.throwDown],
] as const;

test("From Peon's grab hold, attack pummels and the back, up and down throws launch straight out of the hold with their own authored damage, never entering a carry [k1 scenario]", () => {
  const pummel = duelPair(createFighter(Character.peon, 0.0, 1), createFighter(Character.rifleman, GAP, -1));
  hold(pummel.world, pummel.owner);
  stepDuel(pummel.world, controls({ attackPressed: true }));
  assertEquals(pummel.owner.grab.action, GrabAction.pummel);
  for (const [input, action] of HOLD_THROWS) {
    const { world, owner, target } = duelPair(createFighter(Character.peon, 0.0, 1), createFighter(Character.rifleman, GAP, -1));
    hold(world, owner);
    const damage = target.status.damage;
    stepDuel(world, input);
    assertEquals(owner.grab.action, action);
    let carried = false;
    for (let frame = 0; frame < 60 && target.grab.owner !== undefined; frame++) {
      stepDuel(world);
      carried ||= owner.grab.action === GrabAction.hoist || owner.grab.action === GrabAction.carry;
    }
    assertFalse(carried);
    assertEquals(target.grab.owner, undefined);
    assertEquals(target.status.damage, f32(damage + PEON_MOVES.throws[action]!.effect.damage));
  }
});

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
      if (thrown < 0 && peon.grab.action === GrabAction.cargoThrowUp) {
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

test("A computer Peon forward-throws its grab into the carry, walks it to within its throw gap of the nearer ledge, then cargo-throws the fighter off that side [k1 scenario]", () => {
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
    hold(world, peon);
    assertEquals(peon.grab.action, GrabAction.hold);
    const runtime = createPacingAndPresentation();
    const produced = createFrameControls();
    const ledge = side > 0 ? mainDeckRight(0) : mainDeckLeft(0);
    let gapAtThrow = -1.0;
    let carried = false;
    for (let frame = 1; frame < 240 && target.grab.owner !== undefined; frame++) {
      produceComputerInput(match, world, runtime, 0, frame, produced.inputs[0], produced.commands[0]);
      stepDuel(world, produced.inputs[0]);
      carried ||= peon.grab.action === GrabAction.carry;
      const throwing = peon.grab.action >= GrabAction.cargoThrowForward && peon.grab.action <= GrabAction.cargoThrowDown;
      if (throwing && gapAtThrow < 0.0) gapAtThrow = f32(side * f32(ledge - peon.motion.x));
    }
    assertTrue(carried);
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

function carryAt(percent: number, remaining?: number): Carry {
  const { world, owner, target } = duelPair(createFighter(Character.peon, 0.0, 1), createFighter(Character.rifleman, GAP, -1));
  target.status.damage = percent;
  hold(world, owner);
  stepDuel(world, forwardThrow(owner));
  if (remaining !== undefined) target.grab.grabbedFrames = remaining;
  for (let frame = 0; frame < 60 && owner.grab.action !== GrabAction.carry; frame++) stepDuel(world);
  return { world, peon: owner, target, hoistFrames: CARRY.hoistFrames };
}

test("Landing on Peon's back sets the carried fighter's hold timer to 180 frames plus 3 per percent, capped at 480 from 100 percent up [k1 scenario]", () => {
  for (const [percent, frames] of [[0.0, 180], [50.0, 330], [100.0, 480], [150.0, 480], [400.0, 480]] as const) {
    const run = carryAt(percent);
    assertEquals(run.peon.grab.action, GrabAction.carry);
    assertEquals(run.target.grab.grabbedFrames, frames);
    assertEquals(run.target.grab.heldFrames, 0);
  }
});

test("Entering the carry replaces the remaining grab hold time instead of adding to it, whether it was long or nearly spent [k1 scenario]", () => {
  for (const remaining of [3000, 40]) {
    const run = carryAt(50.0, remaining);
    assertEquals(run.target.grab.grabbedFrames, 330);
  }
});

test("The carry hold timer counts down a frame at a time, each mash input shortens it by the shared mash amount, and an idle timer escapes the carry exactly when it runs out [k1 scenario]", () => {
  const idleRun = carryAt(50.0);
  stepDuel(idleRun.world);
  assertEquals(idleRun.target.grab.grabbedFrames, 329);
  const mashed = carryAt(50.0);
  stepDuel(mashed.world, idle, controls({ grabMashPressed: true }));
  assertEquals(mashed.target.grab.grabbedFrames, 330 - 1 - MASH_FRAMES);
  const timed = carryAt(0.0);
  assertEquals(release(timed, idle), 180);
  assertEquals(timed.peon.grab.action, GrabAction.escape);
  assertGreaterThan(timed.target.launch.hitstun, 0);
});

test("A rollback taken mid-hoist replays the carry entry to the identical hold timer [k1 scenario]", () => {
  const game = createMatchState();
  game.phase = Phase.match;
  const peon = createFighter(Character.peon, 0.0, 1);
  const target = createFighter(Character.rifleman, GAP, -1);
  target.status.damage = 50.0;
  const world = createRoster(3, [peon, target]);
  const frameControls = createBufferedFrameControls();
  const runtime = createPacingAndPresentation();
  let frame = 0;
  const step = (input: Readonly<Controls>) => {
    frame++;
    copyControls(frameControls.inputs[0], input);
    copyControls(frameControls.inputs[1], idle);
    stepMatch(game, world, frameControls, frame);
  };
  for (let i = 0; i < 3; i++) step(idle);
  testBeginAttacks(world, AttackStyle.grab, undefined);
  while (peon.grab.action !== GrabAction.hold && frame < 60) step(idle);
  step(forwardThrow(peon));
  for (let i = 0; i < 4; i++) step(idle);
  assertEquals(peon.grab.action, GrabAction.hoist);
  const snapshot = createReplaySnapshot();
  captureReplaySnapshot(snapshot, world, game, frameControls, runtime);
  const savedFrame = frame;
  const play = () => {
    for (let i = 0; i < 20; i++) step(idle);
    return target.grab.grabbedFrames;
  };
  const first = play();
  assertEquals(peon.grab.action, GrabAction.carry);
  restoreReplaySnapshot(snapshot, world, game, frameControls, runtime);
  frame = savedFrame;
  assertEquals(peon.grab.action, GrabAction.hoist);
  assertEquals(play(), first);
  assertLessThan(first, 330);
  assertGreaterThan(first, 330 - 20);
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
  while (peon.grab.action !== GrabAction.hold && frame < 60) step(idle, idle);
  step(forwardThrow(peon), idle);
  assertEquals(peon.grab.action, GrabAction.hoist);
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

test("Peon says his Work, work line exactly once, as his forward throw hoists the fighter, never on the catch itself, and a fighter without a hoist voice says nothing [k1 scenario]", () => {
  for (const character of [Character.peon, Character.rifleman]) {
    const { world, owner, target } = duelPair(createFighter(character, 0.0, 1), createFighter(Character.rifleman, GAP, -1));
    const events = createImpactEvents();
    const voice = hoistVoice(Character.peon)!;
    let spoken = 0;
    let caught = false;
    const sink = (sound: string) => { if (sound === voice) spoken++; };
    testBeginAttacks(world, AttackStyle.grab, undefined);
    for (let frame = 0; frame < 120; frame++) {
      captureImpactEventsBefore(events, owner);
      stepDuel(world, frame === 30 ? controls({ grabThrowX: 1 }) : frame === 60 ? controls({ cStickSideFlick: 1 }) : idle);
      finishImpactEventsAfter(events, owner, world);
      presentFighterSounds(events, sink);
      if (frame === 29) assertEquals(spoken, 0);
    }
    assertEquals(target.grab.owner, undefined);
    assertEquals(spoken, character === Character.peon ? 1 : 0);
  }
});

test("Carrying, Peon draws his look's carry stand clip while still and its carry walk clip while walking, through the match frame pipeline [k1 scenario]", () => {
  const peon = createFighter(Character.peon, 0.0, 1);
  const target = createFighter(Character.rifleman, GAP, -1);
  const match = createMatchState();
  match.phase = Phase.match;
  match.timeLimitMinutes = 0;
  const world = createRoster(3, [peon, target]);
  const frameControls = createFrameControls();
  const runtime = createPacingAndPresentation();
  const produced = createFrameControls();
  const row = createMatchFrameInput();
  const step = (input: Readonly<Controls>): number => {
    const frame = runtime.simulationFrame + 1;
    copyControls(produced.inputs[0], input);
    copyControls(produced.inputs[1], idle);
    assertTrue(captureFrame(row, frame, world.mask, produced, runtime) && executeMatchFrame(row, match, world, frameControls, runtime, frame));
    const pose = runtime.poses[0]!;
    return pose.clipIndex ?? originalClipNamed(Character.peon, pose.clipName) ?? -1;
  };
  for (let frame = 0; frame < 3; frame++) step(idle);
  testBeginAttacks(world, AttackStyle.grab, undefined);
  let shown = -1;
  for (let frame = 0; frame < 60 && peon.grab.action !== GrabAction.carry; frame++) shown = step(peon.grab.action === GrabAction.hold ? forwardThrow(peon) : idle);
  shown = step(idle);
  assertEquals(peon.grab.action, GrabAction.carry);
  assertEquals(shown, clipFor(Character.peon, peonLook.carry!.stand).index);
  for (let frame = 0; frame < 6; frame++) shown = step(controls({ direction: 1 }));
  assertGreaterThan(peon.motion.vx, 0.0);
  assertEquals(shown, clipFor(Character.peon, peonLook.carry!.walk).index);
});
