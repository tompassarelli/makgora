import { assertEquals, assertGreaterThan, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { at } from "wisp/src/runtime/lookup";
import { Action, maskOf } from "../../input/actions";
import { adaptInput } from "../../match/inputAdapter";
import { inputRow } from "../../input/inputRow";
import { Phase } from "../../lobby/lobbyState";
import { stepMatch } from "../../match/step";
import { copyReplayState, createReplaySnapshot, type ReplayState } from "../../replay/snapshot";
import { canonicalState } from "../../replay/canonical";
import { copyFighterState } from "../../../generated/state/fighterState";
import { Character, ProjectileKind, SpecialAction } from "../../sim/codes";
import { createFighter, type Fighter } from "../../sim/fighter";
import { setWorldMotionValue } from "../../sim/motion";
import { type Controls, fighterAt, neutralControls } from "../../sim/roster";
import { holdAutoFollowUpOnDeck, pressHeroFollowUp } from "../../match/botHeroKit";
import { THUNDER_LEAP_DIVE_FRAME } from "./specials";
import { CHARGED_AIM_FRAMES, FOLLOW_UP_FORM } from "../../sim/specials/schema";

function lift(fighter: Fighter, height: number): void {
  fighter.motion.z = height;
  fighter.motion.vz = 0.0;
  fighter.motion.grounded = false;
  fighter.motion.surface = undefined;
  setWorldMotionValue(fighter.motion.meleeZ, fighter.motion.z);
  setWorldMotionValue(fighter.motion.meleeVelocityZ, fighter.motion.vz);
}

const FOE_AWAY = 400.0;
const STICK = 127;

interface Direction {
  readonly name: string;
  readonly x: number;
  readonly z: number;
}

const DIRECTIONS: readonly Direction[] = [
  { name: "up", x: 0, z: 1 }, { name: "up-right", x: 1, z: 1 }, { name: "right", x: 1, z: 0 }, { name: "down-right", x: 1, z: -1 },
  { name: "down", x: 0, z: -1 }, { name: "down-left", x: -1, z: -1 }, { name: "left", x: -1, z: 0 }, { name: "up-left", x: -1, z: 1 },
];

function leapMatch(foeX: number, kingX = 0.0): { state: ReplayState; king: Fighter; foe: Fighter } {
  const state = createReplaySnapshot();
  const king = fighterAt(state.world, 0);
  const foe = fighterAt(state.world, 1);
  copyFighterState(king, createFighter(Character.mountainKing, kingX, 1), 3);
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

const FIRE_STEP_FRAME = THUNDER_LEAP_DIVE_FRAME - 1;
const UP = at(DIRECTIONS, 0);

interface Held {
  readonly x: number;
  readonly z: number;
  readonly special: boolean;
}

const REST: Held = { x: 0, z: 0, special: false };
const holding = (direction: Direction, special = false): Held => ({ x: direction.x, z: direction.z, special });

interface Leap {
  readonly state: ReplayState;
  readonly king: Fighter;
  readonly foe: Fighter;
  readonly trail: number[];
  tick: number;
  dived: boolean;
}

function startLeap(aim: Direction, foeX = FOE_AWAY, kingX = 0.0): Leap {
  const { state, king, foe } = leapMatch(foeX, kingX);
  const leap: Leap = { state, king, foe, trail: [], tick: 1, dived: false };
  step(state, king, leap.tick, aim.x, aim.z, true, true);
  assertEquals(king.special.action, SpecialAction.heroUp, "Thunder Leap starts");
  return leap;
}

function advance(leap: Leap, aim: Direction, input: (frame: number) => Held, stopFrame: number): void {
  const { state, king } = leap;
  while (king.special.action === SpecialAction.heroUp && king.special.frame < stopFrame) {
    const frame = king.special.frame;
    const held = frame < CHARGED_AIM_FRAMES + 1 ? holding(aim) : input(frame);
    step(state, king, ++leap.tick, held.x, held.z, held.special);
    leap.dived ||= king.special.form >= FOLLOW_UP_FORM;
    leap.trail.push(king.motion.x, king.motion.z);
  }
}

function leapToTop(aim: Direction, input: (frame: number) => Held = () => REST, foeX = FOE_AWAY, kingX = 0.0): Leap {
  const leap = startLeap(aim, foeX, kingX);
  advance(leap, aim, input, FIRE_STEP_FRAME);
  assertEquals(leap.king.special.frame, FIRE_STEP_FRAME, "he reaches the step before the top");
  assertEquals(leap.dived, false, "nothing dives before the top");
  return leap;
}


const BOLT_WATCH_FRAMES = 160;

function liveHammer(king: Fighter): { readonly x: number; readonly velocityX: number } | undefined {
  for (const projectile of king.projectiles) if (projectile.life > 0 && projectile.kind === ProjectileKind.hero) return projectile;
  return undefined;
}

const SHORT_HOP_HEIGHT = 70.0;
const BOLT_LANDING_FRAME = 10;

interface BoltFlight {
  readonly landFrame: number;
  readonly landTick: number;
  readonly landingLag: number;
  readonly spawned: number;
  readonly ended: number;
  readonly groundedAtEnd: boolean;
  readonly final: string;
  readonly replayed?: string;
}

function playBoltFromHop(height: number, rollBackFrom?: number): BoltFlight {
  const { state, king } = leapMatch(-FOE_AWAY);
  lift(king, height);
  const snapshot = createReplaySnapshot();
  let landFrame = -1;
  let landTick = -1;
  let landingLag = -1;
  let spawned = 0;
  let ended = 0;
  const play = (from: number): void => {
    for (let tick = from; tick <= BOLT_WATCH_FRAMES && ended === 0; tick++) {
      step(state, king, tick, 0, 0, tick === 1, false);
      if (landFrame < 0 && king.motion.grounded) {
        landFrame = king.special.frame;
        landTick = tick;
        landingLag = king.landing.lag;
      }
      if (spawned === 0 && liveHammer(king) !== undefined) spawned = tick;
      if (king.special.action !== SpecialAction.heroNeutral) ended = tick;
      if (tick === rollBackFrom) copyReplayState(snapshot, state);
    }
  };
  play(1);
  if (rollBackFrom === undefined) return { landFrame, landTick, landingLag, spawned, ended, groundedAtEnd: king.motion.grounded, final: canonicalState(state) };
  const expected = canonicalState(state);
  copyReplayState(state, snapshot);
  landFrame = -1;
  landTick = -1;
  spawned = 0;
  ended = 0;
  play(rollBackFrom + 1);
  return { landFrame, landTick, landingLag, spawned, ended, groundedAtEnd: king.motion.grounded, final: expected, replayed: canonicalState(state) };
}

function assertBoltRollbackThroughLanding(): void {
  const flight = playBoltFromHop(SHORT_HOP_HEIGHT, BOLT_LANDING_FRAME - 2);
  assertEquals(flight.replayed, flight.final, "replayed state");
  assertEquals(flight.landFrame, BOLT_LANDING_FRAME, "the replay lands on the same frame");
  assertEquals(flight.spawned, 23, "the replay throws on the same frame");
  assertEquals(flight.ended, 61, "the replay ends on the same frame");
}

test("A rollback from the frame before landing replays a Storm Bolt through the landing to the same state [k1 scenario]", () => assertBoltRollbackThroughLanding());

const BOT_LEAP_XS = [-600.0, -450.0, -300.0, 0.0, 300.0, 450.0, 600.0] as const;
const BOT_FOE_OFFSETS = [-450.0, -250.0, 0.0, 250.0, 450.0] as const;
const BOT_FALL_LIMIT = 300;

function botDiveLands(leap: Leap, input: Controls, foeX: number, foeZ: number, guarded: boolean, what: string): boolean {
  const { state, king, foe } = leap;
  if (guarded) holdAutoFollowUpOnDeck(king, state.match.stageChoice, leap.tick, input);
  step(state, king, ++leap.tick, input.direction, input.verticalDirection, false);
  if (king.special.form < FOLLOW_UP_FORM) return false;
  for (let n = 0; n < BOT_FALL_LIMIT && !king.motion.grounded && !king.status.out; n++) {
    place(foe, foeX, foeZ);
    step(state, king, ++leap.tick, 0, 0, false);
  }
  assertEquals(king.motion.grounded, true, `${what}: the dive (${input.direction}, ${input.verticalDirection}) comes down on a deck`);
  return true;
}

test("The computer's Hammerfall dive from the top of Thunder Leap always comes down on a deck: it never picks a dive whose path leaves every deck, even with its foe along that path, and a stick its later input steps leave pointing off the stage starts no dive (#731) [k1 scenario]", () => {
  let picked = 0;
  let held = 0;
  for (const kingX of BOT_LEAP_XS) {
    for (const offsetX of BOT_FOE_OFFSETS) for (const offsetZ of BOT_FOE_OFFSETS) {
      if (offsetX === 0.0 && offsetZ === 0.0) continue;
      const leap = leapToTop(UP, () => REST, FOE_AWAY, kingX);
      const foeX = f32(leap.king.motion.x + offsetX);
      const foeZ = f32(leap.king.motion.z + offsetZ);
      place(leap.foe, foeX, foeZ);
      const input = neutralControls();
      if (!pressHeroFollowUp(leap.king, leap.foe, leap.state.match.stageChoice, leap.tick, input)) continue;
      if (botDiveLands(leap, input, foeX, foeZ, false, `from x ${kingX}, foe at ${offsetX}, ${offsetZ}`)) picked++;
    }
    for (const direction of DIRECTIONS) {
      if (direction === UP) continue;
      const leap = leapToTop(UP, () => REST, FOE_AWAY, kingX);
      const input = neutralControls();
      input.direction = direction.x;
      input.verticalDirection = direction.z;
      if (!botDiveLands(leap, input, FOE_AWAY, 0.0, true, `from x ${kingX}, stick ${direction.name}`)) held++;
    }
  }
  assertGreaterThan(picked, 20);
  assertGreaterThan(held, 0);
});

const FROZEN_THRONE = 2;
const LATE_DIVE_X = 292.0;

function guardedStick(stage: number, kingX: number): Controls {
  const leap = startLeap(UP, FOE_AWAY, kingX);
  leap.state.match.stageChoice = stage;
  advance(leap, UP, () => REST, FIRE_STEP_FRAME);
  const input = neutralControls();
  input.direction = 1;
  input.verticalDirection = -1;
  holdAutoFollowUpOnDeck(leap.king, stage, leap.tick, input);
  return input;
}

test("The computer's Hammerfall guard judges the dive from where the leap's last rising step leaves him: from x 292 on the Frozen Throne the down-right dive misses the deck and is held back, while from x 100 it lands and goes ahead [k1 scenario]", () => {
  const late = guardedStick(FROZEN_THRONE, LATE_DIVE_X);
  assertEquals([late.direction, late.verticalDirection].join(","), "0,1", "the dive off the edge is held in the leap's zone");
  const near = guardedStick(FROZEN_THRONE, 100.0);
  assertEquals([near.direction, near.verticalDirection].join(","), "1,-1", "the dive onto the deck stays");
});
