import { expect, test } from "bun:test";
import { standalonePreload } from "../scripts/wisp/standalone";
import { WHITE_FIGHTER_MODELS } from "../src/generated/assets/whiteFighterModels";
import * as impacts from "../src/game/assets/impactAssetInfo";
import { PARTICIPANT_SLOTS } from "../src/game/input/participants";
import { STAGE_CATALOG } from "../src/game/menu/stageCatalog";
import { stageModels } from "../src/game/presentation/stagePreload";
import { stageScenery } from "../src/game/presentation/stageScenery";
import { costumesFor } from "../src/game/roster/costumes";
import { SELECTABLE_CHARACTERS } from "../src/game/roster/kits";
import { fighterPortrait } from "../src/game/roster/looks";
import { hudPlateTexture, markerArrowTexture } from "../src/game/ui/hudLayout";

test("the native window's preload holds every selectable stage's decks, sky and hazards, every fighter's white copy and match portraits, the impacts and the HUD plates [k1 scenario]", () => {
  const { preloadModels, preloadTextures } = standalonePreload();
  const models = new Set(preloadModels), textures = new Set(preloadTextures);
  const missing = [
    ...STAGE_CATALOG.flatMap(({ id }) => [...stageModels(id), stageScenery(id).sky]).filter((model) => !models.has(model)),
    ...SELECTABLE_CHARACTERS.flatMap((character) => WHITE_FIGHTER_MODELS[character] ?? []).filter((model) => !models.has(model)),
    ...Object.values(impacts).filter((model) => !models.has(model)),
    ...SELECTABLE_CHARACTERS.flatMap((character) => costumesFor(character).flatMap((_, costume) => PARTICIPANT_SLOTS.flatMap((slot) => (["Bust", "Stock", "Tile"] as const).map((kind) => fighterPortrait(character, kind, slot, costume))))).filter((texture) => !textures.has(texture)),
    ...PARTICIPANT_SLOTS.flatMap((slot) => [hudPlateTexture(slot, false), hudPlateTexture(slot, true), markerArrowTexture(slot)]).filter((texture) => !textures.has(texture)),
  ];
  expect(missing).toEqual([]);
  expect(preloadModels.some((model) => /\.(blp|tga)$/i.test(model))).toBe(false);
});
