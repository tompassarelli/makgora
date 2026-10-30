import { assertEquals, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Phase } from "../../lobby/lobbyState";
import { initializeMatchFighters, stepMatch } from "../../match/step";
import { createReplaySnapshot, type ReplayState } from "../../replay/snapshot";
import { Character, DownState, DuoOrder } from "../../sim/codes";
import { createFighter } from "../../sim/fighter";
import { createRoster, fighterAt } from "../../sim/roster";

const LEADER = 0;
const FOE = 1;
const PARTNER = 2;
const OFF_STAGE = 10000.0;

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

test("Grgl's blast-zone KO keeps Mrgl's stocks and the match running [k3 measure docs/design/murloc.md]", () => {
  const d = duel();
  const stocks = at(d, LEADER).status.stocks;
  at(d, PARTNER).motion.x = OFF_STAGE;
  steps(d, 300);
  assertEquals(at(d, PARTNER).status.out, true, "Grgl is out");
  assertEquals(at(d, PARTNER).status.stocks, 0, "Grgl leaves without a respawn");
  assertEquals(at(d, LEADER).status.stocks, stocks, "Mrgl keeps every stock");
  assertEquals(at(d, LEADER).status.out, false, "Mrgl plays on");
  assertEquals(d.state.match.phase, Phase.match, "the match keeps running");
});

test("Mrgl's stock loss removes Grgl at once and both respawn together at 0% [k3 measure docs/design/murloc.md]", () => {
  const d = duel();
  const stocks = at(d, LEADER).status.stocks;
  at(d, LEADER).status.damage = 90.0;
  at(d, PARTNER).status.damage = 40.0;
  at(d, LEADER).motion.x = -OFF_STAGE;
  steps(d, 1);
  assertEquals(at(d, LEADER).status.stocks, stocks - 1, "Mrgl loses one stock");
  assertEquals(at(d, PARTNER).status.out, true, "Grgl leaves on the same frame");
  steps(d, 200);
  assertEquals(at(d, LEADER).status.out, false, "Mrgl is back");
  assertEquals(at(d, PARTNER).status.out, false, "Grgl is back with him");
  assertEquals(at(d, PARTNER).status.stocks, 1, "Grgl is alive again");
  assertEquals(at(d, PARTNER).status.damage, 0.0, "Grgl returns at 0%");
  assertEquals(at(d, LEADER).status.stocks, stocks - 1, "Grgl's return costs no stock");
});

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

test("Grgl faints at 70.0% into a 30-frame knockdown then leaves [k3 measure docs/design/murloc.md]", () => {
  const near = duel();
  at(near, PARTNER).status.damage = f32(69.9);
  steps(near, 2);
  assertEquals(at(near, PARTNER).duo?.order, DuoOrder.copy, "69.9% does not faint");
  const d = duel();
  const stocks = at(d, LEADER).status.stocks;
  at(d, PARTNER).status.damage = 70.0;
  steps(d, 1);
  assertEquals(at(d, PARTNER).duo?.order, DuoOrder.fainted, "70.0% faints");
  assertEquals(at(d, PARTNER).down.state, DownState.wait, "Grgl is knocked down");
  steps(d, 28);
  assertEquals(at(d, PARTNER).status.out, false, "he is still down inside the 30 frames");
  steps(d, 2);
  assertEquals(at(d, PARTNER).status.out, true, "he leaves when the knockdown ends");
  assertEquals(at(d, LEADER).status.stocks, stocks, "Mrgl keeps every stock");
  assertEquals(d.state.match.phase, Phase.match, "the match keeps running");
});
