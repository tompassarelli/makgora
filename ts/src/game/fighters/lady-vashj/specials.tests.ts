import { assertEquals, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { imod } from "wisp/src/sim/intMath";
import { Action, maskOf } from "../../input/actions";
import { adaptInput } from "../../match/inputAdapter";
import { inputRow } from "../../input/inputRow";
import { Phase } from "../../lobby/lobbyState";
import { stepMatch } from "../../match/step";
import { canonicalState } from "../../replay/canonical";
import { copyReplayState, createReplaySnapshot, type ReplayState } from "../../replay/snapshot";
import { copyFighterState } from "../../../generated/state/fighterState";
import { Character, HeroStatusKind, ProjectileKind } from "../../sim/codes";
import { createFighter, type Fighter } from "../../sim/fighter";
import { fighterAt } from "../../sim/roster";
import { ULTIMATE_METER_FRAMES } from "../../sim/meter";
import { MANA_SHIELD_FRAMES_PER_PERCENT } from "../../sim/manaShield";

type Press = "shield" | "serpent" | "jab" | "none";
type Script = (tick: number) => readonly [Press, Press];

interface Duel {
  readonly state: ReplayState;
  readonly vashj: Fighter;
  readonly foe: Fighter;
  tick: number;
}

const ROWS: Readonly<Record<Press, Parameters<typeof inputRow>[0]>> = {
  shield: { held: maskOf(Action.moveDown, Action.special), pressed: maskOf(Action.special), axisZ: -127, specialZ: -1 },
  serpent: { held: maskOf(Action.moveRight, Action.special), pressed: maskOf(Action.special), axisX: 127, specialX: 1 },
  jab: { held: maskOf(Action.attack), pressed: maskOf(Action.attack) },
  none: {},
};

function duel(foeAhead: number, charge: number): Duel {
  const state = createReplaySnapshot();
  const vashj = fighterAt(state.world, 0);
  const foe = fighterAt(state.world, 1);
  copyFighterState(vashj, createFighter(Character.ladyVashj, 0.0, 1), 3);
  copyFighterState(foe, createFighter(Character.medivh, foeAhead, -1), 3);
  vashj.meter.ultimate = charge;
  foe.meter.ultimate = ULTIMATE_METER_FRAMES;
  state.match.phase = Phase.match;
  state.match.stageChoice = 0;
  state.match.matchSeed = 1;
  state.match.hazards = false;
  state.match.items.on = false;
  state.match.timeLimitMinutes = 0;
  state.match.ultimatesOff = true;
  return { state, vashj, foe, tick: 0 };
}

function step(d: Duel, [own, other]: readonly [Press, Press]): void {
  d.tick++;
  const first = inputRow(ROWS[own]);
  const second = inputRow(ROWS[other]);
  if (first === undefined || second === undefined) throw new Error("Lady Vashj input row");
  adaptInput(first, d.vashj, d.tick, d.state.controls.inputs[0], d.state.controls.commands[0]);
  adaptInput(second, d.foe, d.tick, d.state.controls.inputs[1], d.state.controls.commands[1]);
  stepMatch(d.state.match, d.state.world, d.state.controls, d.tick);
}

const SHIELD_END = 520;
const SHIELD_CHARGE = 300;
const shieldScript: Script = (tick) => [
  tick === 3 || tick === 440 || tick === 480 ? "shield" : "none",
  tick >= 30 && tick < 400 && imod(tick, 40) === 30 ? "jab" : "none",
];

const SERPENT_END = 160;
const serpentScript: Script = (tick) => [tick === 3 ? "serpent" : "none", "none"];

function serpent(f: Readonly<Fighter>) {
  return f.projectiles.find((projectile) => projectile.life > 0 && projectile.kind === ProjectileKind.hero && projectile.spec?.bounce !== undefined);
}

function serpentTick(reached: (live: ReturnType<typeof serpent>) => boolean): number {
  const d = duel(200.0, 0);
  for (let tick = 1; tick <= SERPENT_END; tick++) {
    step(d, serpentScript(tick));
    if (reached(serpent(d.vashj))) return tick;
  }
  return SERPENT_END;
}

function replayFrom(foeAhead: number, charge: number, script: Script, end: number, saveTick: number): { readonly expected: string; readonly replayed: string } {
  const run = duel(foeAhead, charge);
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

test("Mana Shield turns on, takes half of each hit from her ultimate meter, breaks into a stagger when the meter runs dry, and turns off again [k3 measure docs/design/lady-vashj.md]", () => {
  const d = duel(60.0, SHIELD_CHARGE);
  let firstHit: { readonly percent: number; readonly meter: number } | undefined;
  let broke = false;
  let staggered = false;
  let heldWhileOn = true;
  for (let tick = 1; tick <= SHIELD_END; tick++) {
    const meter = d.vashj.meter.ultimate;
    const percent = d.vashj.status.damage;
    const on = d.vashj.status.manaShield;
    step(d, shieldScript(tick));
    if (on && d.vashj.status.manaShield && d.vashj.meter.ultimate > meter) heldWhileOn = false;
    if (firstHit === undefined && on && d.vashj.status.damage > percent) firstHit = { percent: d.vashj.status.damage - percent, meter: meter - d.vashj.meter.ultimate };
    if (on && !d.vashj.status.manaShield && tick < 440) broke = true;
    if (broke && d.vashj.status.condition === HeroStatusKind.stun) staggered = true;
    if (tick === 460) assertTrue(d.vashj.status.manaShield);
  }
  assertTrue(firstHit !== undefined);
  if (firstHit !== undefined) {
    assertGreaterThan(firstHit.meter, 0);
    assertLessThan(Math.abs(firstHit.percent * MANA_SHIELD_FRAMES_PER_PERCENT - firstHit.meter), 1.5);
  }
  assertTrue(heldWhileOn);
  assertTrue(broke);
  assertTrue(staggered);
  assertEquals(d.vashj.status.manaShield, false);
});

test("Tidal Serpent drains 108 frames of the foe's ultimate meter, turns back with no other foe, and gives her nothing on the catch [k3 measure docs/design/lady-vashj.md]", () => {
  const d = duel(200.0, 0);
  let drained = 0;
  let caught = false;
  let homeward = false;
  for (let tick = 1; tick <= SERPENT_END; tick++) {
    const foeBefore = d.foe.meter.ultimate;
    const wasHomeward = serpent(d.vashj)?.homeward === true;
    step(d, serpentScript(tick));
    const live = serpent(d.vashj);
    if (foeBefore > d.foe.meter.ultimate) {
      drained += foeBefore - d.foe.meter.ultimate;
      homeward = live?.homeward === true;
    }
    if (wasHomeward && live === undefined) caught = true;
  }
  assertEquals(drained, 108);
  assertTrue(homeward);
  assertTrue(caught);
  assertEquals(d.vashj.meter.ultimate, 0);
});

test("A rollback replays Mana Shield on, through a break and off to the live checksum [k1 scenario]", () => {
  for (const save of [10, 100, 250, 450]) {
    const replay = replayFrom(60.0, SHIELD_CHARGE, shieldScript, SHIELD_END, save);
    assertEquals(replay.replayed, replay.expected);
  }
});

test("A rollback replays Tidal Serpent through a drain and a catch to the live checksum [k1 scenario]", () => {
  for (const save of [10, serpentTick((live) => live !== undefined) + 1, 30, serpentTick((live) => live?.homeward === true) + 2, 60, 90]) {
    const replay = replayFrom(200.0, 0, serpentScript, SERPENT_END, save);
    assertEquals(replay.replayed, replay.expected);
  }
});
