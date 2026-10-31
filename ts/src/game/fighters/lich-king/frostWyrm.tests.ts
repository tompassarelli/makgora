import { assertEquals, assertGreaterThan, assertLessThan, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { at } from "wisp/src/runtime/lookup";
import { copyFighterState } from "../../../generated/state/fighterState";
import { Phase } from "../../lobby/lobbyState";
import { stepMatch } from "../../match/step";
import { createReplaySnapshot, type ReplayState } from "../../replay/snapshot";
import { beginFighterAttack } from "../../sim/attacks";
import { AttackStyle, Character, ProjectileKind, SpecialAction } from "../../sim/codes";
import { mutableProjectile } from "../../sim/fighterProjectiles";
import { createFighter, type Fighter, type Projectile } from "../../sim/fighter";
import { type Controls, copyControls, fighterAt } from "../../sim/roster";
import { mainDeckZ } from "../../sim/stage";
import { controls } from "../../sim/testWorld";
import { WYRM_BREATHS, WYRM_BREATH_FRAMES, WYRM_BREATH_REACH, WYRM_BREATH_SPEED, WYRM_DISMOUNT_FRAMES, WYRM_DRIFT, WYRM_LIFT, WYRM_RIDE, WYRM_RISE, WYRM_SUMMON_FRAMES } from "./specials";

const KING_X = -300.0;
const FAR_FOE_X = 2000.0;
const HEIGHT = 300.0;
const DIAGONAL = 0.7071067690849304;
const UP_B = { specialPressed: true, specialZ: 1, verticalDirection: 1 };

interface Bout {
  readonly state: ReplayState;
  readonly king: Fighter;
  readonly foe: Fighter;
  tick: number;
}

function bout(facing: number, foeX = FAR_FOE_X): Bout {
  const state = createReplaySnapshot();
  const king = fighterAt(state.world, 0);
  copyFighterState(king, createFighter(Character.lichKing, KING_X, facing), 3);
  copyFighterState(fighterAt(state.world, 1), createFighter(Character.warden, foeX, -1), 3);
  state.match.phase = Phase.match;
  state.match.stageChoice = 0;
  state.match.matchSeed = 361;
  state.match.hazards = false;
  state.match.items.on = false;
  state.match.timeLimitMinutes = 0;
  state.match.ultimatesOff = true;
  const b: Bout = { state, king, foe: fighterAt(state.world, 1), tick: 0 };
  for (let frame = 0; frame < 3; frame++) step(b);
  return b;
}

function step(b: Bout, first: Readonly<Controls> = controls(), second: Readonly<Controls> = controls()): void {
  b.tick++;
  copyControls(b.state.controls.inputs[0], first);
  copyControls(b.state.controls.inputs[1], second);
  stepMatch(b.state.match, b.state.world, b.state.controls, b.tick);
}

function lift(b: Bout): void {
  const { motion } = b.king;
  motion.grounded = false;
  motion.surface = undefined;
  motion.z = f32(mainDeckZ(0) + HEIGHT);
  motion.vx = 0.0;
  motion.vz = 0.0;
}

function ride(b: Bout, held: Readonly<Controls>): void {
  lift(b);
  step(b, controls(UP_B));
  assertEquals(b.king.special.action, SpecialAction.heroUp);
  while (b.king.special.action === SpecialAction.heroUp && b.king.special.frame < WYRM_RIDE.last) step(b, held);
}

function breath(king: Readonly<Fighter>, spawnFrame: number): Readonly<Projectile> | undefined {
  for (const projectile of king.projectiles) if (projectile.life > 0 && projectile.spec?.spawnFrame === spawnFrame && WYRM_BREATHS.includes(projectile.spec)) return projectile;
  return undefined;
}

test("Frost Wyrm: he hangs in place through the summon, then the wyrm carries him 2.4H up over its ride, the stick adding or taking 0.5H and steering 1.3H across [k3 measure docs/design/roster.md]", () => {
  const still = bout(1);
  lift(still);
  const startZ = still.king.motion.z;
  step(still, controls(UP_B));
  while (still.king.special.frame < WYRM_SUMMON_FRAMES) step(still);
  assertNear(still.king.motion.z, startZ, 2.0);
  step(still);
  assertEquals(still.king.special.frame, WYRM_RIDE.first);
  assertEquals(still.king.motion.vz, WYRM_RISE);
  const rides = (held: Readonly<Controls>) => {
    const b = bout(1);
    ride(b, held);
    return { x: f32(b.king.motion.x - KING_X), z: b.king.motion.z };
  };
  const neutral = rides(controls());
  const up = rides(controls({ verticalDirection: 1 }));
  const down = rides(controls({ verticalDirection: -1 }));
  const forward = rides(controls({ direction: 1 }));
  const frames = WYRM_RIDE.last - WYRM_RIDE.first + 1;
  assertNear(f32(up.z - neutral.z), f32(WYRM_LIFT * frames), f32(WYRM_LIFT + 0.5));
  assertNear(f32(neutral.z - down.z), f32(WYRM_LIFT * frames), f32(WYRM_LIFT + 0.5));
  assertNear(f32(forward.x - neutral.x), f32(WYRM_DRIFT * frames), f32(WYRM_DRIFT + 0.5));
  assertGreaterThan(down.z, f32(startZ + 200.0));
});

test("Frost Wyrm: each breath leaves the wyrm along the stick's eight-way aim and flies that way, in both facings, turning him to face a held side [k1 scenario]", () => {
  const first = WYRM_BREATH_FRAMES[0];
  const aims: readonly (readonly [number, number])[] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, -1]];
  for (const facing of [1, -1]) {
    for (const [x, z] of aims) {
      const b = bout(facing);
      lift(b);
      step(b, controls(UP_B));
      const held = controls({ direction: x, verticalDirection: z });
      while (breath(b.king, first) === undefined) {
        assertLessThan(b.king.special.frame, first);
        step(b, held);
      }
      const shot = breath(b.king, first);
      const scale = x !== 0 && z !== 0 ? DIAGONAL : 1.0;
      assertEquals(shot?.velocityX, f32(f32(x * scale) * WYRM_BREATH_SPEED));
      assertEquals(shot?.velocityZ, f32(f32(z * scale) * WYRM_BREATH_SPEED));
      assertNear(f32((shot?.x ?? 0.0) - b.king.motion.x), f32(f32(x * scale) * f32(WYRM_BREATH_REACH + WYRM_BREATH_SPEED)), f32(WYRM_DRIFT + 1.0));
      if (x !== 0) assertEquals(b.king.facing, x);
      else assertEquals(b.king.facing, facing);
    }
  }
});

