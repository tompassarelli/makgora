import { assertDefined, assertEquals, assertFalse, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Action, maskOf } from "../input/actions";
import { adaptInput } from "../match/inputAdapter";
import { inputRow } from "../input/inputRow";
import { Phase } from "../lobby/lobbyState";
import { stepMatch } from "../match/step";
import { createReplaySnapshot, type ReplayState } from "../replay/snapshot";
import { copyFighterState } from "../../generated/state/fighterState";
import { Character } from "./codes";
import { applyCurse, curseOf, summonAlive } from "./curses";
import { createFighter, type Fighter, placedObject } from "./fighter";
import { fillMeter } from "./meter";
import { setWorldMotionValue } from "./motion";
import { fighterAt } from "./roster";
import { CompanionMode, type SpecialCurse } from "./specials/schema";
import { surfaceRight, surfaceZAt } from "./stage";

const ULTIMATE = maskOf(Action.attack, Action.special);
const FOE_AHEAD = 60.0;
const PIT_LORD_SLOT = 0;
const FOE_SLOT = 1;
const OFF_STAGE = 5000.0;
const READABLE_WIND_UP = 20;

interface Duel {
  readonly state: ReplayState;
  readonly pitLord: Fighter;
  readonly foe: Fighter;
  readonly doom: SpecialCurse;
  tick: number;
}

function duel(foeX = FOE_AHEAD): Duel {
  const state = createReplaySnapshot();
  const pitLord = fighterAt(state.world, PIT_LORD_SLOT);
  const foe = fighterAt(state.world, FOE_SLOT);
  copyFighterState(pitLord, createFighter(Character.pitLord, 0.0, 1), 3);
  copyFighterState(foe, createFighter(Character.warden, foeX, -1), 3);
  state.match.phase = Phase.match;
  state.match.stageChoice = 0;
  state.match.matchSeed = 503;
  state.match.hazards = false;
  state.match.items.on = false;
  state.match.timeLimitMinutes = 0;
  fillMeter(pitLord);
  return { state, pitLord, foe, doom: assertDefined(curseOf(pitLord), "Doom's curse"), tick: 0 };
}

function step(d: Duel, pressed = 0): void {
  d.tick++;
  const row = inputRow({ held: pressed, pressed });
  if (row === undefined) throw new Error("Doom input row");
  adaptInput(row, d.pitLord, d.tick, d.state.controls.inputs[PIT_LORD_SLOT], d.state.controls.commands[PIT_LORD_SLOT]);
  stepMatch(d.state.match, d.state.world, d.state.controls, d.tick);
}

function steps(d: Duel, count: number): void {
  for (let frame = 0; frame < count; frame++) step(d);
}

function moveTo(f: Fighter, x: number, z: number): void {
  f.motion.x = x;
  f.motion.z = z;
  setWorldMotionValue(f.motion.meleeX, x);
  setWorldMotionValue(f.motion.meleeZ, z);
}

function loseStock(d: Duel, f: Fighter, x = OFF_STAGE): void {
  const stocks = f.status.stocks;
  moveTo(f, x, f.motion.z);
  step(d);
  assertTrue(f.status.out);
  assertEquals(f.status.stocks, stocks - 1);
}

function guard(d: Duel): ReturnType<typeof placedObject> {
  return placedObject(d.pitLord, d.doom.summon.slot ?? 0);
}

function cursedDuel(): Duel {
  const d = duel();
  applyCurse(d.foe, PIT_LORD_SLOT);
  return d;
}

test("Doom's bolt deals its fire hit and leaves the foe cursed by the Pit Lord [k1 scenario]", () => {
  const d = duel();
  step(d, ULTIMATE);
  for (let frame = 0; frame < 120 && d.foe.status.cursedBy === undefined; frame++) step(d);
  assertEquals(d.foe.status.cursedBy, PIT_LORD_SLOT);
  assertGreaterThan(d.foe.status.damage, 9.0);
});

test("The curse burns exactly 1% each 60 frames and never stops on its own, past the old 3-second poison [k1 scenario]", () => {
  const d = cursedDuel();
  const before = d.foe.status.damage;
  steps(d, 59);
  assertEquals(d.foe.status.damage, before);
  step(d);
  assertEquals(d.foe.status.damage, f32(before + 1.0));
  steps(d, 1140);
  assertEquals(d.foe.status.damage, f32(before + 20.0));
  assertEquals(d.foe.status.cursedBy, PIT_LORD_SLOT);
});

