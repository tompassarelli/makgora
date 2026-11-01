import { expect, test } from "bun:test";
import { Character } from "../src/game/sim/codes";
import { ALL_HEROES, fighterName } from "../src/game/roster/kits";
import { fighterRenderedCues } from "../src/game/presentation/attackCues";
import { fighterProjectileModels } from "../src/game/presentation/projectileArt";
import { ITEM_MODELS } from "../src/game/presentation/itemLook";

const modelKey = (model: string): string => model.toLowerCase().replace(/\.md[lx]$/, "");

function fighterModels(): ReadonlyMap<string, string> {
  const drawn = new Map<string, string>();
  for (const character of [Character.rifleman, Character.demonHunter, ...ALL_HEROES.map(({ character }) => character)]) {
    const models = [...fighterRenderedCues(character).filter(({ drawn }) => drawn !== true).map(({ model }) => model), ...fighterProjectileModels(character)];
    for (const model of models) if (!drawn.has(modelKey(model))) drawn.set(modelKey(model), fighterName(character));
  }
  return drawn;
}

test("a centre-stage item pickup draws no model a fighter's move draws, so it never reads as a move's leftover effect [k2 property]", () => {
  const drawn = fighterModels();
  expect(drawn.size).toBeGreaterThan(50);
  const shared = [ITEM_MODELS.speedPickup, ITEM_MODELS.heavyPickup].flatMap((model) => {
    const fighter = drawn.get(modelKey(model));
    return fighter === undefined ? [] : [`${model} (${fighter})`];
  });
  expect(shared).toEqual([]);
});
