import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { Phase, createMatchState } from "../lobby/lobbyState";
import { CPU_TIERS } from "../match/cpuProfiles";
import { ArcadeStep, continueArcade, startArcade } from "./arcade";
import { arcadeResultHelp } from "./arcadeText";
import { RunOutcome } from "./runState";
import type { MatchState } from "../lobby/lobbyState";
import { Character } from "../sim/codes";

const PLAYER = 0;

function begin(fighter: Character, tier: number, seed: number): MatchState {
  const game = createMatchState();
  game.arcade = true;
  game.arcadeTier = tier;
  game.matchSeed = seed;
  game.characterChoices[PLAYER] = fighter;
  game.characterReadiness[PLAYER] = true;
  assertTrue(startArcade(game, PLAYER));
  return game;
}

function finish(game: MatchState, outcome: RunOutcome): ArcadeStep {
  game.phase = Phase.result;
  game.run.outcome = outcome;
  game.run.cleared = outcome === RunOutcome.won && game.run.current?.last === true;
  return continueArcade(game, PLAYER);
}



test("a loss on Peon or Grunt replays the same stage against the same opponent and counts a continue, and a loss on Warchief ends the run [k3 measure docs/design/arcade-mode.md]", () => {
  const fighter = Character.demonHunter;
  for (let tier = 0; tier < CPU_TIERS.length - 1; tier++) {
    const game = begin(fighter, tier, 77);
    assertEquals(finish(game, RunOutcome.won), ArcadeStep.fight);
    assertEquals(game.run.fight, 1);
    const entry = game.run.current;
    assertEquals(finish(game, RunOutcome.lost), ArcadeStep.fight);
    assertEquals(game.run.fight, 1);
    assertEquals(game.run.current?.opponents[0]?.character, entry?.opponents[0]?.character);
    assertEquals(game.run.current?.stage, entry?.stage);
    assertEquals(game.run.continues, 1);
    assertTrue(game.run.active);
  }
  const game = begin(fighter, CPU_TIERS.length - 1, 77);
  assertEquals(finish(game, RunOutcome.won), ArcadeStep.fight);
  game.phase = Phase.result;
  game.run.outcome = RunOutcome.lost;
  assertEquals(arcadeResultHelp(game, "A"), "Press A to return to fighter selection.");
  assertEquals(finish(game, RunOutcome.lost), ArcadeStep.menu);
  assertFalse(game.run.active);
  assertEquals(game.phase, Phase.characterMenu);
});
