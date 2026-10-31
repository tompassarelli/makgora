import { assertEquals, assertGreaterThan, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Action, maskOf } from "../../input/actions";
import { inputRow } from "../../input/inputRow";
import { adaptInput } from "../../match/inputAdapter";
import { stepMatch } from "../../match/step";
import { canonicalState } from "../../replay/canonical";
import { copyReplayState, createReplaySnapshot } from "../../replay/snapshot";
import { copyFighterState } from "../../../generated/state/fighterState";
import { Character, ProjectileKind, SpecialAction } from "../../sim/codes";
import { createFighter, type Fighter, mutablePlacedObject, placedObject } from "../../sim/fighter";
import { setWorldMotionValue } from "../../sim/motion";
import { fighterAt, setRosterMask } from "../../sim/roster";
import { type Duel, duel } from "./testDuel";
import { FIREBALL_SPEED, LAVA_SPAWN, LAVA_SPAWN_HALF, SPAWN_CAST_FRAME, SPAWN_FIRST_SHOT, SPAWN_LIFE, SPAWN_SPLIT_HITS } from "./lavaSpawn";

const FAR_AWAY = 3000.0;
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
const fireballs = (f: Readonly<Fighter>) => f.projectiles.filter((shot) => shot.life > 0 && shot.kind === ProjectileKind.hero);

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

test("Summon Lava Spawn puts one spawn out, in the first slot only, and it is gone 720 frames after it lands [k3 measure docs/design/roster.md]", () => {
  const d = summoned(FAR_AWAY, true);
  assertEquals(spawn(d, 0).life, SPAWN_LIFE - 1, "alive at the placing tick");
  assertEquals(alive(d), 1);
  assertEquals(spawn(d, 0).spec, LAVA_SPAWN);
  for (let frame = 0; frame < SPAWN_LIFE - 2; frame++) {
    step(d);
    assertEquals(alive(d), 1, `one spawn at frame ${frame}`);
  }
  assertEquals(spawn(d, 0).life, 1);
  step(d);
  assertEquals(alive(d), 0, "gone when the 720 frames end");
});

test("Pressing neutral B while the spawn is out does nothing and leaves its life, age and serial as they were [k3 measure docs/design/roster.md]", () => {
  const d = summoned(FAR_AWAY, true);
  for (let frame = 0; frame < 40; frame++) step(d);
  const before = { life: spawn(d, 0).life, age: spawn(d, 0).age, serial: spawn(d, 0).serial };
  for (let frame = 0; frame < 60; frame++) {
    step(d, frame === 0 ? "press" : "none");
    assertEquals(d.caster.special.action, SpecialAction.none, "no cast starts");
  }
  assertEquals(spawn(d, 0).serial, before.serial);
  assertEquals(spawn(d, 0).life, before.life - 60, "life keeps counting down");
  assertEquals(spawn(d, 0).age, before.age + 60);
  assertEquals(alive(d), 1);
});

function threeFoes(ahead: number, behind: number, high: number): Duel {
  const d = duel(ahead);
  setRosterMask(d.state.world, 7);
  const third = fighterAt(d.state.world, 2);
  copyFighterState(third, createFighter(Character.peon, f32(-behind), 1), 3);
  third.motion.z = high;
  setWorldMotionValue(third.motion.meleeZ, high);
  step(d, "press");
  for (let guard = 0; guard < 60 && spawn(d, 0).life <= 0; guard++) step(d, "hold");
  for (let frame = 0; frame < SPAWN_FIRST_SHOT + 1 && fireballs(d.caster).length === 0; frame++) step(d);
  return d;
}

test("The spawn's fireball flies at the nearest foe, behind it or ahead, and rises toward a foe above [k3 measure docs/design/roster.md]", () => {
  const shotBehind = fireballs(threeFoes(900.0, 250.0, 0.0).caster)[0];
  assertEquals(shotBehind !== undefined && shotBehind.velocityX < 0.0, true, "flies backward at the nearer foe behind");
  const shotAhead = fireballs(threeFoes(250.0, 900.0, 0.0).caster)[0];
  assertEquals(shotAhead !== undefined && shotAhead.velocityX > 0.0, true, "flies forward at the nearer foe ahead");
  const above = fireballs(threeFoes(FAR_AWAY, 300.0, 250.0).caster)[0];
  assertEquals(above !== undefined && above.velocityZ > 0.0, true, "rises toward the foe above");
  if (shotBehind === undefined) return;
  const squared = f32(f32(shotBehind.velocityX * shotBehind.velocityX) + f32(shotBehind.velocityZ * shotBehind.velocityZ));
  assertEquals(Math.abs(f32(squared - f32(FIREBALL_SPEED * FIREBALL_SPEED))) < f32(0.01), true, `speed squared ${squared}`);
});

function landNext(preloaded: number): Duel {
  const d = summoned(IN_RANGE);
  mutablePlacedObject(d.caster).hits = preloaded;
  const foeX = d.foe.motion.x;
  for (let frame = 0; frame < 200 && spawn(d, 0).hits === preloaded && alive(d) === 1; frame++) {
    step(d);
    pinFoe(d, foeX);
  }
  return d;
}

test("A spawn splits once, into exactly two, when its fifth fireball lands, and not on the fourth [k3 measure docs/design/roster.md]", () => {
  const fourth = landNext(SPAWN_SPLIT_HITS - 2);
  assertEquals(alive(fourth), 1, "four landed hits do not split it");
  assertEquals(spawn(fourth, 0).hits, SPAWN_SPLIT_HITS - 1);
  const fifth = landNext(SPAWN_SPLIT_HITS - 1);
  step(fifth);
  assertEquals(alive(fifth), 2, "the fifth splits it into two");
  assertEquals(spawn(fifth, 0).spec, LAVA_SPAWN_HALF);
  assertEquals(spawn(fifth, 1).spec, LAVA_SPAWN_HALF);
  assertEquals(spawn(fifth, 0).life, spawn(fifth, 1).life, "the two share the remaining life");
  assertGreaterThan(spawn(fifth, 0).life, 0);
  assertEquals(spawn(fifth, 0).life < SPAWN_LIFE - SPAWN_CAST_FRAME, true, "life already spent stays spent");
  assertEquals(Math.abs(f32(spawn(fifth, 1).x - spawn(fifth, 0).x)) > 0.0, true, "they stand apart");
});

test("The halves never split again, however many of their fireballs land [k3 measure docs/design/roster.md]", () => {
  const d = landNext(SPAWN_SPLIT_HITS - 1);
  step(d);
  const foeX = d.foe.motion.x;
  for (let frame = 0; frame < 450; frame++) {
    step(d);
    pinFoe(d, foeX);
    assertEquals(alive(d) <= 2, true, "never more than two");
  }
  assertEquals(spawn(d, 0).hits + spawn(d, 1).hits, 0, "a half counts no hits");
  assertGreaterThan(d.foe.status.damage, 40.0);
});

test("The spawn holds its fire while its owner is in hitstun or in a grab [k3 measure docs/design/roster.md]", () => {
  for (const hold of [(d: Duel) => { d.caster.launch.hitstun = 5; }, (d: Duel) => { d.caster.grab.grabbedFrames = 5; }]) {
    const d = summoned(IN_RANGE);
    for (let frame = 0; frame < SPAWN_FIRST_SHOT + 30; frame++) {
      hold(d);
      step(d);
      assertEquals(fireballs(d.caster).length, 0, `no fireball at frame ${frame}`);
    }
  }
});

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
