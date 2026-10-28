import { assertEquals, assertGreaterThan, test } from "wisp/src/runtime/testing";
import { copyFighterState } from "../../../generated/state/fighterState";
import { Phase } from "../../lobby/lobbyState";
import { stepMatch } from "../../match/step";
import { createReplaySnapshot, type ReplayState } from "../../replay/snapshot";
import { Character, SpecialAction } from "../../sim/codes";
import { createFighter, type Fighter } from "../../sim/fighter";
import { fillMeter } from "../../sim/meter";
import { type Controls, copyControls, fighterAt } from "../../sim/roster";
import { controls } from "../../sim/testWorld";

const FOE_X = 300.0;
const HIT_FRAME = 32;
const END_FRAME = 56;
const ANIMATE_DEAD = controls({ specialPressed: true, ultimatePressed: true, attackHeld: true });

interface Bout {
  readonly state: ReplayState;
  readonly king: Fighter;
  readonly foe: Fighter;
  tick: number;
}

function bout(): Bout {
  const state = createReplaySnapshot();
  copyFighterState(fighterAt(state.world, 0), createFighter(Character.lichKing, 0.0, 1), 3);
  copyFighterState(fighterAt(state.world, 1), createFighter(Character.warden, FOE_X, -1), 3);
  state.match.phase = Phase.match;
  state.match.stageChoice = 0;
  state.match.matchSeed = 360;
  state.match.hazards = false;
  state.match.items.on = false;
  state.match.timeLimitMinutes = 0;
  const king = fighterAt(state.world, 0);
  const b: Bout = { state, king, foe: fighterAt(state.world, 1), tick: 0 };
  for (let frame = 0; frame < 8; frame++) step(b);
  fillMeter(king);
  return b;
}

function step(b: Bout, first: Readonly<Controls> = controls()): void {
  b.tick++;
  copyControls(b.state.controls.inputs[0], first);
  copyControls(b.state.controls.inputs[1], controls());
  stepMatch(b.state.match, b.state.world, b.state.controls, b.tick);
}

test("Animate Dead: the dead claw up under the marked foe on frame 32 and the cast ends on frame 56 [k1 scenario]", () => {
  const b = bout();
  step(b, ANIMATE_DEAD);
  assertEquals(b.king.special.action, SpecialAction.heroUltimate);
  let hit = 0;
  let ended = 0;
  for (let n = 1; n <= 90 && ended === 0; n++) {
    if (hit === 0 && b.foe.status.damage > 0.0) hit = n;
    if (b.king.special.action !== SpecialAction.heroUltimate) ended = n;
    else step(b);
  }
  assertGreaterThan(hit, 0);
  assertEquals(hit, HIT_FRAME);
  assertEquals(ended, END_FRAME);
});
