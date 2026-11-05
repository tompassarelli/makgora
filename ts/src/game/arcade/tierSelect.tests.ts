import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { at } from "wisp/src/runtime/lookup";
import { VERIFIED_STOCK_SOUNDS } from "../../generated/assets/stockSoundInfo";
import { createMatchState } from "../lobby/lobbyState";
import { stepArcadeTier } from "../lobby/matchMode";
import { CPU_TIERS } from "../match/cpuProfiles";
import { createMenuCues, createMenuObservation, menuFrameCues } from "../presentation/matchCues";
import { tierVoice } from "../presentation/tierVoice";
import { RACES, fighterRace } from "../roster/races";
import { SELECTABLE_CHARACTERS } from "../roster/kits";
import { arcadeGuidance } from "./arcadeText";

const PLAYER = 0;
const GUIDANCE = [
  "New to fighting games, or to this fighter? Start here.",
  "You've played platform fighters, but not this fighter.",
  "You know fighting games and this fighter. No continues.",
];

test("With Arcade chosen the select bar shows the guidance line of the shown tier, and no line outside Arcade [k3 measure docs/design/arcade-mode.md]", () => {
  const game = createMatchState();
  for (const mode of [false, true]) {
    game.arcade = mode;
    for (let tier = 0; tier < CPU_TIERS.length; tier++) {
      game.arcadeTier = tier;
      assertEquals(arcadeGuidance(game), mode ? at(GUIDANCE, tier) : "");
    }
  }
  game.arcade = false;
  game.training = true;
  assertEquals(arcadeGuidance(game), "");
});

test("Every pickable fighter's race maps to three stock voice paths, one per tier, all in the stock sound list and none imported [k3 measure docs/design/sound-table.md]", () => {
  const seen = new Set<string>();
  for (const fighter of SELECTABLE_CHARACTERS) {
    const paths = CPU_TIERS.map((_, tier) => tierVoice(fighter, tier));
    assertEquals(new Set(paths).size, CPU_TIERS.length);
    for (const path of paths) {
      assertTrue(VERIFIED_STOCK_SOUNDS[path] !== undefined);
      assertTrue(path.startsWith("Units\\"));
      seen.add(path);
    }
    assertTrue(RACES.includes(fighterRace(fighter)));
  }
  assertEquals(seen.size, RACES.length * CPU_TIERS.length);
});

test("A tier change in Arcade's select raises the tier voice cue once, and neither entering Arcade nor a step outside Arcade does [k3 measure docs/design/arcade-mode.md]", () => {
  const game = createMatchState();
  const before = createMenuObservation();
  const cues = createMenuCues();
  menuFrameCues(before, game, undefined, cues);
  game.arcade = true;
  menuFrameCues(before, game, undefined, cues);
  assertFalse(cues.tier);
  stepArcadeTier(game, PLAYER, 1);
  menuFrameCues(before, game, undefined, cues);
  assertTrue(cues.tier);
  menuFrameCues(before, game, undefined, cues);
  assertFalse(cues.tier);
  game.arcade = false;
  menuFrameCues(before, game, undefined, cues);
  game.arcadeTier = 0;
  menuFrameCues(before, game, undefined, cues);
  assertFalse(cues.tier);
});
