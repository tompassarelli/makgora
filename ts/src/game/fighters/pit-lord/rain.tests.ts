import { assertEquals, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Action, maskOf } from "../../input/actions";
import { adaptInput } from "../../match/inputAdapter";
import { inputRow } from "../../input/inputRow";
import { Phase } from "../../lobby/lobbyState";
import { stepMatch } from "../../match/step";
import { canonicalState } from "../../replay/canonical";
import { copyReplayState, createReplaySnapshot, type ReplayState } from "../../replay/snapshot";
import { copyFighterState } from "../../../generated/state/fighterState";
import { Character, SpecialAction } from "../../sim/codes";
import { createFighter, type Fighter } from "../../sim/fighter";
import { setWorldMotionValue } from "../../sim/motion";
import { fighterAt } from "../../sim/roster";
import { HERO_REFERENCE_HEIGHT } from "../../sim/heroMoves";
import { floorBelow, surfaceLeft, surfaceRight, surfaceZ } from "../../sim/stage";
import { METEOR_HIT, RAIN_CHANNEL, RAIN_END, RAIN_LANDINGS } from "./specials";

const WAVE = RAIN_CHANNEL.last - RAIN_CHANNEL.first + 1;
const WAVES = RAIN_CHANNEL.rewinds + 1;
const IN_RAIN = f32(HERO_REFERENCE_HEIGHT * f32(2.15));

type Press = "press" | "hold" | "attack" | "none";

interface Duel {
  readonly state: ReplayState;
  readonly pitLord: Fighter;
  readonly foe: Fighter;
  tick: number;
}

function duel(foeAhead: number, foe: Character = Character.rifleman): Duel {
  const state = createReplaySnapshot();
  const pitLord = fighterAt(state.world, 0);
  const other = fighterAt(state.world, 1);
  copyFighterState(pitLord, createFighter(Character.pitLord, 0.0, 1), 3);
  copyFighterState(other, createFighter(foe, foeAhead, foeAhead > 0.0 ? -1 : 1), 3);
  state.match.phase = Phase.match;
  state.match.stageChoice = 0;
  state.match.matchSeed = 1;
  state.match.hazards = false;
  state.match.items.on = false;
  state.match.timeLimitMinutes = 0;
  state.match.ultimatesOff = true;
  return { state, pitLord, foe: other, tick: 0 };
}

const DOWN_SPECIAL = maskOf(Action.special) | maskOf(Action.moveDown);
const PRESSES: Readonly<Record<Press, { readonly held: number; readonly pressed: number; readonly axisZ?: number; readonly specialZ?: number }>> = {
  press: { held: DOWN_SPECIAL, pressed: maskOf(Action.special), axisZ: -127, specialZ: -1 },
  hold: { held: maskOf(Action.special), pressed: 0 },
  attack: { held: maskOf(Action.attack), pressed: maskOf(Action.attack) },
  none: { held: 0, pressed: 0 },
};

function step(d: Duel, press: Press, foe: Press = "none"): void {
  d.tick++;
  const own = inputRow(PRESSES[press]);
  const other = inputRow(PRESSES[foe]);
  if (own === undefined || other === undefined) throw new Error("Rain of Fire input row");
  adaptInput(own, d.pitLord, d.tick, d.state.controls.inputs[0], d.state.controls.commands[0]);
  adaptInput(other, d.foe, d.tick, d.state.controls.inputs[1], d.state.controls.commands[1]);
  stepMatch(d.state.match, d.state.world, d.state.controls, d.tick);
}

function cast(d: Duel, heldFor: number, until = (_: Duel): boolean => false): number {
  step(d, "press");
  let frames = 1;
  while (d.pitLord.special.action === SpecialAction.heroDown && frames < 400 && !until(d)) {
    step(d, frames < heldFor ? "hold" : "none");
    frames++;
  }
  return frames;
}

const meteorsLive = (f: Readonly<Fighter>): number => f.projectiles.filter(p => p.life > 0 && p.spec?.effect.damage === METEOR_HIT.damage).length;
const meteorsUnarmed = (f: Readonly<Fighter>): number => f.projectiles.filter(p => p.life > 0 && p.spec?.effect.damage === METEOR_HIT.damage && p.spec.life - p.life < (p.spec.activeFrom ?? 0)).length;

