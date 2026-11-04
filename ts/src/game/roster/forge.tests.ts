import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { at } from "wisp/src/runtime/lookup";
import { Character } from "../sim/codes";
import { PLAYABLE_CHARACTERS, SELECTABLE_CHARACTERS, fighterSlug } from "./kits";
import { FORGE_FIGHTERS, FORGE_STAGES, fighterStatus, isFeatured, setForgeRoster, shownFighters } from "./forge";
import { CLASSIC_ROUTES } from "../classic/routes";
import { CLASSIC_FIGHTS, classicRivals } from "../classic/classic";
import { drawCpuFighter } from "../match/cpuProfiles";
import { Phase, createMatchState, nextCpuCharacter, nextMatchCharacter } from "../lobby/lobbyState";
import { STAGE_CATALOG, nextStage } from "../menu/stageCatalog";
import { createStagePool, nextPoolStage, stagePoolCount, togglePoolMode, togglePoolStage } from "../menu/stagePool";
import { isFeaturedStage, stageShown, stageStatus } from "./forge";
import { GRID_FIGHTERS, characterOfTile, tileMarked, tileShown } from "../ui/selectionFrames";

const FORGE_FIGHTER = Character.thrall;
const FORGE_STAGE = 2;

function visibleGrid(forgeShown: boolean): number[] {
  const game = createMatchState();
  const shown: number[] = [];
  for (let tile = 0; tile < GRID_FIGHTERS.length; tile++) if (tileShown(game, tile, forgeShown)) shown.push(characterOfTile(tile));
  return shown;
}

function cycled(forgeShown: boolean): number[] {
  const game = createMatchState();
  const seen: number[] = [];
  let current: number = nextMatchCharacter(game, undefined, 1, forgeShown);
  for (let step = 0; step < PLAYABLE_CHARACTERS.length; step++) {
    if (!seen.includes(current)) seen.push(current);
    current = nextMatchCharacter(game, current, 1, forgeShown);
  }
  return seen;
}

function randomDraws(): number[] {
  const featured = shownFighters(PLAYABLE_CHARACTERS);
  const drawn: number[] = [];
  for (let seed = 0; seed < 400; seed++) drawn.push(drawCpuFighter(featured, seed, 1));
  return drawn;
}

function classicRivalSet(): number[] {
  const rivals: number[] = [];
  for (const route of CLASSIC_ROUTES) for (let fight = 0; fight < CLASSIC_FIGHTS - 1; fight++) for (const rival of classicRivals(route, fight)) rivals.push(rival);
  return rivals;
}

function poolDraws(): number[] {
  const pool = createStagePool();
  const drawn: number[] = [];
  for (let seed = 0; seed < 200; seed++) drawn.push(nextPoolStage(pool, seed * 7919));
  return drawn;
}

function withForge(fighters: readonly string[], stages: readonly number[], body: () => void): void {
  setForgeRoster(fighters, stages);
  try {
    body();
  } finally {
    setForgeRoster(FORGE_FIGHTERS, FORGE_STAGES);
  }
}

test("the shipped Forge names 18 roster fighters, features the other 16 and every stage, and each featured Classic route fills its ladder from featured rivals [k2 property]", () => {
  for (const slug of FORGE_FIGHTERS) assertTrue(SELECTABLE_CHARACTERS.some(character => fighterSlug(character) === slug));
  assertEquals(SELECTABLE_CHARACTERS.filter(character => !isFeatured(character)).length, FORGE_FIGHTERS.length);
  assertEquals(SELECTABLE_CHARACTERS.filter(character => isFeatured(character)).length, SELECTABLE_CHARACTERS.length - FORGE_FIGHTERS.length);
  assertEquals(STAGE_CATALOG.filter(stage => isFeaturedStage(stage.id)).length, STAGE_CATALOG.length - FORGE_STAGES.length);
  for (const route of CLASSIC_ROUTES) for (let fight = 0; fight < CLASSIC_FIGHTS - 1; fight++) {
    const rivals = classicRivals(route, fight);
    assertTrue(rivals.length > 0 && rivals.every(character => isFeatured(character)) && !rivals.includes(route.fighter));
  }
  assertFalse(randomDraws().some(character => !isFeatured(character)));
});

test("with every fighter and stage featured, select, cycling, CPU Random, Classic and the stage pool offer the whole roster [k2 property]", () => {
  withForge([], [], () => {
    assertEquals(visibleGrid(false).length, GRID_FIGHTERS.length);
    assertEquals(cycled(false).length, PLAYABLE_CHARACTERS.length);
    assertEquals(shownFighters(PLAYABLE_CHARACTERS).length, PLAYABLE_CHARACTERS.length);
    const planned: number[] = [];
    for (const route of CLASSIC_ROUTES) for (const plan of route.fights) for (const rival of plan.rivals) planned.push(rival);
    assertEquals(classicRivalSet().join(","), planned.join(","));
    assertEquals(stagePoolCount(createStagePool()), STAGE_CATALOG.length);
    for (let tile = 0; tile < GRID_FIGHTERS.length; tile++) assertFalse(tileMarked(createMatchState(), tile, true));
  });
});

test("a Forge fighter and stage stay off select, cycling, CPU Random, Classic and the stage pool with the option off, and show marked with it on [k2 property]", () => {
  withForge([fighterSlug(FORGE_FIGHTER)], [FORGE_STAGE], () => {
    assertEquals(fighterStatus(FORGE_FIGHTER), "forge");
    assertFalse(visibleGrid(false).includes(FORGE_FIGHTER));
    assertEquals(visibleGrid(false).length, GRID_FIGHTERS.length - 1);
    assertFalse(cycled(false).includes(FORGE_FIGHTER));
    assertFalse(randomDraws().includes(FORGE_FIGHTER));
    assertFalse(classicRivalSet().includes(FORGE_FIGHTER));
    const game = createMatchState();
    game.phase = Phase.characterMenu;
    for (let step = 0, current = nextCpuCharacter(game, 1, 1); step < PLAYABLE_CHARACTERS.length; step++, current = nextCpuCharacter(game, 1, 1)) assertTrue(current !== FORGE_FIGHTER);
    assertFalse(poolDraws().includes(FORGE_STAGE));
    const pool = createStagePool();
    togglePoolMode(pool);
    assertFalse(togglePoolStage(pool, FORGE_STAGE));
    let stage: number = nextStage(0, 1, isFeaturedStage);
    for (let step = 0; step < STAGE_CATALOG.length + 1; step++, stage = nextStage(stage, 1, isFeaturedStage)) assertTrue(stage !== FORGE_STAGE);
    assertTrue(visibleGrid(true).includes(FORGE_FIGHTER));
    assertEquals(visibleGrid(true).length, GRID_FIGHTERS.length);
    assertTrue(cycled(true).includes(FORGE_FIGHTER));
    const marked: number[] = [];
    for (let tile = 0; tile < GRID_FIGHTERS.length; tile++) if (tileMarked(game, tile, true)) marked.push(characterOfTile(tile));
    assertEquals(marked.length, 1);
    assertEquals(at(marked, 0), FORGE_FIGHTER);
    assertFalse(stageShown(FORGE_STAGE, false));
    assertTrue(stageShown(FORGE_STAGE, true) && stageStatus(FORGE_STAGE) === "forge");
  });
});