test("Dooming a doomed foe again neither stacks the burn nor restarts its count [k1 scenario]", () => {
  const d = cursedDuel();
  steps(d, 30);
  applyCurse(d.foe, PIT_LORD_SLOT);
  assertEquals(d.foe.status.curseFrames, 30);
  const before = d.foe.status.damage;
  steps(d, 30);
  assertEquals(d.foe.status.damage, f32(before + 1.0));
});

test("The victim's stock loss lifts the curse, and the respawned victim stops burning [k1 scenario]", () => {
  const d = cursedDuel();
  loseStock(d, d.foe);
  assertEquals(d.foe.status.cursedBy, undefined);
  steps(d, 170);
  assertFalse(d.foe.status.out);
  assertEquals(d.foe.status.damage, 0.0);
});

test("The Pit Lord losing a stock first lifts his curse and no Doom Guard comes [k1 scenario]", () => {
  const d = cursedDuel();
  loseStock(d, d.pitLord);
  assertEquals(d.foe.status.cursedBy, undefined);
  loseStock(d, d.foe);
  assertEquals(d.pitLord.status.summonFrames, 0);
  steps(d, 240);
  assertFalse(guard(d).life > 0);
});

test("A Doom Guard steps out of a fel portal exactly 60 frames after the doomed foe's stock loss, as they respawn, on the main deck nearest where they fell [k1 scenario]", () => {
  const d = cursedDuel();
  loseStock(d, d.foe);
  const lost = d.tick;
  while (d.tick < lost + d.doom.summonDelay - 1) {
    step(d);
    assertFalse(guard(d).life > 0);
  }
  step(d);
  assertEquals(d.tick - lost, 60);
  const placed = guard(d);
  assertTrue(summonAlive(d.pitLord, d.doom));
  assertEquals(placed.mode, CompanionMode.stunned);
  const frame = d.state.match.matchFrame;
  const x = f32(surfaceRight(0, 0, frame) - Math.max(d.doom.summon.radius, d.doom.summon.companion?.bite.radius ?? 0.0));
  assertEquals(placed.x, x);
  assertEquals(placed.z, surfaceZAt(0, 0, frame, x));
  assertEquals(placed.durability, d.doom.summon.durability);
  assertTrue(d.pitLord.projectiles.some(shot => shot.life > 0 && shot.spec === d.doom.portal));
});

test("Only one Doom Guard at a time: a second doomed stock loss while one is out summons nothing more [k1 scenario]", () => {
  const d = cursedDuel();
  loseStock(d, d.foe);
  steps(d, d.doom.summonDelay);
  assertTrue(summonAlive(d.pitLord, d.doom));
  const serial = guard(d).serial;
  steps(d, 60);
  applyCurse(d.foe, PIT_LORD_SLOT);
  loseStock(d, d.foe, -OFF_STAGE);
  assertEquals(d.pitLord.status.summonFrames, 0);
  assertEquals(guard(d).serial, serial);
});

test("The Doom Guard despawns when the Pit Lord loses a stock, and otherwise leaves when its life runs out [k1 scenario]", () => {
  const d = cursedDuel();
  loseStock(d, d.foe);
  steps(d, d.doom.summonDelay);
  assertTrue(summonAlive(d.pitLord, d.doom));
  loseStock(d, d.pitLord);
  assertFalse(guard(d).life > 0);

  const e = cursedDuel();
  loseStock(e, e.foe);
  steps(e, e.doom.summonDelay);
  steps(e, e.doom.summon.life - 2);
  assertTrue(guard(e).life > 0);
  step(e);
  assertFalse(guard(e).life > 0);
});

test("The Doom Guard threatens the returning victim without a cheap hit: its first cleave lands only after its arrival and wind-up [k1 scenario]", () => {
  const d = cursedDuel();
  loseStock(d, d.foe);
  steps(d, d.doom.summonDelay);
  const arrived = d.tick;
  const placed = guard(d);
  const companion = assertDefined(d.doom.summon.companion, "the Doom Guard's fighting");
  moveTo(d.pitLord, -400.0, 0.0);
  moveTo(d.foe, f32(placed.x - 100.0), placed.z);
  const before = d.foe.status.damage;
  let swing = -1;
  while (d.foe.status.damage === before && d.tick < arrived + 240) {
    step(d);
    if (swing < 0 && guard(d).mode === CompanionMode.lunge) swing = d.tick;
  }
  assertGreaterThan(d.foe.status.damage, before);
  assertTrue(swing - arrived >= companion.stunFrames);
  assertTrue(d.tick - swing >= READABLE_WIND_UP);
});
