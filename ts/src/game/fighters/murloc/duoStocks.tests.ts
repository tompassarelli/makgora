import { assertEquals, test } from "wisp/src/runtime/testing";
import { Phase } from "../../lobby/lobbyState";
import { initializeMatchFighters, stepMatch } from "../../match/step";
import { createReplaySnapshot, type ReplayState } from "../../replay/snapshot";
import { Character } from "../../sim/codes";
import { createFighter } from "../../sim/fighter";
import { createRoster, fighterAt } from "../../sim/roster";

const LEADER = 0;
const FOE = 1;
const PARTNER = 2;

interface Duel {
  readonly state: ReplayState;
  tick: number;
}

function duel(): Duel {
  const state = { ...createReplaySnapshot(), world: createRoster(3, [createFighter(Character.murloc, -240.0, 1), createFighter(Character.peon, 240.0, -1)]) };
  state.match.phase = Phase.match;
  state.match.stageChoice = 0;
  state.match.hazards = false;
  state.match.items.on = false;
  state.match.timeLimitMinutes = 0;
  initializeMatchFighters(state.match, state.world);
  return { state, tick: 0 };
}

function steps(d: Duel, count: number): void {
  for (let frame = 0; frame < count; frame++) stepMatch(d.state.match, d.state.world, d.state.controls, ++d.tick);
}

const at = (d: Duel, slot: number) => fighterAt(d.state.world, slot);

test("Mrgl's last stock ends the match with Grgl alive [k3 measure docs/design/murloc.md]", () => {
  const lost = duel();
  at(lost, LEADER).status.stocks = 0;
  at(lost, LEADER).status.out = true;
  steps(lost, 1);
  assertEquals(at(lost, PARTNER).status.out, false, "Grgl is alive");
  assertEquals(lost.state.match.phase, Phase.result, "the match ends");
  assertEquals(lost.state.match.winner, FOE, "the foe wins");
  const won = duel();
  at(won, FOE).status.stocks = 0;
  at(won, FOE).status.out = true;
  steps(won, 1);
  assertEquals(won.state.match.phase, Phase.result, "the foe's last stock ends the match");
  assertEquals(won.state.match.winner, LEADER, "Mrgl wins, not tied with Grgl");
});
