import { f32 } from "wisp/src/sim/f32";
import { assertDefined, assertEquals, assertFalse, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { Action, maskOf } from "../input/actions";
import { adaptInput } from "../match/inputAdapter";
import { inputRow } from "../input/inputRow";
import { Phase } from "../lobby/lobbyState";
import { stepMatch } from "../match/step";
import { canonicalState } from "../replay/canonical";
import { copyReplayState, createReplaySnapshot, type ReplayState } from "../replay/snapshot";
import { copyFighterState } from "../../generated/state/fighterState";
import { Character, SpecialAction } from "./codes";
import { createFighter, type Fighter } from "./fighter";
import { fillMeter } from "./meter";
import { setWorldMotionValue } from "./motion";
import { fighterAt } from "./roster";
import { airHoldEnd } from "./specials/engine";
import type { AuthoredSpecial, FrameWindow } from "./specials/schema";

const FOE_AHEAD = 60.0;
const FOE_FAR = 500.0;
const WATCH_FRAMES = 150;
const ULTIMATE = maskOf(Action.attack, Action.special);
const CLEARS_GROUNDED_SPIN = 140.0;
const CLEARS_FULL_HOP_SPIN = 450.0;
const GROUNDED_TICK = 26;
const FULL_HOP_TICK = 35;
const AIR_JUMP_TICK = 44;

const Hop = { none: 0, full: 1, short: 2, fullThenAir: 3 } as const;
type Hop = (typeof Hop)[keyof typeof Hop];

interface Duel {
  readonly state: ReplayState;
  readonly blademaster: Fighter;
  readonly foe: Fighter;
  tick: number;
}

function duel(foeX: number): Duel {
  const state = createReplaySnapshot();
  const blademaster = fighterAt(state.world, 0);
  const foe = fighterAt(state.world, 1);
  copyFighterState(blademaster, createFighter(Character.blademaster, 0.0, 1), 3);
  copyFighterState(foe, createFighter(Character.warden, foeX, -1), 3);
  state.match.phase = Phase.match;
  state.match.stageChoice = 0;
  state.match.matchSeed = 503;
  state.match.hazards = false;
  state.match.items.on = false;
  state.match.timeLimitMinutes = 0;
  fillMeter(blademaster);
  return { state, blademaster, foe, tick: 0 };
}

function step(d: Duel, held: number, pressed: number, axisX = 0): void {
  d.tick++;
  const row = inputRow({ held: held | pressed, pressed, axisX });
  if (row === undefined) throw new Error("Bladestorm input row");
  adaptInput(row, d.blademaster, d.tick, d.state.controls.inputs[0], d.state.controls.commands[0]);
  stepMatch(d.state.match, d.state.world, d.state.controls, d.tick);
}

function bladestorm(f: Readonly<Fighter>): AuthoredSpecial {
  return assertDefined(f.tuning.ultimate, "Bladestorm");
}

function spinWindow(f: Readonly<Fighter>): FrameWindow {
  return assertDefined(bladestorm(f).jumpWindow, "Bladestorm's jump window");
}

function spinning(f: Readonly<Fighter>): boolean {
  return f.special.action === SpecialAction.heroUltimate;
}

function hopPress(d: Duel, hop: Hop, hopped: boolean): number {
  const f = d.blademaster;
  const window = spinWindow(f);
  if (hop === Hop.none || !spinning(f) || f.launch.hitlag > 0 || f.special.frame < window.first || f.special.frame >= window.last) return 0;
  if (!hopped && f.motion.grounded) return maskOf(hop === Hop.short ? Action.shortHop : Action.jump);
  if (hop === Hop.fullThenAir && hopped && !f.motion.grounded && f.motion.vz <= 0.0 && f.jump.remaining > 0) return maskOf(Action.jump);
  return 0;
}

function hopHeld(hop: Hop, hopped: boolean): number {
  return hopped && hop !== Hop.short ? maskOf(Action.jump) : 0;
}

interface Spin {
  readonly airborneHits: number;
  readonly hitsAfterLanding: number;
  readonly peak: number;
  readonly airJumped: boolean;
}

function spinWithHop(d: Duel, hop: Hop): Spin {
  const f = d.blademaster;
  let hopped = false;
  let airborneHits = 0;
  let hitsAfterLanding = 0;
  let landed = false;
  let peak = 0.0;
  let airJumped = false;
  step(d, 0, ULTIMATE);
  assertTrue(spinning(f));
  while (spinning(f) && d.tick < WATCH_FRAMES) {
    const pressed = hopPress(d, hop, hopped);
    const airJump = pressed !== 0 && !f.motion.grounded;
    const jumpsBefore = f.jump.remaining;
    hopped ||= pressed !== 0;
    const before = d.foe.status.damage;
    const wasAirborne = !f.motion.grounded;
    step(d, hopHeld(hop, hopped), pressed);
    if (airJump) {
      assertEquals(f.jump.remaining, jumpsBefore - 1, `frame ${d.tick}: his air jump is spent`);
      assertGreaterThan(f.motion.vz, 0.0);
      assertTrue(spinning(f));
      airJumped = true;
    }
    const struck = d.foe.status.damage > before;
    if (struck && wasAirborne && !f.motion.grounded) airborneHits++;
    if (wasAirborne && f.motion.grounded && spinning(f)) landed = true;
    if (struck && landed && f.motion.grounded) hitsAfterLanding++;
    peak = Math.max(peak, f.motion.z);
  }
  assertFalse(spinning(f));
  return { airborneHits, hitsAfterLanding, peak, airJumped };
}

test("An airborne Bladestorm press starts it, holds him in place until the first spin hit, then he falls with his air jump kept and no helpless fall [k1 scenario]", () => {
  const d = duel(FOE_FAR);
  const f = d.blademaster;
  step(d, maskOf(Action.jump), maskOf(Action.jump));
  while (f.motion.grounded || f.motion.vz > 0.0) step(d, maskOf(Action.jump), 0);
  const jumpsLeft = f.jump.remaining;
  assertGreaterThan(jumpsLeft, 0);
  step(d, 0, ULTIMATE);
  assertTrue(spinning(f));
  const height = f.motion.z;
  const hold = airHoldEnd(bladestorm(f));
  while (f.special.frame < hold) {
    assertEquals(f.motion.z, height, `spin frame ${f.special.frame}: he holds his height`);
    step(d, 0, 0);
  }
  let fell = false;
  while (!f.motion.grounded && spinning(f)) {
    const z = f.motion.z;
    step(d, 0, 0);
    fell ||= f.motion.z < z;
    assertFalse(f.special.fall);
    if (!f.motion.grounded) assertEquals(f.jump.remaining, jumpsLeft, `spin frame ${f.special.frame}: his air jump is kept`);
  }
  assertTrue(fell);
});

test("He full hops and short hops off the floor mid-spin, and the spin hits a foe while he is airborne [k1 scenario]", () => {
  const full = spinWithHop(duel(FOE_AHEAD), Hop.full);
  const short = spinWithHop(duel(FOE_AHEAD), Hop.short);
  const grounded = spinWithHop(duel(FOE_AHEAD), Hop.none);
  assertGreaterThan(full.airborneHits, 0);
  assertGreaterThan(short.airborneHits, 0);
  assertEquals(grounded.peak, 0.0, "without a jump he spins on the floor");
  assertGreaterThan(short.peak, 0.0);
  assertLessThan(short.peak, full.peak);
});

test("He spends his air jump mid-spin, rising past his full hop, and the spin keeps striking [k1 scenario]", () => {
  const plain = spinWithHop(duel(FOE_AHEAD), Hop.full);
  const air = spinWithHop(duel(FOE_AHEAD), Hop.fullThenAir);
  assertTrue(air.airJumped);
  assertGreaterThan(air.peak, plain.peak);
  assertGreaterThan(air.airborneHits, 0);
});

test("Landing mid-spin keeps Bladestorm going: it strikes again from the floor and runs to its end [k1 scenario]", () => {
  const spin = spinWithHop(duel(FOE_AHEAD), Hop.short);
  assertGreaterThan(spin.hitsAfterLanding, 0);
});

function strikesAt(hop: Hop, spinFrame: number, feetHeight: number): boolean {
  const d = duel(FOE_AHEAD);
  const f = d.blademaster;
  const foe = d.foe;
  let hopped = false;
  step(d, 0, ULTIMATE);
  while (f.special.frame < spinFrame - 1 || f.launch.hitlag > 0) {
    const pressed = hopPress(d, hop, hopped);
    hopped ||= pressed !== 0;
    step(d, hopHeld(hop, hopped), pressed);
  }
  foe.motion.x = f.motion.x + FOE_AHEAD;
  foe.motion.z = feetHeight;
  foe.motion.vz = 0.0;
  foe.motion.grounded = false;
  foe.motion.surface = undefined;
  foe.launch.hitstun = 0;
  foe.launch.knockbackX = 0.0;
  foe.launch.knockbackZ = 0.0;
  setWorldMotionValue(foe.motion.meleeX, foe.motion.x);
  setWorldMotionValue(foe.motion.meleeZ, foe.motion.z);
  setWorldMotionValue(foe.motion.meleeVelocityZ, 0.0);
  const before = foe.status.damage;
  step(d, hopHeld(hop, hopped), 0);
  step(d, hopHeld(hop, hopped), 0);
  return foe.status.damage > before;
}

test("A foe 140 above the floor clears the grounded spin but not his full hop; 450 up clears the full hop but not his air jump [k3 measure docs/design/ultimates.md]", () => {
  assertFalse(strikesAt(Hop.none, GROUNDED_TICK, CLEARS_GROUNDED_SPIN));
  assertTrue(strikesAt(Hop.full, FULL_HOP_TICK, CLEARS_GROUNDED_SPIN));
  assertFalse(strikesAt(Hop.full, FULL_HOP_TICK, CLEARS_FULL_HOP_SPIN));
  assertTrue(strikesAt(Hop.fullThenAir, AIR_JUMP_TICK, CLEARS_FULL_HOP_SPIN));
});

const MOVE_DOWN = maskOf(Action.moveDown);
const MOVE_RIGHT = maskOf(Action.moveRight);
const JUMP = maskOf(Action.jump);
const SHORT_HOP = maskOf(Action.shortHop);
const FLOAT_TOLERANCE = f32(0.001);
const PRESS_FRAME = 20;

function castInAir(d: Duel): void {
  const f = d.blademaster;
  step(d, JUMP, JUMP);
  while (f.motion.grounded || f.motion.vz > 0.0) step(d, JUMP, 0);
  step(d, 0, ULTIMATE);
  assertTrue(spinning(f));
}

function floatWindow(f: Readonly<Fighter>): FrameWindow {
  return assertDefined(bladestorm(f).airStall, "Bladestorm's float window");
}

function axisOf(held: number): number {
  return held === MOVE_RIGHT ? 127 : 0;
}

function floatFor(d: Duel, held: number, pressed: number): number[] {
  const f = d.blademaster;
  const heights = [f.motion.z];
  const last = floatWindow(f).last;
  while (spinning(f) && f.special.frame < last) {
    step(d, held, f.special.frame === PRESS_FRAME ? pressed : 0, axisOf(held));
    heights.push(f.motion.z);
  }
  return heights;
}

test("Cast in the air with nothing held, Bladestorm hovers at the height it was cast for the whole spin, then he falls with his air jump kept [k1 scenario]", () => {
  const d = duel(FOE_FAR);
  const f = d.blademaster;
  castInAir(d);
  const jumpsLeft = f.jump.remaining;
  const heights = floatFor(d, 0, 0);
  assertGreaterThan(heights.length, floatWindow(f).last - 2);
  for (const height of heights) assertLessThan(Math.abs(height - heights[0]!), FLOAT_TOLERANCE);
  assertEquals(f.jump.remaining, jumpsLeft);
  const spinEnd = f.motion.z;
  let fell = false;
  while (!f.motion.grounded) {
    const z = f.motion.z;
    step(d, 0, 0);
    fell ||= f.motion.z < z;
    assertFalse(f.special.fall);
    if (!f.motion.grounded) assertEquals(f.jump.remaining, jumpsLeft);
  }
  assertTrue(fell);
  assertLessThan(f.motion.z, spinEnd);
});

test("Cast in the air, Bladestorm sinks at a quarter of his terminal fall speed while down is held, and rises at that speed while jump is held or pressed [k1 scenario]", () => {
  const f = duel(FOE_FAR).blademaster;
  const quarter = f.tuning.physics.terminalSpeed / 4.0;
  assertLessThan(Math.abs(bladestorm(f).airFloat!.sink - quarter), FLOAT_TOLERANCE);
  assertLessThan(Math.abs(bladestorm(f).airFloat!.rise - quarter), FLOAT_TOLERANCE);
  const sunk = duel(FOE_FAR);
  castInAir(sunk);
  const sinkHeights = floatFor(sunk, MOVE_DOWN, 0);
  const rose = duel(FOE_FAR);
  castInAir(rose);
  const jumps = rose.blademaster.jump.remaining;
  const riseHeights = floatFor(rose, JUMP, JUMP);
  assertEquals(rose.blademaster.jump.remaining, jumps);
  const tapped = duel(FOE_FAR);
  castInAir(tapped);
  const tapHeights = floatFor(tapped, 0, SHORT_HOP);
  const held = bladestorm(f).airFloat!.sink;
  let sunkFrames = 0;
  for (let index = 20; index < sinkHeights.length && sinkHeights[index]! > 0.0; index++) {
    assertLessThan(Math.abs(sinkHeights[index - 1]! - sinkHeights[index]! - held), FLOAT_TOLERANCE);
    sunkFrames++;
  }
  assertGreaterThan(sunkFrames, 30);
  for (let index = 20; index < riseHeights.length; index++) assertLessThan(Math.abs(riseHeights[index]! - riseHeights[index - 1]! - held), FLOAT_TOLERANCE);
  assertLessThan(Math.abs(tapHeights[PRESS_FRAME]! - tapHeights[PRESS_FRAME - 1]!), FLOAT_TOLERANCE);
  assertLessThan(Math.abs(tapHeights[PRESS_FRAME + 1]! - tapHeights[PRESS_FRAME]! - held), FLOAT_TOLERANCE);
  assertLessThan(Math.abs(tapHeights[tapHeights.length - 1]! - tapHeights[PRESS_FRAME + 1]!), FLOAT_TOLERANCE);
  assertEquals(tapped.blademaster.jump.remaining, rose.blademaster.jump.remaining);
});

test("Cast in the air, Bladestorm lets him drift sideways while he floats [k1 scenario]", () => {
  const still = duel(FOE_FAR);
  castInAir(still);
  const startX = still.blademaster.motion.x;
  floatFor(still, 0, 0);
  const drifting = duel(FOE_FAR);
  castInAir(drifting);
  floatFor(drifting, MOVE_RIGHT, 0);
  assertLessThan(Math.abs(still.blademaster.motion.x - startX), FLOAT_TOLERANCE);
  assertGreaterThan(drifting.blademaster.motion.x - startX, 50.0);
});

test("Cast on the floor, Bladestorm does not float: his full hop mid-spin still carries him up, over a foe, and back down [k1 scenario]", () => {
  const d = duel(FOE_FAR);
  step(d, 0, ULTIMATE);
  assertEquals(d.blademaster.special.variant, 0);
  const hop = duel(FOE_AHEAD);
  const spin = spinWithHop(hop, Hop.full);
  assertEquals(hop.blademaster.special.variant, 0);
  assertGreaterThan(spin.peak, 0.0);
  assertGreaterThan(spin.airborneHits, 0);
  assertGreaterThan(spin.hitsAfterLanding, 0);
});

function floatRun(d: Duel, cast: number, to: number): void {
  while (d.tick < to) {
    const age = d.tick + 1 - cast;
    const held = age < 14 ? 0 : age < 28 ? MOVE_DOWN : age < 42 ? JUMP : age < 56 ? MOVE_RIGHT : 0;
    step(d, held, 0, axisOf(held));
  }
}

test("A rollback from mid-float replays the same spin [k1 scenario]", () => {
  const d = duel(FOE_FAR);
  castInAir(d);
  const cast = d.tick;
  const saveTick = cast + 30;
  floatRun(d, cast, saveTick);
  const snapshot = createReplaySnapshot();
  copyReplayState(snapshot, d.state);
  floatRun(d, cast, saveTick + 70);
  const expected = canonicalState(d.state);
  const finalZ = d.blademaster.motion.z;
  copyReplayState(d.state, snapshot);
  d.tick = saveTick;
  floatRun(d, cast, saveTick + 70);
  assertEquals(canonicalState(d.state), expected);
  assertEquals(d.blademaster.motion.z, finalZ);
});
