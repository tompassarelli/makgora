import { assertEquals, test } from "wisp/src/runtime/testing";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { createFighter } from "../sim/fighter";
import { createRoster, fighterAt } from "../sim/roster";
import { type Team } from "../sim/teams";
import { Phase, advanceClock, allCharactersReady, createMatchState, cycleTeam, resolveStocks, setParticipants, setTeamBattle, winningMask } from "../lobby/lobbyState";

test("team stock resolution and winning credit follow every four-slot partition and survivor mask, with free for all unchanged [k2 property]", () => {
  const teams: readonly Team[] = [0, 1, 2, 3];
  const world = createRoster(15, PARTICIPANT_SLOTS.map(() => createFighter(1, 0.0, 1)));
  for (const a of teams) for (const b of teams) for (const c of teams) for (const d of teams) {
    for (let survivors = 0; survivors < 16; survivors++) for (const teamBattle of [false, true]) {
      const game = createMatchState();
      setParticipants(game, 1, 14);
      game.teamBattle = teamBattle;
      game.teamChoices[0] = a; game.teamChoices[1] = b; game.teamChoices[2] = c; game.teamChoices[3] = d;
      game.phase = Phase.match;
      let aliveTeams = 0;
      let aliveCount = 0;
      for (const slot of PARTICIPANT_SLOTS) {
        const alive = (survivors & (1 << slot)) !== 0;
        fighterAt(world, slot).status.stocks = alive ? 1 : 0;
        if (alive) { aliveCount++; aliveTeams |= 1 << game.teamChoices[slot]; }
      }
      resolveStocks(game, world);
      const ended = teamBattle ? (aliveTeams & (aliveTeams - 1)) === 0 : aliveCount <= 1;
      assertEquals(game.phase, ended ? Phase.result : Phase.match);
      if (!ended || survivors === 0) { assertEquals(winningMask(game), 0); continue; }
      let expected = 0;
      for (const slot of PARTICIPANT_SLOTS) {
        if ((survivors & (1 << slot)) === 0) continue;
        if (teamBattle) {
          for (const member of PARTICIPANT_SLOTS) if (game.teamChoices[member] === game.teamChoices[slot]) expected |= 1 << member;
        } else expected = 1 << slot;
      }
      assertEquals(winningMask(game), expected);
    }
  }
});

test("team setup requires opponents and time adjudication sums team stocks then living damage across 2v2 3v1 and 2v1v1 [k2 property]", () => {
  const world = createRoster(15, PARTICIPANT_SLOTS.map(() => createFighter(1, 0.0, 1)));
  const partitions: readonly (readonly Team[])[] = [[0, 0, 1, 1], [0, 0, 0, 1], [0, 0, 1, 2]];
  for (const partition of partitions) for (let leadingTeam = 0; leadingTeam < 4; leadingTeam++) {
    const game = createMatchState();
    setParticipants(game, 1, 14);
    game.characterReadiness.fill(true);
    setTeamBattle(game, 0, true);
    for (const slot of PARTICIPANT_SLOTS) game.teamChoices[slot] = partition[slot] ?? 0;
    assertEquals(allCharactersReady(game), true);
    game.phase = Phase.match;
    game.remainingFrames = 1;
    game.matchFrame = 1;
    game.startHold = 0;
    let exists = false;
    for (const slot of PARTICIPANT_SLOTS) {
      const leading = game.teamChoices[slot] === leadingTeam;
      exists = exists || leading;
      fighterAt(world, slot).status.stocks = leading ? 9 : 1;
      fighterAt(world, slot).status.damage = 0.0;
    }
    advanceClock(game, world);
    assertEquals(game.phase, Phase.result);
    if (exists) {
      let expected = 0;
      for (const slot of PARTICIPANT_SLOTS) if (game.teamChoices[slot] === leadingTeam) expected |= 1 << slot;
      assertEquals(winningMask(game), expected);
    }
  }
  const game = createMatchState();
  setParticipants(game, 1, 14);
  game.characterReadiness.fill(true);
  setTeamBattle(game, 0, true);
  game.teamChoices.fill(0);
  assertEquals(allCharactersReady(game), false);
  cycleTeam(game, 0, 1, 1);
  assertEquals(allCharactersReady(game), true);
  cycleTeam(game, 1, 0, 1);
  assertEquals(game.teamChoices[0], 0);
  game.phase = Phase.match; game.remainingFrames = 1; game.matchFrame = 1;
  game.teamChoices[0] = 0; game.teamChoices[1] = 0; game.teamChoices[2] = 1; game.teamChoices[3] = 1;
  for (const slot of PARTICIPANT_SLOTS) { fighterAt(world, slot).status.stocks = 1; fighterAt(world, slot).status.damage = 10.0; }
  advanceClock(game, world);
  assertEquals(winningMask(game), 0);
  game.phase = Phase.match; game.remainingFrames = 1;
  fighterAt(world, 3).status.damage = 20.0;
  advanceClock(game, world);
  assertEquals(winningMask(game), 3);
});