test("Frost Wyrm: the breath strikes a foe in its path for 5 percent and pushes it up and away, without reaching kill power [k3 measure docs/design/roster.md]", () => {
  const b = bout(1, KING_X + 150.0);
  lift(b);
  b.foe.motion.grounded = false;
  b.foe.motion.surface = undefined;
  b.foe.motion.z = f32(b.king.motion.z + 30.0);
  b.foe.status.damage = 120.0;
  step(b, controls(UP_B));
  const held = controls({ direction: 1 });
  while (b.king.special.frame < WYRM_BREATH_FRAMES[0] + 6) {
    b.foe.motion.z = f32(b.king.motion.z + 30.0);
    b.foe.motion.vz = 0.0;
    step(b, held);
  }
  assertNear(b.foe.status.damage, 125.0, f32(0.01));
  assertGreaterThan(b.foe.launch.knockbackX, 0.0);
  assertGreaterThan(b.foe.launch.knockbackZ, 0.0);
  assertLessThan(b.foe.launch.hitstun, 60);
});

test("Frost Wyrm: he leaps off after the ride and falls helpless with no jump left, the ride never catching a ledge on the way up [k1 scenario]", () => {
  const b = bout(1);
  lift(b);
  step(b, controls(UP_B));
  let lowest = 1000.0;
  let last = 0;
  while (b.king.special.action === SpecialAction.heroUp) {
    last = b.king.special.frame;
    if (last >= WYRM_RIDE.first && last <= WYRM_RIDE.last) lowest = Math.min(lowest, b.king.motion.vz);
    step(b, controls({ verticalDirection: -1 }));
  }
  assertEquals(last + 1, WYRM_RIDE.last + WYRM_DISMOUNT_FRAMES);
  assertTrue(b.king.special.fall);
  assertEquals(b.king.jump.remaining, 0);
  assertGreaterThan(lowest, 0.0);
});

