import { assertEquals, test } from "wisp/src/runtime/testing";
import { Action, maskOf } from "../../input/actions";
import { inputRow } from "../../input/inputRow";
import { adaptInput } from "../../match/inputAdapter";
import { stepMatch } from "../../match/step";
import { canonicalState } from "../../replay/canonical";
import { copyReplayState, createReplaySnapshot } from "../../replay/snapshot";
import { mutablePlacedObject, placedObject } from "../../sim/fighter";
import { setWorldMotionValue } from "../../sim/motion";
import { type Duel, duel } from "./testDuel";
import { SPAWN_SPLIT_HITS } from "./lavaSpawn";
const IN_RANGE = 350.0;
const PRESS = { held: maskOf(Action.special), pressed: maskOf(Action.special) };
const HOLD = { held: maskOf(Action.special), pressed: 0 };
const NOTHING = { held: 0, pressed: 0 };

const unattended = new WeakSet<Duel>();

function step(d: Duel, press: "press" | "hold" | "none" = "none"): void {
  d.tick++;
  if (unattended.has(d)) d.foe.status.out = true;
  const row = inputRow({ ...(press === "press" ? PRESS : press === "hold" ? HOLD : NOTHING), axisX: 0, axisZ: 0 });
  if (row === undefined) throw new Error("Lava Spawn input row");
  adaptInput(row, d.caster, d.tick, d.state.controls.inputs[0], d.state.controls.commands[0]);
  stepMatch(d.state.match, d.state.world, d.state.controls, d.tick);
}

const spawn = (d: Duel, slot: number) => placedObject(d.caster, slot);
const alive = (d: Duel): number => (spawn(d, 0).life > 0 ? 1 : 0) + (spawn(d, 1).life > 0 ? 1 : 0);

function summoned(foeAhead: number, alone = false): Duel {
  const d = duel(foeAhead);
  if (alone) unattended.add(d);
  step(d, "press");
  for (let guard = 0; guard < 60 && spawn(d, 0).life <= 0; guard++) step(d, "hold");
  return d;
}

function pinFoe(d: Duel, x: number): void {
  const { motion } = d.foe;
  motion.x = x;
  motion.vx = 0.0;
  motion.vz = 0.0;
  setWorldMotionValue(motion.meleeX, x);
}

test("A rollback replays the spawn across its split to the same canonical state, and the split shows in that state [k1 scenario]", () => {
  const frames = 200;
  const run = (saveAt: number): { readonly expected: string; readonly replayed: string; readonly before: string } => {
    const d = summoned(IN_RANGE);
    mutablePlacedObject(d.caster).hits = SPAWN_SPLIT_HITS - 1;
    const foeX = d.foe.motion.x;
    const snapshot = createReplaySnapshot();
    let before = "";
    const play = (from: number): void => {
      for (let tick = from; tick <= frames; tick++) {
        step(d);
        pinFoe(d, foeX);
        if (alive(d) === 1) before = canonicalState(d.state);
      }
    };
    const start = d.tick;
    for (let tick = 1; tick <= frames; tick++) {
      if (tick === saveAt) copyReplayState(snapshot, d.state);
      step(d);
      pinFoe(d, foeX);
      if (alive(d) === 1) before = canonicalState(d.state);
    }
    const expected = canonicalState(d.state);
    copyReplayState(d.state, snapshot);
    d.tick = start + saveAt - 1;
    play(saveAt);
    return { expected, replayed: canonicalState(d.state), before };
  };
  for (const saveAt of [5, 40, 80]) {
    const { expected, replayed, before } = run(saveAt);
    assertEquals(replayed, expected, `saved ${saveAt} frames after the cast`);
    assertEquals(before !== expected, true, "the split changed the state");
  }
});
