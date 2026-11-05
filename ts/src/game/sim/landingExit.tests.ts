import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, Character, GroundAction } from "./codes";
import { AIR_DODGE_LANDING_LAG } from "./down";
import { type Fighter, createFighter } from "./fighter";
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
