import { expect, test } from "bun:test";
import baseline from "../scripts/balanceBaseline.json";
import { fighterSlug } from "../src/game/roster/kits";
import { gatedFighters } from "../src/game/roster/forge";
import { currentKit } from "../scripts/balanceKit";
import { currentFeel, killPercentNear } from "../scripts/balanceFeel";
import { kitFailures, feelFailures, type Baseline } from "../scripts/balanceOptimizer";

const frozen: Baseline = baseline;

test("the fixed baseline holds exactly the selectable roster, and every fighter's current kit and feel keys sit inside its recorded bounds [k3 measure docs/design/balance.md]", () => {
  expect(Object.keys(frozen).sort()).toEqual(gatedFighters().map(fighterSlug).sort());
  for (const character of gatedFighters()) {
    const name = fighterSlug(character);
    const start = frozen[name];
    expect(start).toBeDefined();
    if (start === undefined) continue;
    expect([name, ...kitFailures(currentKit(character).values, start.values)]).toEqual([name]);
    expect([name, ...feelFailures(currentFeel(character, killPercentNear(start.feel)), start.feel)]).toEqual([name]);
  }
}, 120_000);
