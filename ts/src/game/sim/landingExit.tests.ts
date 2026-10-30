import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { copyFighterState, sameFighterState } from "../../generated/state/fighterState";
import { AttackStyle, Character, DuoOrder, DuoRole, GroundAction } from "./codes";
import { AIR_DODGE_LANDING_LAG, finishLanding } from "./down";
import { type Fighter, createFighter, mutableDuo } from "./fighter";
import type { Controls, Roster } from "./roster";
import { controls } from "./testWorld";
import { duelPair, queueDuelAttack, stepDuel } from "./testDuel";

type Stick = (side: number) => Partial<Controls>;
type Lag = (lagFrame: number) => number;

const keyboard: Stick = (side) => ({ direction: side });
const analog = (x: number): Stick => (side) => ({ direction: side, diStickValid: side !== 0, diStickX: f32(side * x) });
const FULL = analog(1.0);
const SMASH = analog(f32(0.85));
const STICKS: readonly Stick[] = [keyboard, FULL, SMASH];

interface Run { readonly world: Roster; readonly f: Fighter; readonly lag: number }

type Landing = "aerial" | "airDodge";

function land(kind: Landing, stick: Stick, before: number): Run {
  const { world, owner: f } = duelPair(createFighter(Character.blademaster, -300.0, 1), createFighter(Character.rifleman, 700.0, -1));
  stepDuel(world, controls({ jumpPressed: true, shortHopPressed: true, ...stick(before) }));
  if (kind === "airDodge") stepDuel(world, controls({ airDodgePressed: true, shield: true, shieldPressed: true, dodgeX: 1, dodgeZ: -1, verticalDirection: -1, ...stick(before) }));
  else {
    queueDuelAttack(world, AttackStyle.neutralAir, 1);
    stepDuel(world, controls(stick(before)));
  }
  for (let frame = 0; frame < 80 && f.landing.lag === 0; frame++) stepDuel(world, controls(stick(before)));
  assertTrue(f.landing.lag > 0);
  assertEquals(f.landing.wavedash, kind === "airDodge");
  assertTrue(f.landing.buffering);
  return { world, f, lag: f.landing.lag };
}

function sitLag(run: Run, stick: Stick, during: Lag): Run {
  for (let lagFrame = 0; run.f.landing.lag > 0 && lagFrame < 80; lagFrame++) stepDuel(run.world, controls(stick(during(lagFrame))));
  assertEquals(run.f.landing.lag, 0);
  return run;
}

const held: Lag = () => 1;
const script = (steps: readonly (readonly [number, number])[]): Lag => (frame) => {
  let at = 0;
  for (const [count, side] of steps) {
    at += count;
    if (frame < at) return side;
  }
  return steps[steps.length - 1]?.[1] ?? 0;
};
const repressAt = (lagFrame: number, side: number): Lag => script([[lagFrame - 1, 1], [1, 0], [1, side]]);

function walksOut(run: Run, stick: Stick, frames: number): void {
  for (let frame = 0; frame < frames; frame++) {
    assertEquals(run.f.ground.action, GroundAction.none);
    assertEquals(run.f.ground.dashFrame, 0);
    stepDuel(run.world, controls(stick(1)));
  }
  assertTrue(run.f.motion.vx > 0.0);
}

test("Holding the stick through an aerial or air dodge landing lag walks out and never dashes [k1 scenario]", () => {
  for (const kind of ["aerial", "airDodge"] as const) {
    for (const stick of STICKS) {
      const run = sitLag(land(kind, stick, 1), stick, held);
      walksOut(run, stick, 30);
    }
  }
});

test("A fresh press either way during an aerial landing lag dashes that way on the first actionable frame [k1 scenario]", () => {
  for (const stick of STICKS) {
    for (const side of [1, -1]) {
      const probe = land("aerial", stick, 1);
      for (const lagFrame of [2, probe.lag - 1]) {
        const { f } = sitLag(land("aerial", stick, 1), stick, repressAt(lagFrame, side));
        assertEquals(f.ground.action, GroundAction.dash);
        assertEquals(f.ground.dashFrame, 1);
        assertEquals(f.ground.dashDirection, side);
        assertEquals(f.facing, side);
      }
    }
  }
});

test("A fresh flick during a landing lag from a neutral stick dashes both ways, aerial landings and air dodges alike [k1 scenario]", () => {
  for (const kind of ["aerial", "airDodge"] as const) {
    for (const side of [1, -1]) {
      const { f } = sitLag(land(kind, SMASH, 0), SMASH, script([[3, 0], [1, side]]));
      assertEquals(f.ground.action, GroundAction.dash);
      assertEquals(f.ground.dashDirection, side);
    }
  }
});