test("Held, Rain of Fire roots Pit Lord and calls a wave of three meteors every 18 frames, four waves at most, then 22 frames of recovery [k1 scenario]", () => {
  const d = duel(IN_RAIN);
  const x = d.pitLord.motion.x;
  const frames = cast(d, 400);
  assertEquals(d.pitLord.special.refires, RAIN_CHANNEL.rewinds);
  assertEquals(frames, RAIN_CHANNEL.first - 1 + WAVES * WAVE + RAIN_END - RAIN_CHANNEL.last);
  assertEquals(d.pitLord.motion.x, x, "the channel roots him");
  assertGreaterThan(d.foe.status.damage, f32(2.0 * WAVES * METEOR_HIT.damage) - f32(0.01));
  assertTrue(d.foe.status.damage <= f32(RAIN_LANDINGS.length * WAVES * METEOR_HIT.damage));
});

test("Tapped, Rain of Fire calls one wave; released mid-channel, it skips straight to recovery and the called wave still lands [k1 scenario]", () => {
  const tap = duel(IN_RAIN);
  assertEquals(cast(tap, 1), RAIN_END);
  assertEquals(tap.pitLord.special.refires, 0);
  const release = duel(IN_RAIN);
  const releasedOn = RAIN_CHANNEL.first + WAVE + 6;
  const frames = cast(release, releasedOn);
  assertEquals(release.pitLord.special.refires, 1);
  assertEquals(frames, releasedOn + RAIN_END - RAIN_CHANNEL.last);
  assertEquals(release.foe.status.damage, f32(2.0 * RAIN_LANDINGS.length * METEOR_HIT.damage), "both called waves land in full on a foe left standing");
});

test("A struck Pit Lord stops channelling and the meteors not yet harmful vanish [k1 scenario]", () => {
  const d = duel(70.0, Character.peon);
  step(d, "press");
  for (let frame = 1; frame < RAIN_CHANNEL.first + 4; frame++) step(d, "hold");
  assertGreaterThan(meteorsLive(d.pitLord), 0);
  for (let frame = 0; frame < 6 && d.pitLord.launch.hitstun === 0; frame++) step(d, "hold", frame === 0 ? "attack" : "none");
  assertGreaterThan(d.pitLord.launch.hitstun, 0);
  assertEquals(d.pitLord.special.action, SpecialAction.none);
  assertEquals(meteorsUnarmed(d.pitLord), 0);
});

test("In the air Rain of Fire calls one wave even when held [k1 scenario]", () => {
  const d = duel(IN_RAIN);
  d.pitLord.motion.z = 700.0;
  d.pitLord.motion.vz = 0.0;
  d.pitLord.motion.grounded = false;
  d.pitLord.motion.surface = undefined;
  setWorldMotionValue(d.pitLord.motion.meleeZ, d.pitLord.motion.z);
  setWorldMotionValue(d.pitLord.motion.meleeVelocityZ, d.pitLord.motion.vz);
  cast(d, 400);
  assertEquals(d.pitLord.special.refires, 0);
  assertLessThan(d.foe.status.damage, f32(RAIN_LANDINGS.length * METEOR_HIT.damage) + f32(0.01));
});

const replayPress = (releaseTick: number) => (tick: number): Press => tick === 3 ? "press" : tick > 3 && tick < releaseTick ? "hold" : "none";
const foeJabs = (jabTick: number) => (tick: number): Press => tick === jabTick ? "attack" : "none";

function replayFrom(foeAhead: number, saveTick: number, own: (tick: number) => Press, foe: (tick: number) => Press): { readonly expected: string; readonly replayed: string } {
  const end = 160;
  const run = duel(foeAhead, Character.peon);
  const snapshot = createReplaySnapshot();
  for (let tick = 1; tick <= end; tick++) {
    if (tick === saveTick) copyReplayState(snapshot, run.state);
    step(run, own(tick), foe(tick));
  }
  const expected = canonicalState(run.state);
  copyReplayState(run.state, snapshot);
  run.tick = saveTick - 1;
  for (let tick = saveTick; tick <= end; tick++) step(run, own(tick), foe(tick));
  return { expected, replayed: canonicalState(run.state) };
}

