import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { VERIFIED_STOCK_SOUNDS } from "../../generated/assets/stockSoundInfo";
import { CPU_TIERS } from "../match/cpuProfiles";
import { tierVoice } from "../presentation/tierVoice";
import { RACES, fighterRace } from "../roster/races";
import { SELECTABLE_CHARACTERS } from "../roster/kits";

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