test("A landing with no lag does not buffer and a held stick walks as before [k1 scenario]", () => {
  const f = createFighter(Character.blademaster, 0.0, 1);
  const duo = mutableDuo(f);
  duo.role = DuoRole.partner;
  duo.order = DuoOrder.tossed;
  f.motion.grounded = false;
  finishLanding(f, 0, 0, controls(FULL(1)), 0, false);
  assertTrue(f.motion.grounded);
  assertEquals(f.landing.lag, 0);
  assertFalse(f.landing.buffering);
  assertEquals(f.landing.heldSide, 0);
});

test("A press from neutral again after the stick returned to neutral buffers a dash again, in every lagged landing [k1 scenario]", () => {
  for (const kind of ["aerial", "airDodge"] as const) {
    for (const stick of STICKS) {
      const { f } = sitLag(land(kind, stick, 0), stick, script([[1, 0], [1, 1], [1, 0], [1, 1]]));
      assertEquals(f.ground.action, GroundAction.dash);
      assertEquals(f.ground.dashDirection, 1);
    }
  }
});

test("A flick straight across to the other side during a landing lag, without passing neutral, dashes that side [k1 scenario]", () => {
  const { f } = sitLag(land("airDodge", SMASH, 0), SMASH, script([[1, 0], [1, 1], [1, -1]]));
  assertEquals(f.ground.action, GroundAction.dash);
  assertEquals(f.ground.dashDirection, -1);
});

test("The landing dash buffer survives a rollback restore and replays the same exit [k1 scenario]", () => {
  const during = script([[1, 0], [1, 1]]);
  const run = land("aerial", FULL, 0);
  const saved = createFighter(Character.blademaster, 0.0, 1);
  stepDuel(run.world, controls(FULL(during(0))));
  stepDuel(run.world, controls(FULL(during(1))));
  copyFighterState(saved, run.f, 3);
  assertEquals(saved.landing.dashBuffer, 1);
  assertTrue(saved.landing.buffering);
  const flipped = createFighter(Character.blademaster, 0.0, 1);
  copyFighterState(flipped, saved, 3);
  flipped.landing.buffering = false;
  assertFalse(sameFighterState(flipped, saved));
});

interface Struck { readonly dashed: boolean; readonly style: AttackStyle | undefined; readonly facing: number }

function wavedashThenAttack(dodgeSide: number, heldSide: -1 | 1, duringLag: Lag, attackInLag: boolean, stick: Stick = FULL): Struck {
  const { world, owner: f } = duelPair(createFighter(Character.blademaster, -300.0, 1), createFighter(Character.rifleman, 700.0, -1));
  stepDuel(world, controls({ jumpPressed: true, shortHopPressed: true }));
  stepDuel(world, controls({ airDodgePressed: true, shield: true, shieldPressed: true, dodgeX: dodgeSide, dodgeZ: -1, verticalDirection: -1, ...FULL(dodgeSide) }));
  for (let frame = 0; frame < 80 && f.landing.lag === 0; frame++) stepDuel(world, controls(stick(heldSide)));
  assertEquals(f.landing.lag, AIR_DODGE_LANDING_LAG);
  for (let lagFrame = 0; lagFrame < 80 && f.landing.lag > 0; lagFrame++) {
    if (attackInLag && f.landing.lag === 2) queueDuelAttack(world, AttackStyle.forwardTilt, heldSide);
    stepDuel(world, controls(stick(duringLag(lagFrame))));
  }
  const dashed = f.ground.action === GroundAction.dash;
  if (!attackInLag) queueDuelAttack(world, AttackStyle.forwardTilt, heldSide);
  stepDuel(world, controls(stick(heldSide)));
  return { dashed, style: f.attack.style, facing: f.facing };
}

test("Wavedash back with forward held before and through the landing, then A in the lag or on the first actionable frame, is a forward tilt and never a dash attack [k1 scenario]", () => {
  for (const attackInLag of [true, false]) {
    const r = wavedashThenAttack(-1, 1, held, attackInLag);
    assertFalse(r.dashed);
    assertEquals(r.style, AttackStyle.forwardTilt);
    assertEquals(r.facing, 1);
  }
});

test("Wavedash forward with back held through the landing, then A, is the standing tilt toward the held side and never a dash attack [k1 scenario]", () => {
  for (const attackInLag of [true, false]) {
    const r = wavedashThenAttack(1, -1, () => -1, attackInLag);
    assertFalse(r.dashed);
    assertEquals(r.style, AttackStyle.forwardTilt);
    assertEquals(r.facing, -1);
  }
});

test("Wavedash back, then forward pressed from neutral during the lag, then A after the lag is a dash attack [k1 scenario]", () => {
  const r = wavedashThenAttack(-1, 1, script([[3, 0], [20, 1]]), false, SMASH);
  assertTrue(r.dashed);
  assertTrue(r.style !== undefined && r.style !== AttackStyle.forwardTilt);
});
