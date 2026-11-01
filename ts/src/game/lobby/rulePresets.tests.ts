import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { ALL_ITEMS_MASK, ItemKind } from "../sim/codes";
import { rulesPillParts } from "../session/messages";
import { MATCH_MODES, Phase, chooseMatchMode, createMatchState, matchMode, setItemsOn, setStocks, setTimeLimit, setUltimatesOn, toggleItemKind } from "./lobbyState";
import { RULE_PRESETS, applyRulePreset } from "./rulePresets";

test("Reset default gives a fresh lobby's rules back, and Tourney, Party and Endless set only the rules they name [k2 property]", () => {
  const fresh = createMatchState();
  const game = createMatchState();
  setStocks(game, 0, 8);
  setTimeLimit(game, 0, 2);
  setItemsOn(game, 0, true);
  toggleItemKind(game, 0, ItemKind.heavy);
  setUltimatesOn(game, 0, false);
  applyRulePreset(game, 0, "standard");
  assertEquals([game.stockCount, game.timeLimitMinutes, game.items.on, game.items.enabledMask, game.ultimatesOff, game.endless, game.automaticRematch],
    [fresh.stockCount, fresh.timeLimitMinutes, fresh.items.on, fresh.items.enabledMask, fresh.ultimatesOff, fresh.endless, fresh.automaticRematch]);
  assertEquals(game.items.enabledMask, ALL_ITEMS_MASK);
  applyRulePreset(game, 0, "tourney");
  assertEquals([game.stockCount, game.timeLimitMinutes, game.items.on, game.ultimatesOff, game.endless], [4, 8, false, true, false]);
  setStocks(game, 0, 2);
  applyRulePreset(game, 0, "party");
  assertEquals([game.stockCount, game.timeLimitMinutes, game.items.on, game.ultimatesOff], [2, 8, true, false]);
  applyRulePreset(game, 0, "endless");
  assertTrue(game.endless);
  assertEquals(RULE_PRESETS.endless.stocks, undefined);
});

test("A preset changes nothing outside character select or for a slot with no human [k2 property]", () => {
  const game = createMatchState();
  applyRulePreset(game, 3, "tourney");
  assertEquals(game.stockCount, createMatchState().stockCount);
  game.phase = Phase.stageMenu;
  applyRulePreset(game, 0, "tourney");
  assertFalse(game.ultimatesOff);
});

test("Choosing a mode from the list reaches every mode from every mode, Team Battle stays on only when Versus is chosen again [k2 property]", () => {
  for (const from of MATCH_MODES) for (const to of MATCH_MODES) {
    const game = createMatchState();
    chooseMatchMode(game, 0, from);
    assertEquals(matchMode(game), from);
    if (from === "versus") game.teamBattle = true;
    chooseMatchMode(game, 0, to);
    assertEquals(matchMode(game), to);
    assertEquals(game.teamBattle, from === "versus" && to === "versus");
  }
});

test("The rules pill reads the live rules: stocks, time, Ultimates and Items in Versus, Endless in place of stocks and time, and each other mode's own line [k2 property]", () => {
  const game = createMatchState();
  assertEquals(rulesPillParts(game).join(" · "), "3 Stocks · 7:00 · Ultimates");
  setUltimatesOn(game, 0, false);
  setItemsOn(game, 0, true);
  setTimeLimit(game, 0, 0);
  assertEquals(rulesPillParts(game).join(" · "), "3 Stocks · No timer · Items");
  applyRulePreset(game, 0, "endless");
  assertEquals(rulesPillParts(game)[0], "Endless");
  chooseMatchMode(game, 0, "training");
  assertEquals(rulesPillParts(game)[0], "Training");
  chooseMatchMode(game, 0, "classic");
  assertEquals(rulesPillParts(game)[0], "Classic");
  chooseMatchMode(game, 0, "lore");
  assertEquals(rulesPillParts(game)[0], "Lore Battle");
});
