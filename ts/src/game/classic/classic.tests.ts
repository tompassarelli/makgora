import { assertEquals, test } from "wisp/src/runtime/testing";
import { Phase, createMatchState, stepClassicTier } from "../lobby/lobbyState";
import { CPU_TIERS } from "../match/cpuProfiles";
import { rulesPillParts, rulesSummary } from "../session/messages";
import { Character } from "../sim/codes";
import { bossHealth } from "./bosses";
import { CLASSIC_FIGHTS, continueClassic, startClassic } from "./classic";
import { classicResultHelp, classicResults, classicTierSetting } from "./classicText";
import { classicRoute } from "./routes";
import { RunOutcome } from "./runState";

test("Classic's level is chosen only before fight 1, as Level 1 to Level N with Level 2 the default; each fight's tier climbs start, start, +1, +1, +2 from it with the boss from start + 2, and a continue replays the fight at the same level [k3 measure docs/design/classic-mode.md]", () => {
  const game = createMatchState();
  game.classic = true;
  assertEquals(classicTierSetting(game.classicTier), "Classic start: Level 2");
  stepClassicTier(game, 0, -1);
  stepClassicTier(game, 0, -1);
  assertEquals(rulesPillParts(game).join(" "), "Classic Level 1");
  for (let step = 0; step < CPU_TIERS.length + 2; step++) stepClassicTier(game, 0, 1);
  assertEquals(rulesSummary(game), `Classic · starts at Level ${CPU_TIERS.length}`);
  stepClassicTier(game, 0, -1);
  stepClassicTier(game, 0, -1);
  const start = game.classicTier;
  assertEquals(start, CPU_TIERS.length - 3);

  const fighter = Character.demonHunter;
  const route = classicRoute(fighter);
  game.characterChoices[0] = fighter;
  game.characterReadiness[0] = true;
  assertEquals(startClassic(game, 0), true);
  const tiers: string[] = [];
  const retried: string[] = [];
  const fightTier = (): string => game.run.current?.opponents[0]?.tier ?? "boss";
  const tryChange = (phase: Phase): void => {
    const shown = game.phase;
    const stored = game.classicTier;
    game.phase = phase;
    stepClassicTier(game, 0, 1);
    assertEquals(game.classicTier, stored);
    game.phase = shown;
    game.classicTier = 0;
  };
  for (let fight = 0; fight < CLASSIC_FIGHTS - 1; fight++) {
    tiers.push(fightTier());
    tryChange(Phase.characterMenu);
    game.phase = Phase.result;
    game.run.outcome = RunOutcome.lost;
    assertEquals(classicResultHelp(game, "A"), "Press A to try this fight again. Back ends the run.");
    continueClassic(game, 0);
    retried.push(fightTier());
    tryChange(Phase.result);
    game.phase = Phase.result;
    game.run.outcome = RunOutcome.won;
    continueClassic(game, 0);
  }
  const climb = [0, 0, 1, 1, 2].map(rise => CPU_TIERS[Math.min(CPU_TIERS.length - 1, start + rise)]);
  assertEquals(tiers.join(" "), climb.join(" "));
  assertEquals(retried.join(" "), tiers.join(" "));
  assertEquals(rulesPillParts(game).join(" "), `Classic Level ${start + 1}`);
  const boss = route === undefined ? 0 : bossHealth(route.boss, Math.min(CPU_TIERS.length - 1, start + 2));
  assertEquals(game.run.current?.bossHealth, boss);
  game.phase = Phase.result;
  game.run.outcome = RunOutcome.lost;
  continueClassic(game, 0);
  assertEquals(game.run.current?.bossHealth, boss);
  assertEquals(game.run.continues, CLASSIC_FIGHTS);
  assertEquals(classicResults(game).endsWith(` · 6 continues · Level ${start + 1}`), true);
});
