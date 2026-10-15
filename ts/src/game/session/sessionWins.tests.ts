import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { createFighter } from "../sim/fighter";
import { createRoster, fighterAt } from "../sim/roster";
import { type Team } from "../sim/teams";
import { Phase, createMatchState, resolveStocks, setParticipants } from "../lobby/lobbyState";
import { createMatchTally, resultRows } from "../presentation/matchCues";
import { beginSessionMatch, createSessionWins, recordSessionWins } from "./sessionWins";

test("session gold credits once exactly the slots the results rows name as winners across every team partition and survivor mask [k2 property]", () => {
  const world = createRoster(15, PARTICIPANT_SLOTS.map(() => createFighter(1, 0.0, 1)));
  const tally = createMatchTally();
  let sharedWins = 0;
  for (let b = 0; b <= 1; b++) for (let c = 0; c <= b + 1; c++) for (let d = 0; d <= Math.max(b, c) + 1; d++) {
    const choices: readonly Team[] = [0, b as Team, c as Team, d as Team];
    for (let survivors = 1; survivors < 16; survivors++) for (const teamBattle of [false, true]) {
      const game = createMatchState();
      setParticipants(game, 1, 14);
      game.teamBattle = teamBattle;
      for (const slot of PARTICIPANT_SLOTS) {
        game.teamChoices[slot] = choices[slot] ?? 0;
        fighterAt(world, slot).status.stocks = (survivors & (1 << slot)) !== 0 ? 1 : 0;
      }
      game.phase = Phase.match;
      resolveStocks(game, world);
      const wins = createSessionWins();
      beginSessionMatch(wins);
      recordSessionWins(wins, game);
      recordSessionWins(wins, game);
      let credited = 0;
      for (const row of resultRows(game, world, tally)) {
        assertEquals(wins.counts[row.slot], row.winner ? 1 : 0);
        if (row.winner) credited++;
      }
      if (credited > 1) sharedWins++;
    }
  }
  assertTrue(sharedWins > 0);
});
