import { assertEquals, assertFalse, test } from "wisp/src/runtime/testing";
import { createMatchState } from "../lobby/lobbyState";
import { createPacingAndPresentation } from "./pacingAndPresentation";
import { createFighter } from "../sim/fighter";
import { createRoster, fighterAt } from "../sim/roster";
import { reactionDelay } from "./botPlay";
import { CPU_TIERS } from "./cpuProfiles";
import { cpuSkill } from "./cpuSkill";
import { TIERS_TUNED_DELAY, computerLead, setComputerLead } from "../core/computerLead";

test("A computer reacts as many frames sooner as the match's input delay is below the 2 its tier was tuned at, since its own input skips the delay a human press waits through, and at 2 or more the match carries no lead at all, so earlier replays keep their state [k1 scenario]", () => {
  const game = createMatchState();
  assertEquals(TIERS_TUNED_DELAY, 2);
  for (const [delay, lead] of [[0, 2], [1, 1], [2, 0], [5, 0]] as const) {
    setComputerLead(game, delay);
    assertEquals(computerLead(game), lead);
    assertEquals("computerLead" in game, lead !== 0);
  }
});

test("At input delay 1 every tier answers the same cue one frame sooner than at 2, keeping the gap between a human press and the computer's answer the tiers were tuned at [k1 scenario]", () => {
  const world = createRoster(3, [createFighter(1, -200.0, 1), createFighter(2, 200.0, -1)]);
  const runtime = createPacingAndPresentation();
  for (const tier of CPU_TIERS) {
    const skill = cpuSkill("wren", tier);
    const tuned = createMatchState();
    tuned.cpuTiers[1] = tier;
    const native = createMatchState();
    native.cpuTiers[1] = tier;
    setComputerLead(native, 1);
    const fighter = fighterAt(world, 1);
    const at2 = reactionDelay(tuned, world, runtime, fighter, 1, 100, skill);
    assertEquals(reactionDelay(native, world, runtime, fighter, 1, 100, skill), at2 - 1, tier);
  }
  assertFalse("computerLead" in createMatchState());
});
