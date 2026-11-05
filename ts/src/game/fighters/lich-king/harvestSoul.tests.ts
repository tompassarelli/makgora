import { assertEquals, assertGreaterThan, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { copyFighterState } from "../../../generated/state/fighterState";
import { Phase } from "../../lobby/lobbyState";
import { stepMatch } from "../../match/step";
import { firstStateDifference } from "../../replay/difference";
import { copyReplayState, createReplaySnapshot, type ReplayState } from "../../replay/snapshot";
import { beginFighterAttack } from "../../sim/attacks";
import { AttackStyle, Character } from "../../sim/codes";
import { createFighter, type Fighter } from "../../sim/fighter";
import { type Controls, copyControls, fighterAt, setRosterMask } from "../../sim/roster";
import { controls } from "../../sim/testWorld";
import { SOUL_CHARGE } from "./specials";

const KING_X = -300.0;
const FAR_FOE_X = 600.0;
const HOLD = controls({ specialHeld: true, verticalDirection: -1, down: true });
const PRESS = controls({ specialPressed: true, specialHeld: true, specialZ: -1, verticalDirection: -1, down: true });

interface Bout {
  readonly state: ReplayState;
  readonly king: Fighter;
  readonly foe: Fighter;
  tick: number;
  foeInput: Controls;
}

function bout(foeX = FAR_FOE_X, third?: number): Bout {
  const state = createReplaySnapshot();
  copyFighterState(fighterAt(state.world, 0), createFighter(Character.lichKing, KING_X, 1), 3);
  copyFighterState(fighterAt(state.world, 1), createFighter(Character.warden, foeX, -1), 3);
  if (third !== undefined) {
    copyFighterState(fighterAt(state.world, 2), createFighter(Character.rifleman, third, -1), 3);
    setRosterMask(state.world, 7);
  }
  state.match.phase = Phase.match;
  state.match.stageChoice = 0;
  state.match.matchSeed = 360;
  state.match.hazards = false;
  state.match.items.on = false;
  state.match.timeLimitMinutes = 0;
  state.match.ultimatesOff = true;
  const b: Bout = { state, king: fighterAt(state.world, 0), foe: fighterAt(state.world, 1), tick: 0, foeInput: controls() };
  for (let frame = 0; frame < 8; frame++) step(b);
  return b;
}

function step(b: Bout, first: Readonly<Controls> = controls()): void {
  b.tick++;
  copyControls(b.state.controls.inputs[0], first);
  copyControls(b.state.controls.inputs[1], b.foeInput);
  copyControls(b.state.controls.inputs[2], controls());
  stepMatch(b.state.match, b.state.world, b.state.controls, b.tick);
}

function channel(b: Bout, frames: number): void {
  step(b, PRESS);
  for (let n = 1; n < frames; n++) step(b, HOLD);
}

function raise(b: Bout): void {
  b.king.special.charge = SOUL_CHARGE.full;
  step(b, PRESS);
  for (let n = 0; n < 50; n++) step(b);
}

test("Harvest Soul and the Ghoul roll back: a snapshot taken with the Ghoul out, restored after a branch where the foe launched it, replays to the same state as the straight run [k1 scenario]", () => {
  const straight = bout(KING_X + 400.0);
  const replayed = bout(KING_X + 400.0);
  for (const b of [straight, replayed]) {
    b.king.special.charge = SOUL_CHARGE.full - 20;
    channel(b, SOUL_CHARGE.hold + 30);
    for (let n = 0; n < 5; n++) step(b);
    raise(b);
  }
  const saved = createReplaySnapshot();
  copyReplayState(saved, replayed.state);
  const savedTick = replayed.tick;
  const ghoul = replayed.king.placed;
  replayed.foe.facing = ghoul.x < replayed.foe.motion.x ? -1 : 1;
  replayed.foe.motion.x = f32(ghoul.x - f32(replayed.foe.facing * 70.0));
  beginFighterAttack(replayed.state.world, 1, AttackStyle.forwardTilt, false);
  for (let n = 0; n < 12; n++) step(replayed, HOLD);
  assertGreaterThan(replayed.king.placed.percent, 0.0);
  copyReplayState(replayed.state, saved);
  replayed.tick = savedTick;
  for (let n = 0; n < 200; n++) {
    step(straight);
    step(replayed);
  }
  assertGreaterThan(straight.king.placed.life, 0);
  assertGreaterThan(straight.foe.status.damage, 0.0);
  assertEquals(firstStateDifference(straight.state, replayed.state), undefined);
});
