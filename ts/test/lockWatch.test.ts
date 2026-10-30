import { expect, test } from "bun:test";
import { emptyInput } from "../src/game/input/inputRow";
import { Phase } from "../src/game/lobby/lobbyState";
import { initializeMatchFighters } from "../src/game/match/step";
import { createReplaySnapshot, type ReplayState } from "../src/game/replay/snapshot";
import { Character, ShieldBreak } from "../src/game/sim/codes";
import { createFighter } from "../src/game/sim/fighter";
import { createRoster, fighterAt } from "../src/game/sim/roster";
import { beginShieldBreak } from "../src/game/sim/shieldBreak";
import { runFrame } from "../scripts/agency";
import { LockWatch } from "../scripts/lockWatch";

const SAMURO = 0;
const DIZZY_WATCH_FRAMES = 360;

function shieldBrokenBesidePair(): ReplayState {
  const state = createReplaySnapshot();
  const world = createRoster(3, [createFighter(Character.blademaster, 0.0, -1), createFighter(Character.murloc, -400.0, 1)]);
  const { match } = state;
  match.phase = Phase.match;
  match.stageChoice = 0;
  match.startHold = 0;
  match.hazards = false;
  match.items.on = false;
  match.timeLimitMinutes = 0;
  match.ultimatesOff = true;
  initializeMatchFighters(match, world);
  fighterAt(world, SAMURO).status.damage = 37.0;
  beginShieldBreak(world, SAMURO);
  return { ...state, world };
}

test("a shield-broken fighter dizzy beside an idle Murlocs pair is not reported as a lock-loop while the dizzy timer counts down (#801) [k1 scenario]", () => {
  const state = shieldBrokenBesidePair();
  const watch = new LockWatch();
  const rows = () => emptyInput();
  const found: string[] = [];
  let dizzyFrames = 0;
  for (let frame = 0; frame < DIZZY_WATCH_FRAMES; frame++) {
    runFrame(state, rows);
    if (fighterAt(state.world, SAMURO).shield.breakState === ShieldBreak.dizzy) dizzyFrames++;
    found.push(...watch.advance(state, rows));
  }
  expect(dizzyFrames).toBeGreaterThan(60);
  expect(found).toEqual([]);
});
