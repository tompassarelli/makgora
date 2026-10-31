import { assertEquals, assertFalse, assertGreaterThan, test } from "wisp/src/runtime/testing";
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
import { CLAP_REACH, HAMMERFALL_WHIFF_LANDING_LAG, THUNDER_LEAP_DIVE_FRAME, THUNDER_LEAP_LANDING_LAG } from "./specials";
import { SHORT } from "./moves";
import { CHARGED_AIM_FRAMES, FOLLOW_UP_FORM, SpecialForm } from "../../sim/specials/schema";

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
const PLUNGE_WATCH = 8;
const UP = at(DIRECTIONS, 0);
const UP_RIGHT = at(DIRECTIONS, 1);
const RIGHT = at(DIRECTIONS, 2);

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

function finish(leap: Leap, aim: Direction, input: (frame: number) => Held = () => REST): void {
  advance(leap, aim, input, Number.MAX_SAFE_INTEGER);
}

function sameTrail(first: Leap, second: Leap): boolean {
  return first.trail.length === second.trail.length && first.trail.every((value, index) => value === second.trail[index]);
}

function control(aim: Direction): Leap {
  const leap = leapToTop(aim);
  finish(leap, aim);
  return leap;
}

test("Thunder Leap's top does nothing without a change of direction: the stick at rest or still in the leap's own zone starts no dive, he falls helpless, and a special press from frame 18 on changes nothing [k1 scenario]", () => {
  for (const aim of [UP, UP_RIGHT, RIGHT]) {
    const baseline = control(aim);
    assertEquals(baseline.dived, false, `${aim.name}: with the stick at rest there is no dive`);
    assertEquals(baseline.king.motion.grounded || baseline.king.special.fall, true, `${aim.name}: he ends the move helpless or landed`);
    const inZone = () => holding(aim);
    const same = leapToTop(aim, inZone);
    finish(same, aim, inZone);
    assertEquals(same.dived, false, `${aim.name}: the stick still in the leap's zone starts no dive`);
    const pressing = (frame: number): Held => frame >= 17 ? { x: aim.x, z: aim.z, special: true } : holding(aim);
    const pressed = leapToTop(aim, pressing);
    finish(pressed, aim, pressing);
    assertEquals(pressed.dived, false, `${aim.name}: pressing special in the leap's zone starts no dive`);
    assertEquals(sameTrail(pressed, same), true, `${aim.name}: the press changes no motion`);
    const restPressing = (frame: number): Held => frame >= 17 ? { x: 0, z: 0, special: true } : REST;
    const restPressed = leapToTop(aim, restPressing);
    finish(restPressed, aim, restPressing);
    assertEquals(restPressed.dived, false, `${aim.name}: a press with the stick at rest starts no dive`);
    assertEquals(sameTrail(baseline, restPressed), true, `${aim.name}: a press at rest changes no motion`);
  }
});

test("Thunder Leap dives on frame 23 on its own in each of the seven zones other than the leap's, and not when the stick is held there only on the frame before or after [k1 scenario]", () => {
  for (const direction of DIRECTIONS) {
    if (direction === UP) continue;
    const early = leapToTop(UP, frame => frame === FIRE_STEP_FRAME - 1 ? holding(direction, true) : REST);
    step(early.state, early.king, ++early.tick, 0, 0, true);
    finish(early, UP);
    assertEquals(early.dived, false, `${direction.name}: a change held only on the frame before the top starts no dive`);
    const late = leapToTop(UP, () => REST);
    step(late.state, late.king, ++late.tick, 0, 0, false);
    step(late.state, late.king, ++late.tick, direction.x, direction.z, true);
    assertEquals(late.king.special.form >= FOLLOW_UP_FORM, false, `${direction.name}: a change on the frame after the top starts no dive`);
    const leap = leapToTop(UP, () => holding(direction));
    step(leap.state, leap.king, ++leap.tick, direction.x, direction.z, false);
    assertEquals(leap.king.special.form >= FOLLOW_UP_FORM, true, `${direction.name}: the held change starts the dive with no press`);
    if (direction.x !== 0) assertEquals(leap.king.facing, direction.x, `${direction.name}: he turns along the dive`);
  }
});

function diveAt(direction: Direction, foeSide: number): boolean {
  const leap = leapToTop(UP);
  const { state, king, foe } = leap;
  const length = direction.x !== 0 && direction.z !== 0 ? DIAGONAL : 1.0;
  const foeX = f32(king.motion.x + f32(f32(f32(foeSide * direction.x) * length) * FOE_GAP));
  const foeZ = f32(king.motion.z + f32(f32(f32(foeSide * direction.z) * length) * FOE_GAP));
  place(foe, foeX, foeZ);
  step(state, king, ++leap.tick, direction.x, direction.z, false);
  assertEquals(king.special.form >= FOLLOW_UP_FORM, true, `${direction.name}: the held change starts a dive`);
  const startX = king.motion.x;
  const startZ = king.motion.z;
  let struck = false;
  for (let n = 0; n < LEAP_WATCH_FRAMES && !struck && king.special.action === SpecialAction.heroUp; n++) {
    place(foe, foeX, foeZ);
    step(state, king, ++leap.tick, 0, 0, false);
    struck = foe.status.damage > 0.0;
  }
  if (!struck) return false;
  const movedX = f32(king.motion.x - startX);
  const movedZ = f32(king.motion.z - startZ);
  assertEquals(Math.sign(movedX) === direction.x || (direction.x === 0 && Math.abs(movedX) < 1.0), true, `${direction.name}: he travels ${movedX} sideways`);
  assertEquals(Math.sign(movedZ) === direction.z || (direction.z === 0 && Math.abs(movedZ) < 1.0), true, `${direction.name}: he travels ${movedZ} up or down`);
  return true;
}

