import { assertEquals, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { idiv } from "wisp/src/sim/intMath";
import { Action, maskOf } from "../../input/actions";
import { adaptInput } from "../../match/inputAdapter";
import { inputRow } from "../../input/inputRow";
import { Phase } from "../../lobby/lobbyState";
import { stepMatch } from "../../match/step";
import { canonicalState } from "../../replay/canonical";
import { copyReplayState, createReplaySnapshot, type ReplayState } from "../../replay/snapshot";
import { copyFighterState } from "../../../generated/state/fighterState";
import { Character, GrabAction, LedgeState } from "../../sim/codes";
import { createFighter, type Fighter } from "../../sim/fighter";
import { fighterAt } from "../../sim/roster";
import { ULTIMATE_METER_FRAMES } from "../../sim/meter";
import { mainDeckRight } from "../../sim/stage";
import { GRAB_HOLD_DISTANCE } from "../../sim/moves";
import { knockbackWeight } from "../../sim/itemBuffs";
import { HOOK_REEL_FRAMES, ROT } from "./specials";

type Press = "hook" | "rot" | "swing" | "backThrow" | "dismember" | "shield" | "none";
type Script = (tick: number) => readonly [Press, Press];

interface Duel {
  readonly state: ReplayState;
  readonly butcher: Fighter;
  readonly foe: Fighter;
  tick: number;
}

const ROWS: Readonly<Record<Press, Parameters<typeof inputRow>[0]>> = {
  hook: { held: maskOf(Action.special), pressed: maskOf(Action.special) },
  rot: { held: maskOf(Action.moveDown, Action.special), pressed: maskOf(Action.special), axisZ: -127, specialZ: -1 },
  swing: { held: maskOf(Action.moveUp, Action.special), pressed: maskOf(Action.special), axisZ: 127, specialZ: 1 },
  backThrow: { held: maskOf(Action.moveLeft), pressed: maskOf(Action.moveLeft), axisX: -127 },
  dismember: { held: maskOf(Action.special, Action.attack), pressed: maskOf(Action.special, Action.attack) },
  shield: { held: maskOf(Action.rightTrigger), pressed: maskOf(Action.rightTrigger) },
  none: {},
};

interface Setup {
  readonly foeAhead: number;
  readonly ultimates?: boolean;
  readonly offstage?: true;
}

function duel(setup: Setup): Duel {
  const state = createReplaySnapshot();
  const butcher = fighterAt(state.world, 0);
  const foe = fighterAt(state.world, 1);
  copyFighterState(butcher, createFighter(Character.butcher, 0.0, 1), 3);
  copyFighterState(foe, createFighter(Character.medivh, setup.foeAhead, -1), 3);
  if (setup.offstage === true) {
    butcher.motion.x = f32(mainDeckRight(0) + 100.0);
    butcher.motion.z = -200.0;
    butcher.motion.grounded = false;
    butcher.motion.surface = undefined;
    butcher.facing = -1;
  }
  butcher.meter.ultimate = ULTIMATE_METER_FRAMES;
  state.match.phase = Phase.match;
  state.match.stageChoice = 0;
  state.match.matchSeed = 1;
  state.match.hazards = false;
  state.match.items.on = false;
  state.match.timeLimitMinutes = 0;
  state.match.ultimatesOff = setup.ultimates !== true;
  return { state, butcher, foe, tick: 0 };
}

function step(d: Duel, [own, other]: readonly [Press, Press]): void {
  d.tick++;
  const first = inputRow(ROWS[own]);
  const second = inputRow(ROWS[other]);
  if (first === undefined || second === undefined) throw new Error("the Butcher's input row");
  adaptInput(first, d.butcher, d.tick, d.state.controls.inputs[0], d.state.controls.commands[0]);
  adaptInput(second, d.foe, d.tick, d.state.controls.inputs[1], d.state.controls.commands[1]);
  stepMatch(d.state.match, d.state.world, d.state.controls, d.tick);
}

const HOOK_END = 140;
const hookScript: Script = (tick) => [tick === 3 ? "hook" : tick === 60 ? "backThrow" : "none", "none"];

test("Meat Hook catches a foe 300 ahead, reels them into his hand over its reel frames, and his throw from the hold wins a Flesh Heap stack [k3 measure docs/design/butcher.md]", () => {
  const d = duel({ foeAhead: 300.0 });
  let reeled = 0;
  let maxReel = 0;
  let heldAt: number | undefined;
  for (let tick = 1; tick <= HOOK_END; tick++) {
    step(d, hookScript(tick));
    if (d.foe.grab.reel > 0) reeled++;
    maxReel = Math.max(maxReel, d.foe.grab.reel);
    if (heldAt === undefined && d.foe.grab.owner === 0 && d.foe.grab.reel === 0 && d.butcher.grab.action === GrabAction.hold) heldAt = d.foe.motion.x;
  }
  assertEquals(maxReel, HOOK_REEL_FRAMES);
  assertEquals(reeled, HOOK_REEL_FRAMES);
  assertTrue(heldAt !== undefined);
  if (heldAt !== undefined) assertEquals(heldAt, f32(d.butcher.motion.x + GRAB_HOLD_DISTANCE));
  assertEquals(d.butcher.status.stacks, 1);
  assertGreaterThan(d.foe.status.damage, 10.0);
});

test("A raised shield stops Meat Hook: nothing is caught and the shield takes the hit [k3 measure docs/design/butcher.md]", () => {
  const d = duel({ foeAhead: 300.0 });
  let caught = false;
  for (let tick = 1; tick <= 60; tick++) {
    step(d, [tick === 3 ? "hook" : "none", "shield"]);
    if (d.foe.grab.owner !== undefined) caught = true;
  }
  assertTrue(!caught);
  assertEquals(d.foe.status.damage, 0.0);
  assertLessThan(d.foe.shield.energy, 60.0);
});

const SWING_END = 40;
test("Hook Swing below the ledge tethers to it and reels him into ledge hang [k3 measure docs/design/butcher.md]", () => {
  const d = duel({ foeAhead: -300.0, offstage: true });
  let tethered = 0;
  let hung = false;
  for (let tick = 1; tick <= SWING_END; tick++) {
    step(d, [tick === 2 ? "swing" : "none", "none"]);
    if (d.butcher.ledge.state === LedgeState.tether) tethered++;
    if (d.butcher.ledge.state === LedgeState.hang) hung = true;
  }
  assertGreaterThan(tethered, 8);
  assertTrue(hung);
  assertEquals(d.butcher.ledge.side, 1);
  assertTrue(!d.butcher.special.fall);
});

const ROT_ON = 3;
const ROT_OFF = 123;
test("Rot toggles on, wounds and slows a foe beside him every 10 frames while bleeding him every 20, and toggles off [k3 measure docs/design/butcher.md]", () => {
  const d = duel({ foeAhead: 120.0 });
  let slowed = false;
  let auraFrames = 0;
  for (let tick = 1; tick <= 200; tick++) {
    step(d, [tick === ROT_ON || tick === ROT_OFF ? "rot" : "none", "none"]);
    if (d.foe.status.slowFrames > 0) slowed = true;
    if (d.butcher.status.aura) auraFrames++;
  }
  assertTrue(slowed);
  assertTrue(!d.butcher.status.aura);
  assertEquals(d.foe.status.damage, f32(idiv(auraFrames, ROT.every) * ROT.damage));
  assertEquals(d.butcher.status.damage, f32(idiv(auraFrames, ROT.selfEvery) * ROT.selfDamage));
  assertGreaterThan(auraFrames, 100);
});

test("Dismember pins a caught foe for its channel, carving 24% while healing him 24% [k3 measure docs/design/butcher.md]", () => {
  const d = duel({ foeAhead: 150.0, ultimates: true });
  d.butcher.status.damage = 50.0;
  for (let tick = 1; tick <= 160; tick++) step(d, [tick === 3 ? "dismember" : "none", "none"]);
  assertEquals(d.foe.status.damage, 24.0);
  assertEquals(d.butcher.status.damage, 26.0);
});

test("Flesh Heap stacks cap at five, add weight, and go with his stock [k3 measure docs/design/butcher.md]", () => {
  const d = duel({ foeAhead: 300.0 });
  const unstacked = knockbackWeight(d.butcher);
  for (let stack = 0; stack < 7; stack++) {
    d.foe.status.stocks = 3;
    d.foe.status.out = false;
    d.foe.status.struckBy = 0;
    d.foe.motion.x = 9000.0;
    step(d, ["none", "none"]);
  }
  assertEquals(d.butcher.status.stacks, 5);
  assertEquals(knockbackWeight(d.butcher), f32(unstacked * f32(1.0 + f32(5 * f32(0.03)))));
  d.butcher.motion.x = 9000.0;
  step(d, ["none", "none"]);
  assertEquals(d.butcher.status.stacks, 0);
});

function replayFrom(setup: Setup, script: Script, end: number, saveTick: number): { readonly expected: string; readonly replayed: string } {
  const run = duel(setup);
  const snapshot = createReplaySnapshot();
  for (let tick = 1; tick <= end; tick++) {
    if (tick === saveTick) copyReplayState(snapshot, run.state);
    step(run, script(tick));
  }
  const expected = canonicalState(run.state);
  copyReplayState(run.state, snapshot);
  run.tick = saveTick - 1;
  for (let tick = saveTick; tick <= end; tick++) step(run, script(tick));
  return { expected, replayed: canonicalState(run.state) };
}

interface Scene {
  readonly setup: Setup;
  readonly script: Script;
  readonly end: number;
  readonly saves: readonly number[];
  readonly shows: (d: Readonly<Duel>) => boolean;
}

const SCENES: readonly Scene[] = [
  { setup: { foeAhead: 300.0 }, script: hookScript, end: 100, saves: [10, 20, 30, 40, 62, 80], shows: (d) => d.foe.grab.reel > 0 },
  { setup: { foeAhead: 300.0 }, script: hookScript, end: 100, saves: [62, 75], shows: (d) => d.butcher.status.stacks > 0 },
  { setup: { foeAhead: -300.0, offstage: true }, script: (tick) => [tick === 2 ? "swing" : "none", "none"], end: SWING_END, saves: [3, 10, 16, 24], shows: (d) => d.butcher.ledge.state === LedgeState.tether },
  { setup: { foeAhead: 120.0 }, script: (tick) => [tick === ROT_ON || tick === 63 ? "rot" : "none", "none"], end: 90, saves: [5, 30, 64], shows: (d) => d.butcher.status.aura && d.foe.status.slowFrames > 0 },
  { setup: { foeAhead: 150.0, ultimates: true }, script: (tick) => [tick === 3 ? "dismember" : "none", "none"], end: 160, saves: [20, 40, 90, 130], shows: (d) => d.foe.grab.owner === 0 && d.butcher.special.grabFrame > 0 },
];

test("A rollback replays Meat Hook's latch and reel, the Hook Swing ledge tether, the Rot toggle, Flesh Heap stacks and a Dismember channel to the live checksum [k1 scenario]", () => {
  for (const scene of SCENES) {
    const live = duel(scene.setup);
    let shown = false;
    for (let tick = 1; tick <= scene.end; tick++) {
      step(live, scene.script(tick));
      shown ||= scene.shows(live);
    }
    assertTrue(shown);
    for (const save of scene.saves) {
      const { expected, replayed } = replayFrom(scene.setup, scene.script, scene.end, save);
      assertEquals(replayed, expected);
    }
  }
});
