import { assertEquals, test } from "wisp/src/runtime/testing";
import { CPU_OPPONENT_IDS, CPU_PROFILES, CPU_TIER_DEFAULT, CPU_TIERS, cpuProfile, cpuProfileLabel, isCpuTier, stepCpuTier } from "../match/cpuProfiles";
import { createTapeSession } from "../replay/tapeRunner";
import { cycleSlotMode, selectCharacter, setCpuTier } from "./lobbyState";
import { PLAYABLE_CHARACTERS } from "../roster/kits";
import { at } from "wisp/src/runtime/lookup";

test("Opponent settings steps through Peon, Grunt and Warchief with Grunt the default, stops at both ends and labels each profile [k3 measure docs/design/cpu-profiles.md]", () => {
  assertEquals(CPU_TIERS.join(" "), "peon grunt warchief");
  assertEquals(CPU_TIER_DEFAULT, "grunt");
  assertEquals(stepCpuTier("grunt", 1), "warchief");
  assertEquals(stepCpuTier("warchief", 1), "warchief");
  assertEquals(stepCpuTier("grunt", -1), "peon");
  assertEquals(stepCpuTier("peon", -1), "peon");
  assertEquals(cpuProfileLabel("rook", "grunt"), "Rook · Grunt");
  assertEquals(CPU_PROFILES.length, CPU_OPPONENT_IDS.length * CPU_TIERS.length);
  for (const opponent of CPU_OPPONENT_IDS) for (const tier of CPU_TIERS) assertEquals(cpuProfile(opponent, tier).tier, tier);
});

test("a tier that is no longer valid is refused when received and a new CPU slot keeps the default [k3 measure docs/design/cpu-profiles.md]", () => {
  for (const removed of ["rookie", "beginner", "intermediate", "advanced", "expert", ""]) assertEquals(isCpuTier(removed), false);
  for (const kept of CPU_TIERS) assertEquals(isCpuTier(kept), true);
  const game = createTapeSession().live.match;
  selectCharacter(game, 0, at(PLAYABLE_CHARACTERS, 0));
  cycleSlotMode(game, 0, 1);
  cycleSlotMode(game, 0, 1);
  assertEquals(game.cpuTiers[1], CPU_TIER_DEFAULT);
  setCpuTier(game, 0, 1, "advanced" as never);
  assertEquals(game.cpuTiers[1], CPU_TIER_DEFAULT);
  setCpuTier(game, 0, 1, "warchief");
  assertEquals(game.cpuTiers[1], "warchief");
  setCpuTier(game, 0, 1, "expert" as never);
  assertEquals(game.cpuTiers[1], "warchief");
});
