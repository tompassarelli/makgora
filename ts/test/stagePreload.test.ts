import { expect, test } from "bun:test";
import { STAGE_DECK_PALETTES } from "../src/game/assets/stagePalette";
import { STAGE_CATALOG } from "../src/game/menu/stageCatalog";
import { deckModel, preloadModels, preloadSkies } from "../src/game/presentation/stagePreload";
import { stageScenery } from "../src/game/presentation/stageScenery";
import { SKY_STAGE, surfaceCount } from "../src/game/sim/stage";

const preloadable = [...new Set([SKY_STAGE, ...STAGE_CATALOG.map(({ id }) => id), ...STAGE_DECK_PALETTES.map(({ stage }) => stage)])];

test("the standalone preload holds every deck model, whose terrain textures the window pushes with it, and the sky of the Sky stage that tutorials and quick matches play on and of each selectable and palette stage [k1 scenario]", () => {
  const models = new Set(preloadModels()), skies = new Set(preloadSkies());
  expect(preloadable).toContain(SKY_STAGE);
  for (const stage of preloadable) {
    expect(surfaceCount(stage)).toBeGreaterThan(0);
    for (let index = 0; index < surfaceCount(stage); index++) expect(models.has(deckModel(stage, index))).toBe(true);
    expect(skies.has(stageScenery(stage).sky)).toBe(true);
  }
});
