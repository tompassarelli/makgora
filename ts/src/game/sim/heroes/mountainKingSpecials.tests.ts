import { assertEquals, assertFalse, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Action, maskOf } from "../../input/actions";
import { adaptInput } from "../../match/inputAdapter";
import { inputRow } from "../../input/inputRow";
import { Phase } from "../../lobby/lobbyState";
import { stepMatch } from "../../match/step";
import { createReplaySnapshot, type ReplayState } from "../../replay/snapshot";
import { copyFighterState } from "../../../generated/state/fighterState";
import { Character, ProjectileKind, SpecialAction } from "../codes";
import { createFighter, type Fighter } from "../fighter";
import { setWorldMotionValue } from "../motion";
import { fighterAt } from "../roster";
import { CLAP_REACH } from "./mountainKingSpecials";
import { SHORT } from "./mountainKingMoves";
import { FOLLOW_UP_FORM, SpecialForm } from "../specials/schema";

const WATCH_FRAMES = 90;
const AIR_HEIGHT = 200.0;

function lift(fighter: Fighter, height: number): void {
  fighter.motion.z = height;
  fighter.motion.vz = 0.0;
  fighter.motion.grounded = false;
  fighter.motion.surface = undefined;
  setWorldMotionValue(fighter.motion.meleeZ, fighter.motion.z);
  setWorldMotionValue(fighter.motion.meleeVelocityZ, fighter.motion.vz);
}

function clapMatch(foeAhead: number, airborne: boolean): { state: ReplayState; muradin: Fighter; foe: Fighter } {
  const state = createReplaySnapshot();
  const muradin = fighterAt(state.world, 0);
  const foe = fighterAt(state.world, 1);
  copyFighterState(muradin, createFighter(Character.mountainKing, 0.0, 1), 3);
  copyFighterState(foe, createFighter(Character.mountainKing, foeAhead, -1), 3);
  if (airborne) {
    lift(muradin, AIR_HEIGHT);
    lift(foe, f32(AIR_HEIGHT - 20.0));
  }
  state.match.phase = Phase.match;
  state.match.stageChoice = 0;
  state.match.matchSeed = 510;
  state.match.hazards = false;
  state.match.items.on = false;
  state.match.timeLimitMinutes = 0;
  state.match.ultimatesOff = true;
  return { state, muradin, foe };
}

function firstHit(foeAhead: number, airborne: boolean, held: (tick: number) => boolean, pressed: (tick: number) => boolean): number {
  const { state, muradin, foe } = clapMatch(foeAhead, airborne);
  for (let tick = 1; tick <= WATCH_FRAMES; tick++) {
    const down = tick === 1;
    const row = inputRow({ held: (down ? maskOf(Action.moveDown) : 0) | (held(tick) || pressed(tick) ? maskOf(Action.special) : 0),
      pressed: pressed(tick) ? maskOf(Action.special) : 0, axisZ: down ? -127 : 0, specialZ: down ? -1 : 0 });
    if (row === undefined) throw new Error("Thunder Clap input row");
    adaptInput(row, muradin, tick, state.controls.inputs[0], state.controls.commands[0]);
    stepMatch(state.match, state.world, state.controls, tick);
    if (tick === 1) assertEquals(muradin.special.action, SpecialAction.heroDown, "Muradin starts Thunder Clap");
    if (airborne) assertFalse(muradin.motion.grounded);
    if (foe.status.damage > 0) return tick;
  }
  return 0;
}

const NEAR = f32(CLAP_REACH * f32(0.5));

test("Muradin's earliest small Thunder Clap hits on frame 10, the held clap on frame 50 and the air clap on frame 15 [k3 measure #510]", () => {
  assertEquals(firstHit(NEAR, false, () => false, tick => (tick & 1) === 1), 10, "earliest small clap");
  assertEquals(firstHit(NEAR, false, () => true, tick => tick === 1), 50, "held clap");
  assertEquals(firstHit(f32(SHORT * f32(0.5)), true, () => false, tick => tick === 1), 15, "air clap");
});


const FOE_AWAY = 400.0;
const LEAP_WATCH_FRAMES = 60;
const STICK = 127;
const DIAGONAL = f32(0.7071067811865476);
const FOE_GAP = 200.0;

interface Direction {
  readonly name: string;
  readonly x: number;
  readonly z: number;
}

const DIRECTIONS: readonly Direction[] = [
  { name: "up", x: 0, z: 1 }, { name: "up-right", x: 1, z: 1 }, { name: "right", x: 1, z: 0 }, { name: "down-right", x: 1, z: -1 },
  { name: "down", x: 0, z: -1 }, { name: "down-left", x: -1, z: -1 }, { name: "left", x: -1, z: 0 }, { name: "up-left", x: -1, z: 1 },
];

