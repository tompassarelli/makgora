import { assertEquals, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { imod } from "wisp/src/sim/intMath";
import { firstFighterDifference } from "../../../generated/state/fighterDifference";
import { copyFighterState } from "../../../generated/state/fighterState";
import { Phase } from "../../lobby/lobbyState";
import { stepMatch } from "../../match/step";
import { copyReplayState, createReplaySnapshot, type ReplayState } from "../../replay/snapshot";
import { Character } from "../../sim/codes";
import { createFighter, type Fighter, type Projectile } from "../../sim/fighter";
import { type Controls, copyControls, fighterAt } from "../../sim/roster";
import type { SpecialProjectile } from "../../sim/specials/schema";
import { controls } from "../../sim/testWorld";
import { FLAME_STRIKE_BURN, FLAME_STRIKE_BURST, FLAME_STRIKE_ORB } from "./specials";

const KAEL_X = -400.0;
const FAR_FOE_X = 900.0;
const NEAR_FOE_X = -140.0;
const ORB_FRAMES_BEFORE_SAVE = 3;
const REPLAYED_FRAMES = 70;

interface Bout {
  readonly state: ReplayState;
  readonly kael: Fighter;
  readonly foe: Fighter;
  tick: number;
}

function bout(foeX: number): Bout {
  const state = createReplaySnapshot();
  const kael = fighterAt(state.world, 0);
  copyFighterState(kael, createFighter(Character.kaelthas, KAEL_X, 1), 3);
  copyFighterState(fighterAt(state.world, 1), createFighter(Character.warden, foeX, -1), 3);
  state.match.phase = Phase.match;
  state.match.stageChoice = 0;
  state.match.matchSeed = 360;
  state.match.hazards = false;
  state.match.items.on = false;
  state.match.timeLimitMinutes = 0;
  state.match.ultimatesOff = true;
  const b: Bout = { state, kael, foe: fighterAt(state.world, 1), tick: 0 };
  for (let frame = 0; frame < 3; frame++) step(b);
  return b;
}

function step(b: Bout, first: Readonly<Controls> = controls()): void {
  b.tick++;
  copyControls(b.state.controls.inputs[0], first);
  copyControls(b.state.controls.inputs[1], controls());
  stepMatch(b.state.match, b.state.world, b.state.controls, b.tick);
}

function live(kael: Readonly<Fighter>, spec: Readonly<SpecialProjectile>): Readonly<Projectile> | undefined {
  for (const projectile of kael.projectiles) if (projectile.life > 0 && projectile.spec === spec) return projectile;
  return undefined;
}

const hold = (frame: number): Controls => controls({ specialHeld: true, verticalDirection: imod(frame, 16) < 8 ? 1 : -1 });
const holdUntilRelease = (frame: number): Controls => frame < 14 ? hold(frame) : controls();
const wrongInput = (): Controls => controls({ specialHeld: true, verticalDirection: -1 });

function rollbackReplays(foeX: number, script: (frame: number) => Controls): { eruptedAt: number; damaged: boolean } {
  const b = bout(foeX);
  step(b, controls({ specialPressed: true, specialX: 1, specialHeld: true }));
  while (live(b.kael, FLAME_STRIKE_ORB) === undefined && b.tick < 60) step(b, controls({ specialHeld: true }));
  for (let frame = 0; frame < ORB_FRAMES_BEFORE_SAVE; frame++) step(b, hold(frame));
  assertTrue(live(b.kael, FLAME_STRIKE_ORB) !== undefined);
  const saved = createReplaySnapshot();
  copyReplayState(saved, b.state);
  const savedTick = b.tick;
  let eruptedAt = -1;
  for (let frame = 0; frame < REPLAYED_FRAMES; frame++) {
    step(b, script(frame));
    if (eruptedAt < 0 && live(b.kael, FLAME_STRIKE_ORB) === undefined) eruptedAt = frame;
  }
  const expected = createReplaySnapshot();
  copyReplayState(expected, b.state);
  for (let frame = 0; frame < 12; frame++) step(b, wrongInput());
  copyReplayState(b.state, saved);
  b.tick = savedTick;
  for (let frame = 0; frame < REPLAYED_FRAMES; frame++) step(b, script(frame));
  const mask = b.state.world.mask;
  assertEquals(firstFighterDifference(fighterAt(expected.world, 0), b.kael, mask, mask), undefined);
  assertEquals(firstFighterDifference(fighterAt(expected.world, 1), b.foe, mask, mask), undefined);
  assertTrue(live(b.kael, FLAME_STRIKE_BURST) !== undefined || live(b.kael, FLAME_STRIKE_BURN) !== undefined || eruptedAt >= 0);
  return { eruptedAt, damaged: b.foe.status.damage > 0.0 };
}

test("Flame Strike: a rollback mid-flight replays the steered orb and its eruption by release exactly [k1 scenario]", () => {
  const { eruptedAt, damaged } = rollbackReplays(FAR_FOE_X, holdUntilRelease);
  assertGreaterThan(eruptedAt, 0);
  assertEquals(damaged, false, "the pillar burst short of the foe");
});

test("Flame Strike: a rollback mid-flight replays the steered orb and its eruption by touch exactly [k1 scenario]", () => {
  const { eruptedAt, damaged } = rollbackReplays(NEAR_FOE_X, hold);
  assertGreaterThan(eruptedAt, 0);
  assertEquals(damaged, true, "the orb erupted on the foe");
});

test("Flame Strike: a rollback mid-flight replays the steered orb and its eruption by time exactly [k1 scenario]", () => {
  const { eruptedAt, damaged } = rollbackReplays(FAR_FOE_X, hold);
  assertGreaterThan(eruptedAt, 0);
  assertEquals(damaged, false, "the pillar burst short of the foe");
});
