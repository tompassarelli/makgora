import { assertEquals, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { CLASSIC_ROWS } from "../core/selectBarLayout";
import { Phase, createMatchState } from "../lobby/lobbyState";
import { CPU_TIERS } from "../match/cpuProfiles";
import { Character } from "../sim/codes";
import { hoveredRule } from "../ui/ruleHelp";
import { bossHealth } from "./bosses";
import { CLASSIC_FIGHTS, continueClassic, startClassic } from "./classic";
import { classicRoute } from "./routes";
import { RunOutcome } from "./runState";

test("Classic has one difficulty: no picker at fighter selection, the fights run Beginner, Beginner, Intermediate, Intermediate, Advanced and an Advanced boss, and a continue replays the lost fight at its tier [k3 measure docs/design/classic-mode.md]", () => {
  const game = createMatchState();
  const stepper = CLASSIC_ROWS.battle.less;
  const x = f32(stepper.x + f32(stepper.width / 2));
  const y = f32(stepper.y - f32(stepper.height / 2));
  game.classic = true;
  assertEquals(hoveredRule(game, "rules", x, y), undefined);
  game.classic = false;
  game.lore = true;
  assertEquals(hoveredRule(game, "rules", x, y), "previousLoreBattle");
  game.lore = false;
  game.classic = true;

  const fighter = Character.demonHunter;
  const route = classicRoute(fighter);
  game.characterChoices[0] = fighter;
  game.characterReadiness[0] = true;
  assertEquals(startClassic(game, 0), true);
  const tiers: string[] = [];
  const retried: string[] = [];
  const fightTier = (): string => game.run.current?.opponents[0]?.tier ?? "boss";
  for (let fight = 0; fight < CLASSIC_FIGHTS - 1; fight++) {
    tiers.push(fightTier());
    game.phase = Phase.result;
    game.run.outcome = RunOutcome.lost;
    continueClassic(game, 0);
    retried.push(fightTier());
    game.phase = Phase.result;
    game.run.outcome = RunOutcome.won;
    continueClassic(game, 0);
  }
  assertEquals(tiers.join(" "), "beginner beginner intermediate intermediate advanced");
  assertEquals(retried.join(" "), tiers.join(" "));
  const boss = route === undefined ? 0 : bossHealth(route.boss, CPU_TIERS.indexOf("advanced"));
  assertEquals(game.run.current?.bossHealth, boss);
  game.phase = Phase.result;
  game.run.outcome = RunOutcome.lost;
  continueClassic(game, 0);
  assertEquals(game.run.current?.bossHealth, boss);
  assertEquals(game.run.continues, CLASSIC_FIGHTS);
});
