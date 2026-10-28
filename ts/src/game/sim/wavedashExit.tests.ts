import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { copyFighterState, sameFighterState } from "../../generated/state/fighterState";
import { SELECTABLE_CHARACTERS } from "../roster/kits";
import { Character, GroundAction } from "./codes";
import { AIR_DODGE_LANDING_LAG } from "./down";
import { type Fighter, createFighter } from "./fighter";
import type { Controls, Roster } from "./roster";
import { controls } from "./testWorld";
import { duelPair, stepDuel } from "./testDuel";

type Stick = (side: number) => Partial<Controls>;
type Lag = (lagFrame: number) => number;

const keyboard: Stick = (side) => ({ direction: side });
const analog = (x: number): Stick => (side) => ({ direction: side, diStickValid: side !== 0, diStickX: f32(side * x) });
const FULL = analog(1.0);
const SMASH = analog(f32(0.85));

interface Run { readonly world: Roster; readonly f: Fighter }

function land(stick: Stick, character: Character = Character.blademaster): Run {
  const { world, owner: f } = duelPair(createFighter(character, -300.0, 1), createFighter(Character.rifleman, 700.0, -1));
  stepDuel(world, controls({ jumpPressed: true, shortHopPressed: true, ...stick(1) }));
  stepDuel(world, controls({ airDodgePressed: true, shield: true, shieldPressed: true, dodgeX: 1, dodgeZ: -1, verticalDirection: -1, ...stick(1) }));
  for (let frame = 0; frame < 60 && f.landing.lag === 0; frame++) stepDuel(world, controls(stick(1)));
  assertEquals(f.landing.lag, AIR_DODGE_LANDING_LAG);
  return { world, f };
}

function sitLag(run: Run, stick: Stick, during: Lag, from = 0): Run {
  for (let lagFrame = from; run.f.landing.lag > 0; lagFrame++) stepDuel(run.world, controls(stick(during(lagFrame))));
  return run;
}

const wavedash = (stick: Stick, during: Lag, character: Character = Character.blademaster): Run => sitLag(land(stick, character), stick, during);

const held: Lag = () => 1;
const repressAt = (lagFrame: number, side: number): Lag => (frame) => frame < lagFrame - 1 ? 1 : frame < lagFrame ? 0 : side;

function walksOut(run: Run, stick: Stick, frames: number): number[] {
  const speeds = [run.f.motion.vx];
  for (let frame = 0; frame < frames; frame++) {
    assertEquals(run.f.ground.action, GroundAction.none);
    assertEquals(run.f.ground.dashFrame, 0);
    stepDuel(run.world, controls(stick(1)));
    speeds.push(run.f.motion.vx);
  }
  return speeds;
}

test("Holding the wavedash direction through its landing lag walks out toward walk speed and never dashes [k1 scenario]", () => {
  for (const character of SELECTABLE_CHARACTERS) {
    for (const stick of [keyboard, FULL]) {
      const run = wavedash(stick, held, character);
      const walkSpeed = run.f.tuning.physics.walkSpeed;
      const toward = run.f.motion.vx < walkSpeed ? 1 : -1;
      const speeds = walksOut(run, stick, 40);
      for (let i = 1; i < speeds.length; i++) {
        const step = f32(((speeds[i] ?? 0) - (speeds[i - 1] ?? 0)) * toward);
        assertTrue(step >= 0.0 && f32(((speeds[i] ?? 0) - walkSpeed) * toward) <= 0.0);
      }
      assertTrue(Math.abs(f32((speeds[speeds.length - 1] ?? 0) - walkSpeed)) <= Math.abs(f32((speeds[0] ?? 0) - walkSpeed)));
    }
  }
});

test("A walk held out of a wavedash slower than walk speed ramps up rather than starting at walk speed [k1 scenario]", () => {
  for (const stick of [keyboard, FULL]) {
    const run = wavedash(stick, held);
    const walkSpeed = run.f.tuning.physics.walkSpeed;
    const speeds = walksOut(run, stick, 30);
    assertTrue((speeds[0] ?? 0) < walkSpeed);
    for (let i = 1; i < speeds.length; i++) assertTrue((speeds[i] ?? 0) > (speeds[i - 1] ?? 0) && (speeds[i] ?? 0) < walkSpeed);
  }
});

test("A fresh press either way during the wavedash landing lag dashes that way on the first actionable frame [k1 scenario]", () => {
  for (const stick of [keyboard, FULL, SMASH]) {
    for (const side of [1, -1]) {
      for (const lagFrame of [2, AIR_DODGE_LANDING_LAG - 1]) {
        const { f } = wavedash(stick, repressAt(lagFrame, side));
        assertEquals(f.ground.action, GroundAction.dash);
        assertEquals(f.ground.dashFrame, 1);
        assertEquals(f.ground.dashDirection, side);
        assertEquals(f.facing, side);
      }
    }
  }
});

test("The wavedash dash buffer survives a rollback restore and replays the same exit [k1 scenario]", () => {
  const during = repressAt(2, 1);
  const run = land(SMASH);
  const saved = createFighter(Character.blademaster, 0.0, 1);
  for (let lagFrame = 0; lagFrame < 5; lagFrame++) stepDuel(run.world, controls(SMASH(during(lagFrame))));
  copyFighterState(saved, run.f, 3);
  assertEquals(saved.landing.dashBuffer, 1);
  sitLag(run, SMASH, during, 5);
  const first = { action: run.f.ground.action, x: run.f.motion.x, vx: run.f.motion.vx };
  assertEquals(first.action, GroundAction.dash);
  copyFighterState(run.f, saved, 3);
  sitLag(run, SMASH, during, 5);
  assertEquals(run.f.ground.action, first.action);
  assertEquals(run.f.motion.x, first.x);
  assertEquals(run.f.motion.vx, first.vx);
  const flipped = createFighter(Character.blademaster, 0.0, 1);
  copyFighterState(flipped, saved, 3);
  flipped.landing.dashBuffer = 0;
  assertFalse(sameFighterState(flipped, saved));
});
