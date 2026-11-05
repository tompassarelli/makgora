import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { imod } from "wisp/src/sim/intMath";
import { firstFighterDifference } from "../../../generated/state/fighterDifference";
import { copyFighterState } from "../../../generated/state/fighterState";
import { Phase } from "../../lobby/lobbyState";
import { stepMatch } from "../../match/step";
import { copyReplayState, createReplaySnapshot, type ReplayState } from "../../replay/snapshot";
import { Character } from "../../sim/codes";
import { createFighter, type Fighter, type Projectile } from "../../sim/fighter";
import { type Controls, copyControls, fighterAt } from "../../sim/roster";
import { controls } from "../../sim/testWorld";
import { PYROBLAST } from "./specials";

const KAEL_X = -400.0;
const FAR_FOE_X = 900.0;

interface Bout {
  readonly state: ReplayState;
  readonly kael: Fighter;
  readonly foe: Fighter;
  tick: number;
}

function bout(foeX = FAR_FOE_X, foe: Character = Character.warden): Bout {
  const state = createReplaySnapshot();
  const kael = fighterAt(state.world, 0);
  copyFighterState(kael, createFighter(Character.kaelthas, KAEL_X, 1), 3);
  copyFighterState(fighterAt(state.world, 1), createFighter(foe, foeX, -1), 3);
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

function step(b: Bout, first: Readonly<Controls> = controls(), second: Readonly<Controls> = controls()): void {
  b.tick++;
  copyControls(b.state.controls.inputs[0], first);
  copyControls(b.state.controls.inputs[1], second);
  stepMatch(b.state.match, b.state.world, b.state.controls, b.tick);
}

const cast = (): Controls => controls({ specialPressed: true });
const stick = (x: number, z: number): Controls => controls({ direction: x, verticalDirection: z });

function ball(kael: Readonly<Fighter>): Readonly<Projectile> | undefined {
  for (const projectile of kael.projectiles) if (projectile.life > 0 && projectile.spec === PYROBLAST) return projectile;
  return undefined;
}

function castAndSpawn(b: Bout): void {
  step(b, cast());
  while (ball(b.kael) === undefined && b.tick < 60) step(b);
}

test("Pyroblast: a rollback mid-steer replays the same steered path exactly [k1 scenario]", () => {
  const b = bout();
  castAndSpawn(b);
  for (let frame = 0; frame < 8; frame++) step(b, stick(0, 1));
  const saved = createReplaySnapshot();
  copyReplayState(saved, b.state);
  const savedTick = b.tick;
  const path = (frame: number): Controls => stick(imod(frame, 20) < 10 ? 1 : -1, imod(frame, 7) < 3 ? -1 : 1);
  for (let frame = 0; frame < 30; frame++) step(b, path(frame));
  const expected = createReplaySnapshot();
  copyReplayState(expected, b.state);
  for (let frame = 0; frame < 12; frame++) step(b, stick(-1, -1));
  copyReplayState(b.state, saved);
  b.tick = savedTick;
  for (let frame = 0; frame < 30; frame++) step(b, path(frame));
  const mask = b.state.world.mask;
  assertEquals(firstFighterDifference(fighterAt(expected.world, 0), b.kael, mask, mask), undefined);
  assertEquals(firstFighterDifference(fighterAt(expected.world, 1), b.foe, mask, mask), undefined);
  assertTrue(ball(b.kael) !== undefined && ball(b.kael)?.velocityZ !== 0.0);
});