test("A rollback replays a held, a released and an interrupted Rain of Fire channel to the live state [k1 scenario]", () => {
  for (const save of [RAIN_CHANNEL.first + 4, RAIN_CHANNEL.first + WAVE + 2]) {
    const held = replayFrom(IN_RAIN, save, replayPress(400), foeJabs(0));
    assertEquals(held.replayed, held.expected, `held, saved on tick ${save}`);
    const released = replayFrom(IN_RAIN, save, replayPress(RAIN_CHANNEL.first + WAVE + 8), foeJabs(0));
    assertEquals(released.replayed, released.expected, `released, saved on tick ${save}`);
  }
  const interrupted = replayFrom(70.0, RAIN_CHANNEL.first, replayPress(400), foeJabs(RAIN_CHANNEL.first + 6));
  assertEquals(interrupted.replayed, interrupted.expected, "interrupted");
});

const FIRE_BURST = "FireLordDeathExplode";

function standOn(d: Duel, stage: number, surface: number, x: number, facing: number): void {
  const z = surfaceZ(stage, surface, 0);
  d.state.match.stageChoice = stage;
  d.pitLord.motion.x = x;
  d.pitLord.motion.z = z;
  d.pitLord.motion.vx = 0.0;
  d.pitLord.motion.vz = 0.0;
  d.pitLord.motion.grounded = true;
  d.pitLord.motion.surface = surface;
  d.pitLord.facing = facing;
  setWorldMotionValue(d.pitLord.motion.meleeZ, z);
  setWorldMotionValue(d.pitLord.motion.meleeVelocityZ, 0.0);
}

function impactHeights(d: Duel, stage: number): number[] {
  const gaps: number[] = [];
  const seen = new Set<number>();
  const standingZ = d.pitLord.motion.z;
  step(d, "press");
  for (let frame = 1; frame < RAIN_END + 20 && d.pitLord.special.action === SpecialAction.heroDown; frame++) {
    step(d, frame < RAIN_CHANNEL.first + 8 ? "hold" : "none");
    d.pitLord.projectiles.forEach((p, index) => {
      if (p.life <= 0 || p.spec?.model?.includes(FIRE_BURST) !== true || seen.has(index * 1000 + p.life)) return;
      seen.add(index * 1000 + p.life);
      const floor = floorBelow(stage, d.tick, p.x, standingZ);
      gaps.push(floor === undefined ? Number.NaN : f32(p.z - floor));
    });
  }
  return gaps;
}

test("Rain of Fire's impact burst and burning patch sit on the floor the meteors land on, on the main deck and on a platform, facing either way [k1 scenario]", () => {
  const platform = { left: surfaceLeft(1, 1, 0), right: surfaceRight(1, 1, 0) };
  const scenes: readonly (readonly [string, number, number, number, number])[] = [
    ["main deck right", 0, 0, 0.0, 1],
    ["main deck left", 0, 0, 0.0, -1],
    ["platform centre", 1, 1, (platform.left + platform.right) / 2, 1],
    ["platform right edge facing out", 1, 1, platform.right - 4.0, 1],
    ["right platform left edge facing the gap", 1, 2, surfaceLeft(1, 2, 0) + 4.0, -1],
  ];
  const off: string[] = [];
  for (const [name, stage, surface, x, facing] of scenes) {
    const d = duel(-IN_RAIN * facing, Character.peon);
    standOn(d, stage, surface, x, facing);
    const gaps = impactHeights(d, stage);
    if (gaps.length === 0) off.push(`${name}: no meteor burst`);
    for (const gap of gaps) if (!(Math.abs(gap) < f32(0.001))) off.push(`${name}: ${gap}`);
  }
  assertEquals(off.join("; "), "", "bursts off the floor");
});
