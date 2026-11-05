import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { Phase, createMatchState } from "../lobby/lobbyState";
import { stepArcadeTier } from "../lobby/matchMode";
import { CPU_TIERS } from "../match/cpuProfiles";
import { rulesPillParts, rulesSummary } from "../session/messages";
import { reactionLead } from "../core/computerLead";
import { ARCADE_STAGES, ARCADE_SPINE, StageKind } from "./spine";
import { ARCADE_CHARACTERS, arcadeTable } from "./tables";
import { arcadePlan, homeArena } from "./plan";
import { ArcadeStep, continueArcade, startArcade } from "./arcade";
import { arcadeResultHelp, arcadeTierSetting, tierName } from "./arcadeText";
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

interface Played {
  readonly fights: number[];
  readonly opponents: Character[];
  readonly arenas: number[];
  readonly leads: number[];
}

function playWon(fighter: Character, tier: number, seed: number): Played {
  const game = begin(fighter, tier, seed);
  const played: Played = { fights: [], opponents: [], arenas: [], leads: [] };
  for (let guard = 0; guard < ARCADE_STAGES + 1; guard++) {
    const entry = game.run.current;
    if (entry === undefined) break;
    played.fights.push(game.run.fight);
    for (const opponent of entry.opponents) played.opponents.push(opponent.character);
    played.arenas.push(entry.stage);
    played.leads.push(reactionLead(game.run));
    if (finish(game, RunOutcome.won) === ArcadeStep.menu) break;
  }
  assertFalse(game.run.active);
  return played;
}

test("an Arcade run for every featured fighter at each tier plays hallway, hallway, elite, hallway, hallway, elite, rival with the bonus stage skipped, no opponent twice, the tabled rival last on its home stage and the same draws for the same seed [k3 measure docs/design/arcade-mode.md]", () => {
  for (const fighter of ARCADE_CHARACTERS) {
    const table = arcadeTable(fighter);
    for (let tier = 0; tier < CPU_TIERS.length; tier++) {
      const first = playWon(fighter, tier, 1000 + tier);
      assertEquals(first.fights.join(","), "0,1,2,3,4,5,7");
      assertEquals(first.opponents.length, 7);
      assertEquals(new Set(first.opponents).size, first.opponents.length);
      assertFalse(first.opponents.includes(fighter));
      assertEquals(first.opponents[6], table?.rival);
      assertEquals(first.arenas[6], homeArena(table?.rival ?? fighter));
      assertEquals(first.leads.join(","), "0,0,1,1,2,2,3");
      const again = playWon(fighter, tier, 1000 + tier);
      assertEquals(again.opponents.join(","), first.opponents.join(","));
      assertEquals(again.arenas.join(","), first.arenas.join(","));
    }
    const kinds = arcadePlan(fighter, 7).map(plan => plan.kind);
    assertEquals(kinds.join(","), ARCADE_SPINE.map(stage => stage.kind).join(","));
    assertEquals(kinds.join(","), [StageKind.hallway, StageKind.hallway, StageKind.elite, StageKind.hallway, StageKind.hallway, StageKind.elite, StageKind.bonus, StageKind.rival].join(","));
    for (let seed = 0; seed < 40; seed++) {
      const plan = arcadePlan(fighter, seed);
      const everyone = plan.flatMap(stage => stage.opponents);
      assertFalse(everyone.includes(fighter));
      assertFalse(everyone.includes(table?.ally ?? fighter));
    }
  }
});

test("different seeds draw different runs for the same fighter [k2 property]", () => {
  const fighter = Character.demonHunter;
  const runs = new Set<string>();
  for (let seed = 0; seed < 40; seed++) runs.add(arcadePlan(fighter, seed).flatMap(stage => stage.opponents).join(","));
  assertTrue(runs.size > 5);
});

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

test("Arcade's tier is chosen only before stage 1 among Peon, Grunt and Warchief with Grunt the default, and every computer fighter is Wren at that tier [k3 measure docs/design/arcade-mode.md]", () => {
  const game = createMatchState();
  game.arcade = true;
  assertEquals(arcadeTierSetting(game.arcadeTier), "Arcade tier: Grunt");
  stepArcadeTier(game, PLAYER, -1);
  stepArcadeTier(game, PLAYER, -1);
  assertEquals(rulesPillParts(game).join(" "), "Arcade Peon");
  stepArcadeTier(game, PLAYER, 1);
  stepArcadeTier(game, PLAYER, 1);
  stepArcadeTier(game, PLAYER, 1);
  assertEquals(rulesSummary(game), "Arcade · Warchief tier");
  assertEquals(tierName(game.arcadeTier), "Warchief");
  const fighter = Character.demonHunter;
  game.characterChoices[PLAYER] = fighter;
  game.characterReadiness[PLAYER] = true;
  assertTrue(startArcade(game, PLAYER));
  stepArcadeTier(game, PLAYER, -1);
  assertEquals(game.arcadeTier, CPU_TIERS.length - 1);
  for (let fight = 0; fight < ARCADE_STAGES; fight++) {
    for (const opponent of game.run.current?.opponents ?? []) {
      assertEquals(opponent.opponent, "wren");
      assertEquals(opponent.tier, "warchief");
    }
    if (finish(game, RunOutcome.won) !== ArcadeStep.fight) break;
  }
});