function leapMatch(foeX: number): { state: ReplayState; king: Fighter; foe: Fighter } {
  const state = createReplaySnapshot();
  const king = fighterAt(state.world, 0);
  const foe = fighterAt(state.world, 1);
  copyFighterState(king, createFighter(Character.mountainKing, 0.0, 1), 3);
  copyFighterState(foe, createFighter(Character.rifleman, foeX, -1), 3);
  state.match.phase = Phase.match;
  state.match.stageChoice = 0;
  state.match.matchSeed = 509;
  state.match.hazards = false;
  state.match.items.on = false;
  state.match.timeLimitMinutes = 0;
  state.match.ultimatesOff = true;
  return { state, king, foe };
}

function directionMask(x: number, z: number): number {
  return (x < 0 ? maskOf(Action.moveLeft) : x > 0 ? maskOf(Action.moveRight) : 0) | (z < 0 ? maskOf(Action.moveDown) : z > 0 ? maskOf(Action.moveUp) : 0);
}

function step(state: ReplayState, king: Fighter, tick: number, x: number, z: number, special: boolean, upSpecial = false): void {
  const held = directionMask(x, z) | (special ? maskOf(Action.special) : 0);
  const row = inputRow({ held, pressed: special ? maskOf(Action.special) : 0, axisX: x * STICK, axisZ: z * STICK, specialZ: upSpecial ? 1 : 0 });
  if (row === undefined) throw new Error("Mountain King input row");
  adaptInput(row, king, tick, state.controls.inputs[0], state.controls.commands[0]);
  stepMatch(state.match, state.world, state.controls, tick);
}

function place(foe: Fighter, x: number, z: number): void {
  foe.motion.x = x;
  foe.motion.z = z;
  foe.motion.vx = 0.0;
  foe.motion.vz = 0.0;
  foe.motion.grounded = false;
  foe.motion.surface = undefined;
  setWorldMotionValue(foe.motion.meleeX, x);
  setWorldMotionValue(foe.motion.meleeZ, z);
  setWorldMotionValue(foe.motion.meleeVelocityZ, 0.0);
}

const DIVE_PRESS_FRAME = 28;
const PLUNGE_WATCH = 8;

function leapToDivePress(state: ReplayState, king: Fighter): number {
  let tick = 1;
  step(state, king, tick, 0, 1, true, true);
  assertEquals(king.special.action, SpecialAction.heroUp, "Thunder Leap starts");
  while (king.special.frame < DIVE_PRESS_FRAME - 1) step(state, king, ++tick, 0, 0, false);
  return tick;
}

test("Thunder Leap's first strike lands on frame 11 [k3 measure #509]", () => {
  const { state, king, foe } = leapMatch(10.0);
  let first = 0;
  step(state, king, 1, 0, 1, true, true);
  for (let tick = 2; tick <= LEAP_WATCH_FRAMES && first === 0; tick++) {
    step(state, king, tick, 0, 1, false);
    if (foe.status.damage > 0.0) first = king.special.frame;
  }
  assertEquals(first, 11, "the leap's hammer meets the foe beside him first on frame 11");
});

test("A Thunder Leap that hits nothing still dives as Hammerfall on a special press, straight down with the stick at rest, and he falls helpless after [k1 scenario]", () => {
  const { state, king } = leapMatch(FOE_AWAY);
  let tick = leapToDivePress(state, king);
  assertEquals(king.special.hit, false, "the leap whiffs");
  step(state, king, ++tick, 0, 0, true);
  assertEquals(king.special.form >= FOLLOW_UP_FORM, true, "the press starts a dive");
  const startX = king.motion.x;
  const startZ = king.motion.z;
  for (let n = 0; n < PLUNGE_WATCH; n++) step(state, king, ++tick, 0, 0, false);
  assertEquals(king.motion.x, startX, "with the stick at rest he plunges straight down");
  assertEquals(king.motion.z < startZ, true, "with the stick at rest he plunges down");
  for (let n = 0; n < LEAP_WATCH_FRAMES * 2 && king.special.action !== SpecialAction.none; n++) step(state, king, ++tick, 0, 0, false);
  assertEquals(king.motion.grounded || king.special.fall, true, "he lands from the dive or falls helpless");
});

