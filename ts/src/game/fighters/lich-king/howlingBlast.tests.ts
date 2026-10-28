import { assertEquals, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { copyFighterState } from "../../../generated/state/fighterState";
import { Phase } from "../../lobby/lobbyState";
import { stepMatch } from "../../match/step";
import { beginFighterAttack } from "../../sim/attacks";
import { createReplaySnapshot, type ReplayState } from "../../replay/snapshot";
import { AttackStyle, Character, SpecialAction } from "../../sim/codes";
import { createFighter, type Fighter, type Projectile } from "../../sim/fighter";
import { HERO_REFERENCE_HEIGHT } from "../../sim/heroMoves";
import { type Controls, copyControls, fighterAt } from "../../sim/roster";
import { mainDeckZ } from "../../sim/stage";
import { controls } from "../../sim/testWorld";
import { HOWLING_BLAST, HOWLING_BLAST_LIFE, HOWLING_BLAST_SPAWN_FRAME, HOWLING_BLAST_SPEED } from "./specials";

const KING_X = -400.0;
const FAR_FOE_X = 2000.0;
const END_LAG = 28;
const OLD_TRAVEL = f32(359.0399169921875);

interface Bout {
  readonly state: ReplayState;
  readonly king: Fighter;
  readonly foe: Fighter;
  tick: number;
}

function bout(foeX = FAR_FOE_X): Bout {
  const state = createReplaySnapshot();
  const king = fighterAt(state.world, 0);
  copyFighterState(king, createFighter(Character.lichKing, KING_X, 1), 3);
  copyFighterState(fighterAt(state.world, 1), createFighter(Character.warden, foeX, -1), 3);
  state.match.phase = Phase.match;
  state.match.stageChoice = 0;
  state.match.matchSeed = 360;
  state.match.hazards = false;
  state.match.items.on = false;
  state.match.timeLimitMinutes = 0;
  state.match.ultimatesOff = true;
  const b: Bout = { state, king, foe: fighterAt(state.world, 1), tick: 0 };
  for (let frame = 0; frame < 3; frame++) step(b);
  return b;
}

function step(b: Bout, first: Readonly<Controls> = controls()): void {
  b.tick++;
  copyControls(b.state.controls.inputs[0], first);
  copyControls(b.state.controls.inputs[1], controls());
  stepMatch(b.state.match, b.state.world, b.state.controls, b.tick);
}

function blast(king: Readonly<Fighter>): Readonly<Projectile> | undefined {
  for (const projectile of king.projectiles) if (projectile.life > 0 && projectile.spec === HOWLING_BLAST) return projectile;
  return undefined;
}

test("Howling Blast: the gust leaves his hand on frame 22, speed 0.072H a frame, and lives 53 frames [k3 measure docs/design/roster.md]", () => {
  assertEquals(HOWLING_BLAST_SPAWN_FRAME, 22);
  assertEquals(HOWLING_BLAST_LIFE, 53);
  assertEquals(HOWLING_BLAST_SPEED, f32(HERO_REFERENCE_HEIGHT * f32(0.072)));
  const b = bout();
  step(b, controls({ specialPressed: true }));
  assertEquals(b.king.special.action, SpecialAction.heroNeutral);
  let frames = 1;
  while (blast(b.king) === undefined) {
    assertLessThan(frames, HOWLING_BLAST_SPAWN_FRAME + 1);
    step(b);
    frames++;
  }
  assertEquals(b.king.special.frame, HOWLING_BLAST_SPAWN_FRAME);
  assertEquals(blast(b.king)?.velocityX, HOWLING_BLAST_SPEED);
});

test("Howling Blast: the gust flies 35 percent farther than the old 359 units before it fades [k3 measure docs/design/roster.md]", () => {
  const b = bout();
  step(b, controls({ specialPressed: true }));
  while (blast(b.king) === undefined) step(b);
  const startX = blast(b.king)?.x ?? 0.0;
  let lastX = startX;
  let alive = 0;
  while (blast(b.king) !== undefined && alive < 100) {
    lastX = blast(b.king)?.x ?? lastX;
    step(b);
    alive++;
  }
  assertTrue(alive <= HOWLING_BLAST_LIFE);
  assertGreaterThan(alive, HOWLING_BLAST_LIFE - 3);
  const travel = f32(lastX - startX);
  assertGreaterThan(travel, f32(OLD_TRAVEL * f32(1.34)));
  assertLessThan(travel, f32(OLD_TRAVEL * f32(1.36)));
});

test("Howling Blast: he stays committed for 28 frames after the gust leaves, the same end lag as before [k3 measure docs/design/roster.md]", () => {
  const b = bout();
  step(b, controls({ specialPressed: true }));
  while (blast(b.king) === undefined) step(b);
  const released = b.king.special.frame;
  let lag = 0;
  while (b.king.special.action === SpecialAction.heroNeutral && lag < 80) {
    step(b);
    lag++;
  }
  assertEquals(released, HOWLING_BLAST_SPAWN_FRAME);
  assertEquals(lag, END_LAG);
});

const AIR_HEIGHT = 60.0;
const FOE_IN_REACH = KING_X + 150.0;
const LAST_FRAME = 50;

interface Landed {
  readonly landed: number;
  readonly spawned: number;
  readonly ended: number;
  readonly lag: number;
}

function lift(b: Bout, height: number): void {
  b.king.motion.grounded = false;
  b.king.motion.surface = undefined;
  b.king.motion.z = f32(mainDeckZ(0) + height);
  b.king.motion.vx = 0.0;
  b.king.motion.vz = 0.0;
}

function airCast(b: Bout, height: number, press = true): Landed {
  const { king } = b;
  if (height > 0.0) lift(b, height);
  step(b, controls({ specialPressed: press }));
  if (press) assertEquals(king.special.action, SpecialAction.heroNeutral);
  let landed = 0;
  let spawned = 0;
  let ended = 0;
  let lag = 0;
  for (let n = 1; n <= 80; n++) {
    if (landed === 0 && king.motion.grounded) landed = n;
    if (spawned === 0 && blast(king) !== undefined) spawned = n;
    lag = Math.max(lag, king.landing.lag);
    if (ended === 0 && king.special.action === SpecialAction.none) ended = n;
    step(b);
  }
  return { landed, spawned, ended, lag };
}

test("Howling Blast: a cast that lands before the gust leaves still releases it on frame 22, ends on frame 50 and adds no landing lag [k1 scenario]", () => {
  const ground = airCast(bout(), 0.0);
  const air = airCast(bout(), AIR_HEIGHT);
  assertGreaterThan(air.landed, 1);
  assertLessThan(air.landed, HOWLING_BLAST_SPAWN_FRAME);
  assertEquals(air.spawned, ground.spawned);
  assertEquals(air.spawned, HOWLING_BLAST_SPAWN_FRAME);
  assertEquals(air.ended, LAST_FRAME);
  assertEquals(air.ended, ground.ended);
  assertEquals(air.lag, airCast(bout(), AIR_HEIGHT, false).lag);
});

test("Howling Blast: armor still absorbs a jab after the cast has landed, with no hitstun or knockback [k1 scenario]", () => {
  const b = bout(FOE_IN_REACH);
  const { king } = b;
  lift(b, AIR_HEIGHT);
  step(b, controls({ specialPressed: true }));
  let struck = false;
  for (let n = 0; n < HOWLING_BLAST_SPAWN_FRAME - 1 && king.special.action === SpecialAction.heroNeutral; n++) {
    if (king.motion.grounded && king.special.frame >= 10 && b.foe.attack.style === undefined) {
      beginFighterAttack(b.state.world, 1, AttackStyle.jab, false);
      struck = true;
    }
    step(b);
  }
  assertTrue(struck);
  assertTrue(king.motion.grounded);
  assertGreaterThan(king.status.damage, 0.0);
  assertEquals(king.launch.hitstun, 0);
  assertEquals(king.launch.knockbackX, 0.0);
  assertEquals(king.launch.knockbackZ, 0.0);
  assertEquals(king.special.action, SpecialAction.heroNeutral);
});
