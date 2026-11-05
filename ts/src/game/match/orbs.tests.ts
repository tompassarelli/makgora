import { assertEquals, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Action, maskOf } from "../input/actions";
import { type RowFields, inputRow } from "../input/inputRow";
import { Phase } from "../lobby/lobbyState";
import { copyFighterState } from "../../generated/state/fighterState";
import { firstStateDifference } from "../replay/difference";
import { type ReplayState, copyReplayState, createReplaySnapshot } from "../replay/snapshot";
import { Character } from "../sim/codes";
import { type Fighter, createFighter } from "../sim/fighter";
import { setWorldMotionValue } from "../sim/motion";
import { fighterAt } from "../sim/roster";
import { ORB_GAIN, ORB_INTERVAL_FRAMES, orbPoint } from "../sim/orbs";
import { adaptInput } from "./inputAdapter";
import { matchSpawnX, stepMatch } from "./step";

const HOLD = 30;
const A = maskOf(Action.attack), S = maskOf(Action.special);

interface Bout {
  readonly state: ReplayState;
  readonly first: Fighter;
  readonly second: Fighter;
  tick: number;
}

function bout(orbs = true, character: Character = Character.rifleman, other: Character = Character.rifleman): Bout {
  const state = createReplaySnapshot();
  const first = fighterAt(state.world, 0);
  const second = fighterAt(state.world, 1);
  copyFighterState(first, createFighter(character, matchSpawnX(0), 1), 3);
  copyFighterState(second, createFighter(other, matchSpawnX(1), -1), 3);
  const { match } = state;
  match.phase = Phase.match;
  match.stageChoice = 0;
  match.hazards = false;
  match.items.on = false;
  match.timeLimitMinutes = 0;
  match.startHold = HOLD;
  match.orbs.on = orbs;
  return { state, first, second, tick: 0 };
}

const played = (b: Bout): number => b.state.match.matchFrame - b.state.match.startHold;

function step(b: Bout, first: RowFields = {}): void {
  b.tick++;
  const row = inputRow(first);
  if (row === undefined) throw new Error("orb test row");
  adaptInput(row, b.first, b.tick, b.state.controls.inputs[0], b.state.controls.commands[0]);
  stepMatch(b.state.match, b.state.world, b.state.controls, b.tick);
}

function playTo(b: Bout, frames: number): void {
  while (played(b) < frames) step(b);
}

function place(f: Fighter, x: number, z: number): void {
  f.motion.x = x;
  f.motion.z = z;
  setWorldMotionValue(f.motion.meleeX, f.motion.x);
  setWorldMotionValue(f.motion.meleeZ, f.motion.z);
}

function standAtOrb(f: Fighter, stage: number, lift = 0.0): void {
  const point = orbPoint(stage);
  place(f, point.x, f32(point.z + lift));
}

test("Meters and orbs roll back and replay to the same state across a spawn and a pickup [k1 scenario]", () => {
  const straight = bout();
  const replayed = bout();
  const saved = createReplaySnapshot();
  playTo(straight, ORB_INTERVAL_FRAMES - 40);
  playTo(replayed, ORB_INTERVAL_FRAMES - 40);
  copyReplayState(saved, replayed.state);
  const savedTick = replayed.tick;
  standAtOrb(replayed.first, 0);
  playTo(replayed, ORB_INTERVAL_FRAMES + 20);
  assertEquals(replayed.state.match.orbs.pickupSerial, 1);
  copyReplayState(replayed.state, saved);
  replayed.tick = savedTick;
  standAtOrb(straight.first, 0);
  standAtOrb(replayed.first, 0);
  playTo(straight, ORB_INTERVAL_FRAMES + 20);
  playTo(replayed, ORB_INTERVAL_FRAMES + 20);
  assertEquals(straight.state.match.orbs.pickupSerial, 1);
  assertEquals(firstStateDifference(straight.state, replayed.state), undefined);
  assertEquals(replayed.first.meter.ultimate, ORB_GAIN);
  assertEquals(replayed.first.meter.ultimate, straight.first.meter.ultimate);
});