function diveAt(direction: Direction, foeSide: number): boolean {
  const { state, king, foe } = leapMatch(FOE_AWAY);
  let tick = leapToDivePress(state, king);
  const length = direction.x !== 0 && direction.z !== 0 ? DIAGONAL : 1.0;
  const foeX = f32(king.motion.x + f32(f32(f32(foeSide * direction.x) * length) * FOE_GAP));
  const foeZ = f32(king.motion.z + f32(f32(f32(foeSide * direction.z) * length) * FOE_GAP));
  place(foe, foeX, foeZ);
  step(state, king, ++tick, direction.x, direction.z, true);
  assertEquals(king.special.form >= FOLLOW_UP_FORM, true, `${direction.name}: the press starts a dive`);
  if (direction.x !== 0) assertEquals(king.facing, direction.x, `${direction.name}: he turns along the dive`);
  const startX = king.motion.x;
  const startZ = king.motion.z;
  let struck = false;
  for (let n = 0; n < LEAP_WATCH_FRAMES && !struck && king.special.action === SpecialAction.heroUp; n++) {
    place(foe, foeX, foeZ);
    step(state, king, ++tick, 0, 0, false);
    struck = foe.status.damage > 0.0;
  }
  if (!struck) return false;
  const movedX = f32(king.motion.x - startX);
  const movedZ = f32(king.motion.z - startZ);
  assertEquals(Math.sign(movedX) === direction.x || (direction.x === 0 && Math.abs(movedX) < 1.0), true, `${direction.name}: he travels ${movedX} sideways`);
  assertEquals(Math.sign(movedZ) === direction.z || (direction.z === 0 && Math.abs(movedZ) < 1.0), true, `${direction.name}: he travels ${movedZ} up or down`);
  return true;
}

test("Each of the eight stick directions dives Hammerfall along that line into a foe held on it, and not into one held on the opposite line [k1 scenario]", () => {
  for (const direction of DIRECTIONS) {
    assertEquals(diveAt(direction, 1), true, `${direction.name}: the dive strikes the foe on its line`);
    assertEquals(diveAt(direction, -1), false, `${direction.name}: the dive misses the foe behind it`);
  }
});


const BOLT_WATCH_FRAMES = 160;
const BOLT_SECOND_PRESS = 70;

function liveHammer(king: Fighter): { readonly x: number; readonly velocityX: number } | undefined {
  for (const projectile of king.projectiles) if (projectile.life > 0 && projectile.kind === ProjectileKind.hero) return projectile;
  return undefined;
}

test("Storm Bolt's hammer flies straight out to the end of its life, never back toward him, and a second press while it flies starts no recall (#547) [k1 scenario]", () => {
  const { state, king } = leapMatch(-FOE_AWAY);
  step(state, king, 1, 0, 0, true);
  assertEquals(king.special.action, SpecialAction.heroNeutral, "Storm Bolt starts");
  let lastX: number | undefined;
  let flown = 0;
  let ended = false;
  for (let tick = 2; tick <= BOLT_WATCH_FRAMES && !ended; tick++) {
    step(state, king, tick, 0, 0, tick === BOLT_SECOND_PRESS);
    if (tick === BOLT_SECOND_PRESS) assertEquals(liveHammer(king) !== undefined, true, "the hammer still flies at the second press");
    assertEquals(king.special.action !== SpecialAction.none && king.special.form === SpecialForm.recall, false, `frame ${tick}: no recall starts`);
    const hammer = liveHammer(king);
    if (hammer === undefined) {
      ended = lastX !== undefined;
      continue;
    }
    assertEquals(Math.sign(hammer.velocityX), king.facing, `frame ${tick}: the hammer's velocity keeps pointing ahead`);
    if (lastX !== undefined) assertEquals(f32(hammer.x - lastX) * king.facing > 0.0, true, `frame ${tick}: the hammer moves away from him`);
    lastX = hammer.x;
    flown++;
  }
  assertEquals(ended, true, "the hammer's flight ends");
  assertEquals(flown >= BOLT_SECOND_PRESS, true, `the hammer flies ${flown} frames, past the second press`);
});

test("Storm Bolt's hammer first exists on frame 23 of the move and the move ends on frame 61 (#547) [k3 measure #547]", () => {
  const { state, king } = leapMatch(-FOE_AWAY);
  step(state, king, 1, 0, 0, true);
  assertEquals(king.special.action, SpecialAction.heroNeutral, "Storm Bolt starts");
  let spawned = 0;
  let ended = 0;
  for (let tick = 2; tick <= BOLT_WATCH_FRAMES && ended === 0; tick++) {
    step(state, king, tick, 0, 0, false);
    if (spawned === 0 && liveHammer(king) !== undefined) spawned = tick;
    if (king.special.action !== SpecialAction.heroNeutral) ended = tick;
  }
  assertEquals(spawned, 23, "the hammer first exists on frame 23");
  assertEquals(ended, 61, "the move ends on frame 61");
});
