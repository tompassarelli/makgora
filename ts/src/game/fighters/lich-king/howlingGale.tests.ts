import { assertEquals, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { copyFighterState } from "../../../generated/state/fighterState";
import { Phase } from "../../lobby/lobbyState";
import { stepMatch } from "../../match/step";
import { canonicalState } from "../../replay/canonical";
import { copyReplayState, createReplaySnapshot, type ReplayState } from "../../replay/snapshot";
import { Character, SpecialAction } from "../../sim/codes";
import { createFighter, type Fighter, type Projectile } from "../../sim/fighter";
import { type Controls, copyControls, fighterAt } from "../../sim/roster";
import { controls } from "../../sim/testWorld";
import { GALE_BEHIND, GALE_LEE, GALE_OWNER_PUSH, GALE_SPAWN_FRAME, GALE_SPEED, HOWLING_GALE } from "./specials";

const AIR_HEIGHT = 700.0;
const LOW_HOVER = 40.0;
const NEAR_FOE = 100.0;
const MID_FOE = 300.0;
const WATCH_FRAMES = 70;

interface Bout {
  readonly state: ReplayState;
  readonly king: Fighter;
  readonly foe: Fighter;
  readonly facing: number;
  tick: number;
}

interface Setup {
  readonly facing: number;
  readonly foeAhead: number;
  readonly kingHeight?: number | undefined;
  readonly foeHover?: number | undefined;
}

interface Struck {
  readonly damage: number;
  readonly hitstun: number;
  readonly knockback: number;
  readonly movedX: number;
}

const side = (facing: number): Controls => controls({ specialPressed: true, specialHeld: true, specialX: facing });

function bout(setup: Readonly<Setup>): Bout {
  const state = createReplaySnapshot();
  copyFighterState(fighterAt(state.world, 0), createFighter(Character.lichKing, 0.0, setup.facing), 3);
  copyFighterState(fighterAt(state.world, 1), createFighter(Character.warden, f32(setup.facing * setup.foeAhead), -setup.facing), 3);
  state.match.phase = Phase.match;
  state.match.stageChoice = 0;
  state.match.matchSeed = 11;
  state.match.hazards = false;
  state.match.items.on = false;
  state.match.timeLimitMinutes = 0;
  state.match.ultimatesOff = true;
  return { state, king: fighterAt(state.world, 0), foe: fighterAt(state.world, 1), facing: setup.facing, tick: 0 };
}

function hover(f: Fighter, z: number): void {
  f.motion.z = z;
  f.motion.vz = 0.0;
  f.motion.grounded = false;
  f.motion.surface = undefined;
}

function step(b: Bout, first: Readonly<Controls> = controls()): void {
  b.tick++;
  copyControls(b.state.controls.inputs[0], first);
  copyControls(b.state.controls.inputs[1], controls());
  stepMatch(b.state.match, b.state.world, b.state.controls, b.tick);
}

function hold(b: Bout, setup: Readonly<Setup>): void {
  if (setup.kingHeight !== undefined) hover(b.king, setup.kingHeight);
  if (setup.foeHover !== undefined && b.foe.status.damage === 0.0) hover(b.foe, f32(b.king.motion.z + setup.foeHover));
}

const gust = (b: Readonly<Bout>): Readonly<Projectile> | undefined => b.king.projectiles.find((p) => p.life > 0 && p.spec === HOWLING_GALE);

function gale(setup: Readonly<Setup>): Struck {
  const b = bout(setup);
  hold(b, setup);
  step(b);
  const startX = b.foe.motion.x;
  hold(b, setup);
  step(b, side(setup.facing));
  let hitstun = 0;
  let knockback = 0.0;
  for (let frame = 0; frame < WATCH_FRAMES; frame++) {
    hold(b, setup);
    step(b);
    hitstun = Math.max(hitstun, b.foe.launch.hitstun);
    knockback = Math.max(knockback, Math.sqrt(b.foe.launch.knockbackX * b.foe.launch.knockbackX + b.foe.launch.knockbackZ * b.foe.launch.knockbackZ));
  }
  return { damage: b.foe.status.damage, hitstun, knockback, movedX: f32(f32(b.foe.motion.x - startX) * setup.facing) };
}

test("Howling Gale is his side special: nothing blows before frame 14, then the gust rises one body (132) behind him and flies forward at 16 a frame, in both facings [k3 measure docs/design/roster.md]", () => {
  for (const facing of [1, -1]) {
    const b = bout({ facing, foeAhead: 900.0 });
    step(b);
    step(b, side(facing));
    assertEquals(b.king.special.action, SpecialAction.heroSide);
    while (gust(b) === undefined) {
      assertLessThan(b.king.special.frame, GALE_SPAWN_FRAME);
      step(b);
    }
    assertEquals(b.king.special.frame, GALE_SPAWN_FRAME);
    const wind = gust(b);
    assertEquals(wind?.velocityX, f32(facing * GALE_SPEED));
    const behind = f32(f32((wind?.x ?? 0.0) - b.king.motion.x) * facing);
    assertEquals(behind, f32(GALE_SPEED - GALE_BEHIND));
  }
});

test("He is a windbreak: a foe standing close in front, or hovering low there, is untouched while the gust passes over him, in both facings [k3 measure docs/design/roster.md]", () => {
  assertLessThan(NEAR_FOE, GALE_LEE);
  for (const facing of [1, -1]) {
    for (const near of [gale({ facing, foeAhead: NEAR_FOE }), gale({ facing, foeAhead: NEAR_FOE, foeHover: LOW_HOVER })]) {
      assertEquals(near.damage, 0.0);
      assertEquals(near.hitstun, 0);
      assertLessThan(Math.abs(near.movedX), 1.0);
    }
  }
});

test("A foe standing in the mid band takes 5 percent, hitstun and a launch the way the gust blows, in both facings [k3 measure docs/design/roster.md]", () => {
  for (const facing of [1, -1]) {
    const mid = gale({ facing, foeAhead: MID_FOE });
    assertEquals(mid.damage, HOWLING_GALE.gust?.groundedEffect.damage);
    assertGreaterThan(mid.hitstun, 0);
    assertGreaterThan(mid.movedX, 30.0);
  }
});

test("An airborne foe in the same spot takes more percent, more hitstun and a harder launch than a standing one, in both facings [k3 measure docs/design/roster.md]", () => {
  for (const facing of [1, -1]) {
    const standing = gale({ facing, foeAhead: MID_FOE });
    const airborne = gale({ facing, foeAhead: MID_FOE, foeHover: LOW_HOVER });
    assertEquals(airborne.damage, HOWLING_GALE.effect.damage);
    assertGreaterThan(airborne.damage, standing.damage);
    assertGreaterThan(airborne.hitstun, standing.hitstun);
    assertGreaterThan(airborne.knockback, standing.knockback);
  }
});

test("On the ground the gale does nothing to him: he neither moves nor takes percent as it passes, in both facings [k3 measure docs/design/roster.md]", () => {
  for (const facing of [1, -1]) {
    const b = bout({ facing, foeAhead: 900.0 });
    step(b);
    const x = b.king.motion.x;
    step(b, side(facing));
    let passed = false;
    for (let frame = 0; frame < WATCH_FRAMES; frame++) {
      step(b);
      assertTrue(b.king.motion.grounded);
      assertEquals(b.king.motion.x, x);
      const wind = gust(b);
      passed ||= wind !== undefined && f32(f32(wind.x - x) * facing) > 0.0;
    }
    assertTrue(passed);
    assertEquals(b.king.status.damage, 0.0);
  }
});

test("In the air the gust carries him forward at 9 a frame when it reaches him, a sideways recovery, in both facings [k3 measure docs/design/roster.md]", () => {
  for (const facing of [1, -1]) {
    const setup: Setup = { facing, foeAhead: 900.0, kingHeight: AIR_HEIGHT };
    const b = bout(setup);
    hold(b, setup);
    step(b);
    const x = b.king.motion.x;
    hold(b, setup);
    step(b, side(facing));
    let pushedOn: number | undefined;
    for (let frame = 0; frame < 40; frame++) {
      hold(b, setup);
      step(b);
      if (pushedOn === undefined && f32(b.king.motion.vx * facing) >= GALE_OWNER_PUSH) pushedOn = b.king.special.frame;
    }
    assertTrue(pushedOn !== undefined);
    assertGreaterThan(pushedOn ?? 0, GALE_SPAWN_FRAME);
    assertGreaterThan(f32(f32(b.king.motion.x - x) * facing), 100.0);
    assertEquals(b.king.status.damage, 0.0);
  }
});

test("A rollback across the gale's spawn, its push and its hits replays to the live checksum [k1 scenario]", () => {
  const end = 72;
  for (const facing of [1, -1]) {
    for (const setup of [{ facing, foeAhead: MID_FOE, foeHover: LOW_HOVER }, { facing, foeAhead: MID_FOE, kingHeight: AIR_HEIGHT, foeHover: 0.0 }] as const) {
      for (const save of [10, 16, 24, 30, 40]) {
        const run = bout(setup);
        const snapshot = createReplaySnapshot();
        const script = (tick: number): Controls => tick === 2 ? side(facing) : controls();
        for (let tick = 1; tick <= end; tick++) {
          if (tick === save) copyReplayState(snapshot, run.state);
          hold(run, setup);
          step(run, script(tick));
        }
        assertGreaterThan(run.foe.status.damage, 0.0);
        const expected = canonicalState(run.state);
        copyReplayState(run.state, snapshot);
        run.tick = save - 1;
        for (let tick = save; tick <= end; tick++) {
          hold(run, setup);
          step(run, script(tick));
        }
        assertEquals(canonicalState(run.state), expected);
      }
    }
  }
});
