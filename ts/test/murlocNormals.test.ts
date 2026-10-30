import { expect, test } from "bun:test";
import { Action, bit } from "../src/game/input/actions";
import { inputRow } from "../src/game/input/inputRow";
import { Phase } from "../src/game/lobby/lobbyState";
import { adaptInput } from "../src/game/match/inputAdapter";
import { stepMatch } from "../src/game/match/step";
import { createReplaySnapshot } from "../src/game/replay/snapshot";
import { copyFighterState } from "../src/generated/state/fighterState";
import { MURLOC_MOVES } from "../src/game/fighters/murloc/moves";
import { AttackStyle, Character } from "../src/game/sim/codes";
import { createFighter, type Fighter } from "../src/game/sim/fighter";
import { setWorldMotionValue } from "../src/game/sim/motion";
import { fighterAt } from "../src/game/sim/roster";
import { beginAttack } from "../src/game/sim/transitions";

const FOE_GAP = 50.0;
const ORIGIN_X = 300.0;

function arena(foeGap = FOE_GAP) {
  const state = createReplaySnapshot();
  const murloc = fighterAt(state.world, 0);
  const foe = fighterAt(state.world, 1);
  copyFighterState(murloc, createFighter(Character.murloc, ORIGIN_X, 1), 3);
  copyFighterState(foe, createFighter(Character.butcher, ORIGIN_X + foeGap, -1), 3);
  state.match.phase = Phase.match;
  state.match.stageChoice = 0;
  state.match.matchSeed = 756;
  state.match.hazards = false;
  state.match.items.on = false;
  state.match.timeLimitMinutes = 0;
  state.match.ultimatesOff = true;
  return { state, murloc, foe };
}

function lift(fighter: Fighter, z: number): void {
  fighter.motion.z = z;
  fighter.motion.vz = 0.0;
  fighter.motion.grounded = false;
  fighter.motion.surface = undefined;
  setWorldMotionValue(fighter.motion.meleeZ, fighter.motion.z);
  setWorldMotionValue(fighter.motion.meleeVelocityZ, fighter.motion.vz);
}

type Arena = ReturnType<typeof arena>;

function stepFrame(world: Arena, tick: number, held: boolean, foeAxisX = 0, pulse = false): void {
  const own = inputRow({ held: held ? bit(Action.attack) : 0, pressed: 0, axisZ: 0, specialZ: 0 });
  const other = inputRow({ held: 0, pressed: 0, axisX: foeAxisX, axisZ: 0, specialZ: 0, sdi: pulse, sdiX: pulse ? foeAxisX : 0 });
  if (own === undefined || other === undefined) throw new Error("empty input row");
  adaptInput(own, world.murloc, tick, world.state.controls.inputs[0], world.state.controls.commands[0]);
  adaptInput(other, world.foe, tick, world.state.controls.inputs[1], world.state.controls.commands[1]);
  stepMatch(world.state.match, world.state.world, world.state.controls, tick);
}

function damageLog(world: Arena, style: AttackStyle, frames: number, held: (tick: number) => boolean, foeAxisX = 0): number[] {
  beginAttack(world.murloc, style, false);
  const log: number[] = [];
  let seen = world.foe.status.damage;
  for (let tick = 1; tick <= frames; tick++) {
    stepFrame(world, tick, held(tick), foeAxisX, foeAxisX !== 0 && tick % 2 === 0);
    if (world.foe.status.damage > seen) log.push(tick);
    seen = world.foe.status.damage;
  }
  return log;
}

const RAPID = MURLOC_MOVES.normals[AttackStyle.jab3];

test("a held jab flurry lands a slap every few frames and ends with a finisher, and the slaps hold the foe in place with no lock [k1 scenario]", () => {
  const world = arena();
  const log = damageLog(world, AttackStyle.jab3, (RAPID?.totalFrames ?? 0) + 40, () => true);
  expect(log.length).toBeGreaterThanOrEqual(5);
  const gaps = log.slice(1).map((tick, index) => tick - (log[index] ?? 0));
  expect(Math.max(...gaps)).toBeLessThanOrEqual(9);
  expect(world.foe.status.damage).toBeGreaterThan(5.0);
  expect(world.murloc.attack.style).toBeUndefined();
});

test("releasing the attack button mid-flurry skips the remaining slaps to the finisher, which still hits [k1 scenario]", () => {
  const held = arena();
  const heldLog = damageLog(held, AttackStyle.jab3, (RAPID?.totalFrames ?? 0) + 40, () => true);
  const tapped = arena();
  const tapLog = damageLog(tapped, AttackStyle.jab3, (RAPID?.totalFrames ?? 0) + 40, () => false);
  expect(tapLog.length).toBeGreaterThanOrEqual(2);
  expect(tapLog.length).toBeLessThan(heldLog.length);
  expect(tapped.foe.status.damage).toBeLessThan(held.foe.status.damage);
});

test("a foe holding away from a held flurry leaves the slaps after the first few and takes fewer hits than one standing still [k1 scenario]", () => {
  const still = arena();
  const stillLog = damageLog(still, AttackStyle.jab3, (RAPID?.totalFrames ?? 0) + 40, () => true);
  const away = arena();
  const awayLog = damageLog(away, AttackStyle.jab3, (RAPID?.totalFrames ?? 0) + 40, () => true, 1.0);
  expect(awayLog.length).toBeLessThan(stillLog.length);
});

test("the drill down air hits a foe below it several times before its last hit [k1 scenario]", () => {
  const world = arena(0.0);
  lift(world.murloc, 90.0);
  const log = damageLog(world, AttackStyle.downAir, MURLOC_MOVES.normals[AttackStyle.downAir]?.totalFrames ?? 0, () => false);
  expect(log.length).toBeGreaterThanOrEqual(3);
  for (let at = 1; at < log.length; at++) expect((log[at] ?? 0) - (log[at - 1] ?? 0)).toBeLessThanOrEqual(8);
});

test("a short-hop drill leaves a standing foe in hitstun until Murloc can jab, and the jab connects [k1 scenario]", () => {
  const world = arena(0.0);
  lift(world.murloc, 70.0);
  beginAttack(world.murloc, AttackStyle.downAir, false);
  let tick = 1;
  for (; tick <= 80; tick++) {
    stepFrame(world, tick, false);
    if (tick > 4 && world.murloc.attack.style === undefined && world.murloc.landing.lag <= 0 && world.murloc.launch.hitlag <= 0) break;
  }
  const afterDrill = world.foe.status.damage;
  expect(afterDrill).toBeGreaterThan(3.0);
  expect(world.foe.launch.hitstun).toBeGreaterThan(0);
  beginAttack(world.murloc, AttackStyle.jab, false);
  for (let wait = 0; wait < 8; wait++) stepFrame(world, tick + 1 + wait, false);
  expect(world.foe.status.damage).toBeGreaterThan(afterDrill);
});

test("neutral air starts by frame 3 [k3 measure docs/design/murloc.md]", () => {
  const nair = MURLOC_MOVES.normals[AttackStyle.neutralAir];
  expect((nair?.startupFrames ?? 99) + 1).toBeLessThanOrEqual(3);
});
