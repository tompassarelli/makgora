import { assertEquals, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Phase } from "../../lobby/lobbyState";
import { drivePartners } from "../../match/partnerDrive";
import { useMatchSeed } from "../../match/botRandom";
import { initializeMatchFighters, stepMatch } from "../../match/step";
import { canonicalState } from "../../replay/canonical";
import { copyReplayState, createReplaySnapshot, type ReplayState } from "../../replay/snapshot";
import { Character, DownState, DuoOrder, LedgeState } from "../../sim/codes";
import { createFighter } from "../../sim/fighter";
import { setWorldMotionValue } from "../../sim/motion";
import { createRoster, fighterAt } from "../../sim/roster";
import { mainDeckRight, mainDeckZ } from "../../sim/stage";
import { MURLOC_DUO } from "./duo";

const LEADER = 0;
const PARTNER = 2;
const FLAT_STAGE = 0;
const KNOCKED_OUT = 400.0;
const WATCH_FRAMES = 600;

function duo(outside = KNOCKED_OUT, height = -60.0, jumps = 0): ReplayState {
  const state = createReplaySnapshot();
  const world = createRoster(3, [createFighter(Character.murloc, 0.0, 1), createFighter(Character.peon, -500.0, 1)]);
  const match = state.match;
  match.phase = Phase.match;
  match.stageChoice = FLAT_STAGE;
  match.startHold = 0;
  match.hazards = false;
  match.items.on = false;
  match.timeLimitMinutes = 0;
  match.ultimatesOff = true;
  initializeMatchFighters(match, world);
  const partner = fighterAt(world, PARTNER);
  partner.motion.grounded = false;
  partner.motion.surface = undefined;
  partner.motion.x = f32(mainDeckRight(FLAT_STAGE) + outside);
  partner.motion.z = f32(mainDeckZ(FLAT_STAGE) + height);
  setWorldMotionValue(partner.motion.meleeZ, partner.motion.z);
  partner.jump.remaining = jumps;
  return { ...state, world };
}

function lying(x: number): ReplayState {
  const state = duo();
  const partner = fighterAt(state.world, PARTNER);
  partner.motion.grounded = true;
  partner.motion.surface = fighterAt(state.world, LEADER).motion.surface;
  partner.motion.x = x;
  partner.motion.z = mainDeckZ(FLAT_STAGE);
  setWorldMotionValue(partner.motion.meleeZ, partner.motion.z);
  partner.down.state = DownState.wait;
  return state;
}

function advance(state: ReplayState, tick: number): void {
  stepMatch(state.match, state.world, state.controls, tick);
}

interface Recovery {
  readonly separated: boolean;
  readonly hung: boolean;
  readonly resyncedAt: number;
  readonly gapAtResync: number;
  readonly trace: readonly number[];
}

function recover(state: ReplayState): Recovery {
  let separated = false;
  let hung = false;
  let resyncedAt = -1;
  let gapAtResync = Infinity;
  const trace: number[] = [];
  for (let tick = 1; tick <= WATCH_FRAMES; tick++) {
    advance(state, tick);
    const partner = fighterAt(state.world, PARTNER);
    separated ||= partner.duo?.order === DuoOrder.separated;
    hung ||= partner.ledge.state === LedgeState.hang;
    if (separated && resyncedAt < 0 && partner.duo?.order === DuoOrder.copy) {
      resyncedAt = tick;
      gapAtResync = Math.abs(partner.motion.x - fighterAt(state.world, LEADER).motion.x);
    }
    trace.push(partner.motion.x, partner.motion.z);
  }
  return { separated, hung, resyncedAt, gapAtResync, trace };
}

test("Grgl knocked 400 units off the stage regrabs the ledge and re-syncs with Mrgl within 600 frames [k1 scenario]", () => {
  const result = recover(duo());
  assertTrue(result.separated);
  assertTrue(result.hung);
  assertTrue(result.resyncedAt > 0);
  assertTrue(result.gapAtResync <= MURLOC_DUO.resyncDistance);
});

test("A separated Grgl replays from a saved frame to the live checksum [k1 scenario]", () => {
  const live = duo();
  const saved = createReplaySnapshot();
  const saveTick = 40;
  for (let tick = 1; tick <= WATCH_FRAMES; tick++) {
    if (tick === saveTick) copyReplayState(saved, live);
    advance(live, tick);
  }
  assertLessThan(0, fighterAt(live.world, PARTNER).duo?.orderFrame ?? 0);
  const expected = canonicalState(live);
  const replay = duo();
  copyReplayState(replay, saved);
  for (let tick = saveTick; tick <= WATCH_FRAMES; tick++) advance(replay, tick);
  assertEquals(canonicalState(replay), expected);
});

function getUp(seed: number, x: number): string {
  const state = lying(x);
  useMatchSeed(seed);
  drivePartners(state.world, state.controls, 1, FLAT_STAGE, 1);
  useMatchSeed(0);
  const input = state.controls.inputs[PARTNER];
  return `${input.getupAttackPressed} ${input.getupStandPressed} ${input.direction}`;
}

test("The recovery chooser draws no match seed: a Grgl lying far from Mrgl gets up the same way under any seed [k1 scenario]", () => {
  for (let x = 300.0; x <= 540.0; x += 60.0) {
    const plain = getUp(0, x);
    for (let seed = 1; seed <= 12; seed++) assertEquals(getUp(seed, x), plain);
  }
});
