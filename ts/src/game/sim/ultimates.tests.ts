import { assertDefined, assertEquals, assertFalse, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { Action, maskOf } from "../input/actions";
import { adaptInput } from "../match/inputAdapter";
import { inputRow } from "../input/inputRow";
import { Phase } from "../lobby/lobbyState";
import { stepMatch } from "../match/step";
import { createReplaySnapshot, type ReplayState } from "../replay/snapshot";
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

function step(d: Duel, held: number, pressed: number): void {
  d.tick++;
  const row = inputRow({ held: held | pressed, pressed });
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
