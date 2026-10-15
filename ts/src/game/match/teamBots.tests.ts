import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { attackBuffer } from "../input/attackBuffer";
import { Character } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { createRoster, neutralControls } from "../sim/roster";
import { produceComputerInput } from "./botPlay";
import { createPacingAndPresentation } from "./pacingAndPresentation";
import { Phase, createMatchState, setParticipants } from "../lobby/lobbyState";
import { configureMatchTeams } from "./step";

test("seeded CPU reads select the farther enemy over a nearer teammate and hold attacks with a teammate in the friendly fire lane [k1 scenario]", () => {
  for (let seed = 0; seed < 8; seed++) for (const teamBattle of [false, true]) for (const friendlyFire of [false, true]) {
    const game = createMatchState();
    setParticipants(game, 2, 5);
    game.teamBattle = teamBattle; game.friendlyFire = friendlyFire;
    game.teamChoices[0] = 0; game.teamChoices[1] = 0; game.teamChoices[2] = 1;
    game.matchSeed = seed; game.phase = Phase.match; game.stageChoice = 0;
    game.cpuResolvedOpponents[0] = "wren"; game.cpuTiers[0] = "expert";
    const world = createRoster(7, [createFighter(Character.rifleman, 0.0, 1), createFighter(Character.rifleman, 20.0, -1), createFighter(Character.rifleman, 80.0, -1)]);
    configureMatchTeams(game, world);
    const runtime = createPacingAndPresentation();
    const input = neutralControls(); const commands = attackBuffer(0);
    let observed = false;
    let attacks = 0;
    for (let frame = 1; frame <= 80; frame++) {
      produceComputerInput(game, world, runtime, 0, frame, input, commands);
      const opponent = runtime.botStrategies[0].opponent;
      if (opponent >= 0) { observed = true; assertEquals(opponent, teamBattle ? 2 : 1); }
      if (commands.pending !== undefined || input.attackRequested || input.attackPressed || input.specialPressed || input.ultimatePressed) attacks++;
    }
    assertTrue(observed);
    if (teamBattle && friendlyFire) assertEquals(attacks, 0);
    else assertTrue(attacks > 0);
  }
});
