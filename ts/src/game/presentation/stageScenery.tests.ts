import { assertEquals, test } from "wisp/src/runtime/testing";
import { STAGE_CATALOG } from "../menu/stageCatalog";
import { STAGE_GROUND_MODEL, STAGE_LAVA_MODEL, STAGE_PLAGUE_MODEL, STAGE_SEA_MODEL, STAGE_TOMB_SEA_MODEL, STAGE_TOMB_WATER_MODEL } from "../../generated/stages/terrainAssetInfo";
import { hiddenBelow, stageScenery, terrainPieces } from "./stageScenery";
import { driftPose } from "./driftingScenery";
import { max, min } from "../core/numbers";
import { depthProblems, fogProblems, mirrorProblems, paletteProblems, skylineProblems } from "./stageRules";
import { platformParts } from "./stockPlatforms";
import { PATTERNED_DECKS_STAGE, TOMB_OF_SARGERAS_STAGE, WIND_TEST_STAGE, surfaceCount } from "../sim/stage";







const FIGURE_WORDS = ["statue", "totem", "idol", "effigy", "corpse", "skeleton"];

test("each selectable stage has its own sky and fog beyond the fight [k3 measure #170]", () => {
  const skies: string[] = [];
  const fogs: string[] = [];
  for (const { id, name } of STAGE_CATALOG) {
    const { sky, fog } = stageScenery(id);
    assertEquals(sky.length > 0, true, `${name}: missing sky`);
    assertEquals(skies.includes(sky), false, `${name}: shares another stage's sky`);
    skies.push(sky);
    assertEquals(fog !== undefined, true, `${name}: missing fog`);
    if (fog === undefined) continue;
    const color = `${fog.red}/${fog.green}/${fog.blue}`;
    assertEquals(fogs.includes(color), false, `${name}: shares another stage's fog colour`);
    fogs.push(color);
    assertEquals(fogProblems(name, stageScenery(id)).join("\n"), "");
  }
});

test("no stage's scenery pairs a piece with its mirror twin [k3 measure docs/design/stage-art.md]", () => {
  for (const { id, name } of STAGE_CATALOG) {
    assertEquals(mirrorProblems(name, stageScenery(id).pieces).join("\n"), "");
  }
});

test("stage scenery shows no creatures [k3 measure docs/design/stage-art.md]", () => {
  for (const { id, name } of STAGE_CATALOG) {
    for (const { model } of stageScenery(id).pieces) {
      const creature = model.toLowerCase().startsWith("units\\") || FIGURE_WORDS.some((word) => model.toLowerCase().includes(word));
      assertEquals(creature, false, `${name}: ${model} is a creature`);
    }
  }
});

test("every stock-built platform draws only its walking piece, with no rock or rubble hung beneath it [k2 property]", () => {
  for (const { id, name } of STAGE_CATALOG) {
    for (let index = 0; index < surfaceCount(id); index++) assertEquals(platformParts(id, index).length <= 1, true, `${name}: platform ${index} hangs ${platformParts(id, index).length - 1} parts beneath its walking piece`);
  }
});

test("the space below every stage's platforms is ground, lava or plague slime, never the stretched zigzag sea plane; only Tomb of Sargeras draws water and only Naxxramas draws plague slime [k2 property]", () => {
  for (const { id, name } of STAGE_CATALOG) {
    const floor = stageScenery(id).floor;
    if (floor !== undefined) assertEquals(floor.model === STAGE_GROUND_MODEL || floor.model === STAGE_LAVA_MODEL || floor.model === STAGE_PLAGUE_MODEL, true, `${name}: floor ${floor.model}`);
    const drawn = [...terrainPieces(id), ...stageScenery(id).pieces];
    const water = drawn.some(({ model }) => model === STAGE_TOMB_SEA_MODEL || model === STAGE_TOMB_WATER_MODEL);
    assertEquals(water, id === TOMB_OF_SARGERAS_STAGE, `${name}: water beneath the deck is ${water}`);
    const slime = drawn.some(({ model }) => model === STAGE_PLAGUE_MODEL);
    assertEquals(slime, id === PATTERNED_DECKS_STAGE, `${name}: plague slime beneath the deck is ${slime}`);
    for (const piece of terrainPieces(id)) assertEquals(piece.model === STAGE_SEA_MODEL, false, `${name}: draws the zigzag sea plane`);
  }
});

test("every stage stands terrain in its near, mid and far bands, and its near band rises out of the floor on both sides of the deck [k2 property]", () => {
  for (const { id, name } of STAGE_CATALOG) assertEquals(depthProblems(name, stageScenery(id).pieces, hiddenBelow(id)).join("\n"), "");
});

test("every drifting piece crosses behind the fight from beyond one side of the scenery to beyond the other, and loops [k2 property]", () => {
  for (const { id, name } of STAGE_CATALOG) {
    const { pieces, drifters } = stageScenery(id);
    const edge = pieces.reduce((widest, piece) => max(widest, Math.abs(piece.x)), 0.0);
    for (const drifter of drifters ?? []) {
      const label = `${name}: ${drifter.model}`;
      assertEquals(drifter.y > 0.0 && drifter.fromX * drifter.toX < 0.0, true, `${label} does not cross behind the fight`);
      assertEquals(min(Math.abs(drifter.fromX), Math.abs(drifter.toX)) > edge, true, `${label} turns inside the scenery band`);
      for (let step = 0; step < 64; step++) {
        const seconds = (step * drifter.seconds) / 16;
        const x = driftPose(drifter, seconds).x;
        const next = driftPose(drifter, seconds + drifter.seconds).x;
        assertEquals(Math.abs(next - x) < 1.0, true, `${label} at ${seconds} s: ${x} then ${next} a loop later`);
        assertEquals(x >= min(drifter.fromX, drifter.toX) && x <= max(drifter.fromX, drifter.toX), true, `${label} at ${seconds} s leaves its path at ${x}`);
      }
    }
  }
});

test("mossy rock stands only on the green stages, Nordrassil and Tomb of Sargeras [k2 property]", () => {
  for (const { id, name } of STAGE_CATALOG) {
    assertEquals(paletteProblems(name, stageScenery(id).pieces, id === WIND_TEST_STAGE || id === TOMB_OF_SARGERAS_STAGE).join("\n"), "");
  }
});

test("no two stages raise their skyline from the same rock [k2 property]", () => {
  assertEquals(skylineProblems(STAGE_CATALOG.map(({ id, name }) => ({ name, pieces: stageScenery(id).pieces }))).join("\n"), "");
});
