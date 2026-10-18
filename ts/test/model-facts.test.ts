import { expect, test } from "bun:test";
import { MODEL_FACTS } from "../scripts/wisp/modelFacts";
import { SMASHCRAFT_SCENE } from "../scripts/wisp/playerView";
import { sourceNamedModels } from "../scripts/wisp/sourceModels";
import { WHITE_MODEL_FACTS } from "../src/generated/assets/whiteModelFacts";

const key = (model: string) => model.replaceAll("/", "\\").toLowerCase();

test("every model the player-view scene names has measured facts, refreshed by `bun wisp view models ... --only MODEL,...` [k1 scenario]", () => {
  const measured = new Set(Object.keys({ ...MODEL_FACTS, ...WHITE_MODEL_FACTS }).map(key));
  const named = new Set(SMASHCRAFT_SCENE.kinds.flatMap((kind) => kind.models).filter((model) => model !== ""));
  const missing = [...named].filter((model) => !measured.has(key(model))).sort();
  expect(missing).toEqual([]);
});

test("the scene the gate reads names every stock model path the game source spawns, so the suite and the gate see one list [k1 scenario]", () => {
  const named = new Set(SMASHCRAFT_SCENE.kinds.flatMap((kind) => kind.models).map(key));
  const source = sourceNamedModels();
  expect(source).toContain("Abilities\\Weapons\\FrostWyrmMissile\\FrostWyrmMissile.mdx");
  expect(source.filter((model) => !named.has(key(model)))).toEqual([]);
});