test("Each stick direction other than the leap's dives Hammerfall along that line into a foe held on it, and not into one held on the opposite line [k1 scenario]", () => {
  for (const direction of DIRECTIONS) {
    if (direction === UP) continue;
    assertEquals(diveAt(direction, 1), true, `${direction.name}: the dive strikes the foe on its line`);
    assertEquals(diveAt(direction, -1), false, `${direction.name}: the dive misses the foe behind it`);
  }
});

test("A leap aimed off up dives straight up from the top, and a leap up-right dives up but not up-right, the leap's zone alone being excluded [k1 scenario]", () => {
  const sideways = leapToTop(RIGHT, () => holding(UP));
  const startZ = sideways.king.motion.z;
  step(sideways.state, sideways.king, ++sideways.tick, UP.x, UP.z, false);
  assertEquals(sideways.king.special.form >= FOLLOW_UP_FORM, true, "up after a leap right dives");
  for (let n = 0; n < PLUNGE_WATCH; n++) step(sideways.state, sideways.king, ++sideways.tick, 0, 0, false);
  assertEquals(sideways.king.motion.z > startZ, true, "the up dive climbs");
  const diagonal = leapToTop(UP_RIGHT, () => holding(UP_RIGHT));
  step(diagonal.state, diagonal.king, ++diagonal.tick, UP_RIGHT.x, UP_RIGHT.z, false);
  assertEquals(diagonal.king.special.form >= FOLLOW_UP_FORM, false, "up-right after a leap up-right does not dive");
});

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

const SHORT_HOP_HEIGHT = 70.0;
const BOLT_LANDING_FRAME = 10;
const HIGH_HOP_HEIGHT = 900.0;

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

function assertShortHopBolt(): void {
  const flight = playBoltFromHop(SHORT_HOP_HEIGHT);
  assertEquals(flight.landFrame, BOLT_LANDING_FRAME, "he lands during the wind-up");
  assertEquals(flight.landingLag, 0, "landing adds no lag");
  assertEquals(flight.spawned, 23, "the hammer first exists on frame 23");
  assertEquals(flight.ended, 61, "the move ends on frame 61");
  assertEquals(flight.groundedAtEnd, true, "he finishes the cast on the ground");
}

test("A Storm Bolt cast in a short hop that lands on frame 10 still throws the hammer on frame 23 and ends on the ground on frame 61, with no landing lag [k3 measure #547]", () => assertShortHopBolt());

test("A Storm Bolt landed from after the hammer is out ends with its landing lag, as before [k3 measure #547]", () => {
  const flight = playBoltFromHop(HIGH_HOP_HEIGHT);
  assertEquals(flight.landTick > flight.spawned, true, "he lands after the throw");
  assertEquals(flight.landingLag, 20, "landing after the throw keeps its landing lag");
});

function assertBoltRollbackThroughLanding(): void {
  const flight = playBoltFromHop(SHORT_HOP_HEIGHT, BOLT_LANDING_FRAME - 2);
  assertEquals(flight.replayed, flight.final, "replayed state");
  assertEquals(flight.landFrame, BOLT_LANDING_FRAME, "the replay lands on the same frame");
  assertEquals(flight.spawned, 23, "the replay throws on the same frame");
  assertEquals(flight.ended, 61, "the replay ends on the same frame");
}

test("A rollback from the frame before landing replays a Storm Bolt through the landing to the same state [k1 scenario]", () => assertBoltRollbackThroughLanding());

const LANDING_WATCH_FRAMES = 400;

function landingLagAfter(leapHeight: number | undefined, aimZ: number, dive: boolean): number {
  const { state, king } = leapMatch(FOE_AWAY);
  if (leapHeight !== undefined) lift(king, leapHeight);
  let tick = 1;
  step(state, king, tick, 0, aimZ, true, true);
  assertEquals(king.special.action, SpecialAction.heroUp, "Thunder Leap starts");
  let left = leapHeight !== undefined;
  while (tick < LANDING_WATCH_FRAMES) {
    const diveStick = dive && king.special.frame === FIRE_STEP_FRAME;
    step(state, king, ++tick, 0, diveStick ? -1 : tick < CHARGED_AIM_FRAMES ? aimZ : 0, false);
    left ||= !king.motion.grounded;
    if (left && king.motion.grounded) return king.landing.lag;
  }
  return -1;
}

test("Mountain King lands from Thunder Leap in 11 frames of landing lag after its helpless fall and when he lands during the move, and from a Hammerfall dive that hits no one in its whiff lag of 40 [k3 measure docs/gameplay-design.md]", () => {
  const lags = {
    fall: landingLagAfter(undefined, 1, false),
    midMove: landingLagAfter(AIR_HEIGHT, -1, false),
    dive: landingLagAfter(undefined, 1, true),
  };
  assertEquals(lags.fall, THUNDER_LEAP_LANDING_LAG, "landing from the helpless fall");
  assertEquals(lags.midMove, THUNDER_LEAP_LANDING_LAG, "landing during the leap");
  assertEquals(lags.dive, HAMMERFALL_WHIFF_LANDING_LAG, "landing from a whiffed dive pays the whiff lag");
});

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