function mountedWithBreath(foeX = FAR_FOE_X): Bout {
  const b = bout(1, foeX);
  lift(b);
  step(b, controls(UP_B));
  while (breath(b.king, WYRM_BREATH_FRAMES[0]) === undefined) step(b, controls({ direction: 1 }));
  return b;
}

test("Frost Wyrm: a hit knocks him off the wyrm, ending the ride and its live breath, and a lost stock or the match ending clears them too [k1 scenario]", () => {
  const b = bout(1, KING_X - 30.0);
  const { king, foe } = b;
  b.foe.facing = 1;
  step(b, controls(UP_B));
  let swung = false;
  let breathing = false;
  for (let n = 0; n < 40 && king.status.damage === 0.0; n++) {
    breathing = breath(king, WYRM_BREATH_FRAMES[0]) !== undefined;
    if (!swung && king.special.frame >= WYRM_BREATH_FRAMES[0] - 2) {
      beginFighterAttack(b.state.world, 1, AttackStyle.upSmash, false);
      swung = foe.attack.style !== undefined;
    }
    step(b);
  }
  assertTrue(swung);
  assertGreaterThan(king.status.damage, 0.0);
  assertTrue(breathing);
  assertEquals(king.special.action, SpecialAction.none);
  for (const frame of WYRM_BREATH_FRAMES) assertEquals(breath(king, frame), undefined);
  const lost = mountedWithBreath();
  const stocks = lost.king.status.stocks;
  lost.king.motion.x = 20000.0;
  for (let n = 0; n < 10 && lost.king.status.stocks === stocks; n++) step(lost);
  assertEquals(lost.king.status.stocks, stocks - 1);
  assertEquals(lost.king.special.action, SpecialAction.none);
  for (const frame of WYRM_BREATH_FRAMES) assertEquals(breath(lost.king, frame), undefined);
  const last = mountedWithBreath();
  last.king.status.stocks = 1;
  last.king.motion.x = 20000.0;
  for (let n = 0; n < 10 && last.state.match.phase === Phase.match; n++) step(last);
  assertTrue(last.state.match.phase !== Phase.match);
  assertEquals(last.king.special.action, SpecialAction.none);
  for (const frame of WYRM_BREATH_FRAMES) assertEquals(breath(last.king, frame), undefined);
});

test("Frost Wyrm: his breaths ride with the move, so he still mounts with two of his own shots already out [k1 scenario]", () => {
  const b = bout(1);
  lift(b);
  const shot = { ...at(WYRM_BREATHS, 0), breath: undefined, life: 200 };
  for (let index = 0; index < 2; index++) {
    const live = mutableProjectile(b.king, index);
    live.kind = ProjectileKind.hero;
    live.spec = index === 0 ? shot : { ...shot };
    live.life = 200;
    live.x = FAR_FOE_X;
    live.z = 2000.0;
  }
  step(b, controls(UP_B));
  assertEquals(b.king.special.action, SpecialAction.heroUp);
  while (b.king.special.frame < WYRM_BREATH_FRAMES[1]) step(b);
  assertTrue(breath(b.king, WYRM_BREATH_FRAMES[1]) !== undefined);
});
