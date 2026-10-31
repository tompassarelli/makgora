

import { f32 } from "wisp/src/sim/f32";
import { STAGE_TOMB_WATER_MODEL, STAGE_TOMB_SEA_MODEL, STAGE_LAVA_MODEL, STAGE_GROUND_MODEL } from "../../generated/stages/terrainAssetInfo";
import { LAVA_CENTER_X, LAVA_HALF_WIDTH } from "../sim/lava";
import { SEA_SURFACE_Z } from "../sim/stageHazards";
import { STAGE_POINT_LIGHT_MODELS, STAGE_SNOW_MODEL } from "../../generated/stages/stageAssetInfo";
import { STAGE_LIGHTS, type StageLight } from "../assets/stageLighting";
import { max, min } from "../core/numbers";
import { toInt } from "wisp/src/sim/binary32";
import { STAGE_POINT_LIGHTS } from "../assets/stagePointLights";
import { STAGE_SKY_MODELS } from "../../generated/stages/stageSkyInfo";
import { AHNQIRAJ_SCENERY, BLACKROCK_SCENERY, GRYPHON_SCENERY, NORDRASSIL_SCENERY } from "./hazardStageScenery";
import { STRATHOLME_SCENERY, TOMB_OF_SARGERAS_SCENERY } from "./homeStageScenery";
import { DUROTAR_SCENERY, HELLFIRE_SCENERY, NAXXRAMAS_SCENERY } from "./patrolStageScenery";
import type { DriftingPiece } from "./driftingScenery";
import { CANNON_TEST_STAGE, CARRIED_TEST_STAGE, DRIFTING_DECK_STAGE, FROZEN_THRONE_STAGE, HELLFIRE_STAGE, PATTERNED_DECKS_STAGE, STRATHOLME_STAGE, TIMED_TEST_STAGE, TOMB_OF_SARGERAS_STAGE, WIND_TEST_STAGE } from "../sim/stage";

export interface SceneryPiece {
  readonly model: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly scale: number;

  readonly yaw: number;
  readonly matrixScale?: readonly [number, number, number];
  readonly color?: readonly [number, number, number];
  readonly flying?: true;
  /** The model plays its floating idle; a still piece holds its first frame so a stacked spire does not bob. */
  readonly still?: true;
}

/** The native window's painted sky for a stage, which keeps one time of day: the zenith colour, the cloud cover, the sun's (or moon's) place and colour, and how far stars and a horizon glow show. Colours are 0 to 1; the horizon is the fog's colour. */
export interface StageSkyLook {
  readonly zenith: readonly [number, number, number];
  readonly cover: number;
  readonly sunAzimuth: number;
  readonly sunElevation: number;
  readonly sun: readonly [number, number, number];
  readonly stars: number;
  readonly glow: number;
}

export interface StageScenery {
  readonly farZ: number;
  readonly sky: string;
  readonly skyLook?: StageSkyLook;
  readonly pieces: readonly SceneryPiece[];
  readonly drifters?: readonly DriftingPiece[];
  /** The pieces' colour under the stock light, before the stage's mood (sceneryColor). */
  readonly tint?: readonly [number, number, number];
  readonly fog?: { readonly start: number; readonly end: number; readonly red: number; readonly green: number; readonly blue: number };
  /** #360: an opaque full-width surface far below the bottom blast zone; it hides the bases of the pieces that stand in it. */
  readonly floor?: { readonly model: string; readonly z: number; readonly color: readonly [number, number, number] };
  readonly heightFog?: {
    readonly start: number;
    readonly end: number;
    readonly density: number;

    readonly heightStart: number;
    readonly heightEnd: number;
    readonly maxDensity: number;
    readonly drawOverSky: boolean;
  };
}


const SUMMER: StageScenery = {
  farZ: 13000.0,
  sky: STAGE_SKY_MODELS[0] ?? "",
  fog: { start: 6000.0, end: 12000.0, red: 0.6875, green: 0.8125, blue: 0.9375 },
  floor: { model: STAGE_TOMB_SEA_MODEL, z: -1600.0, color: [120, 136, 156] },
  pieces: [],
};

const FROZEN_THRONE: StageScenery = {
  farZ: 13000.0,
  sky: STAGE_SKY_MODELS[2] ?? "",

  fog: { start: 5000.0, end: 11000.0, red: 0.15625, green: 0.28125, blue: 0.453125 },
  floor: { model: STAGE_GROUND_MODEL, z: -1300.0, color: [42, 60, 90] },
  pieces: [
    { model: "Doodads\\Northrend\\Water\\North_IceFloe3\\North_IceFloe3.mdx", x: 0.0, y: 2100.0, z: -557.0, scale: 1.0, yaw: 270.0, matrixScale: [7.0, 3.5, 2.5], color: [40, 54, 78], still: true },
    { model: "Doodads\\Northrend\\Water\\North_IceFloe3\\North_IceFloe3.mdx", x: 0.0, y: 2100.0, z: -481.0, scale: 1.0, yaw: 270.0, matrixScale: [6.25, 3.125, 2.5], color: [44, 58, 82], still: true },
    { model: "Doodads\\Northrend\\Water\\North_IceFloe3\\North_IceFloe3.mdx", x: 0.0, y: 2100.0, z: -405.0, scale: 1.0, yaw: 270.0, matrixScale: [5.5, 2.75, 2.5], color: [48, 63, 88], still: true },
    { model: "Doodads\\Northrend\\Water\\North_IceFloe3\\North_IceFloe3.mdx", x: 0.0, y: 2100.0, z: -329.0, scale: 1.0, yaw: 270.0, matrixScale: [4.75, 2.375, 2.5], color: [52, 68, 94], still: true },
    { model: "Doodads\\Northrend\\Water\\North_IceFloe3\\North_IceFloe3.mdx", x: 0.0, y: 2100.0, z: -253.0, scale: 1.0, yaw: 270.0, matrixScale: [4.0, 2.0, 2.5], color: [56, 73, 100], still: true },
    { model: "Doodads\\Northrend\\Water\\North_IceFloe3\\North_IceFloe3.mdx", x: 0.0, y: 2100.0, z: -177.0, scale: 1.0, yaw: 270.0, matrixScale: [3.25, 1.625, 2.5], color: [60, 78, 106], still: true },
    { model: "Doodads\\Northrend\\Water\\North_IceFloe3\\North_IceFloe3.mdx", x: 0.0, y: 2150.0, z: 46.0, scale: 1.0, yaw: 270.0, matrixScale: [0.4375, 1.625, 6.75], color: [88, 108, 128], still: true },
    { model: "Doodads\\Icecrown\\Props\\IceCrownPillar\\IceCrownPillar0.mdx", x: -160.0, y: 2150.0, z: 251.0, scale: 0.875, yaw: 270.0, color: [88, 108, 128] },
    { model: "Doodads\\Icecrown\\Props\\IceCrownPillar\\IceCrownPillar0.mdx", x: 160.0, y: 2150.0, z: 251.0, scale: 0.875, yaw: 270.0, color: [88, 108, 128] },
    { model: "Doodads\\Icecrown\\Props\\IceCrownObelisk\\IceCrownObelisk0.mdx", x: 0.0, y: 2150.0, z: 251.0, scale: 1.375, yaw: 270.0, color: [88, 108, 128] },
    { model: "Doodads\\Northrend\\Water\\North_IceFloe3\\North_IceFloe3.mdx", x: 0.0, y: 2020.0, z: -60.0, scale: 1.0, yaw: 270.0, matrixScale: [0.875, 1.0, 1.875], color: [88, 108, 128], still: true },
    { model: "Doodads\\Northrend\\Water\\North_IceFloe3\\North_IceFloe3.mdx", x: -140.0, y: 2020.0, z: -19.0, scale: 1.0, yaw: 270.0, matrixScale: [0.875, 0.375, 3.75], color: [88, 108, 128], still: true },
    { model: "Doodads\\Northrend\\Water\\North_IceFloe3\\North_IceFloe3.mdx", x: 140.0, y: 2020.0, z: -19.0, scale: 1.0, yaw: 270.0, matrixScale: [0.875, 0.375, 3.75], color: [88, 108, 128], still: true },
    { model: "Doodads\\Northrend\\Water\\North_IceFloe3\\North_IceFloe3.mdx", x: 0.0, y: 1520.0, z: -220.0, scale: 1.0, yaw: 270.0, matrixScale: [13.0, 2.5, 1.25], color: [64, 82, 104], still: true },
    { model: "Doodads\\Northrend\\Water\\North_IceFloe3\\North_IceFloe3.mdx", x: 0.0, y: 1480.0, z: -165.0, scale: 1.0, yaw: 270.0, matrixScale: [11.0, 2.5, 1.25], color: [64, 82, 104], still: true },
    { model: "Doodads\\Northrend\\Water\\North_IceFloe3\\North_IceFloe3.mdx", x: 0.0, y: 1440.0, z: -110.0, scale: 1.0, yaw: 270.0, matrixScale: [9.0, 2.5, 1.25], color: [64, 82, 104], still: true },
    { model: "Doodads\\Northrend\\Water\\North_IceFloe3\\North_IceFloe3.mdx", x: 0.0, y: 1400.0, z: -55.0, scale: 1.0, yaw: 270.0, matrixScale: [7.0, 2.5, 1.25], color: [64, 82, 104], still: true },
    { model: "Doodads\\Northrend\\Water\\North_IceFloe3\\North_IceFloe3.mdx", x: 0.0, y: 1360.0, z: 0.0, scale: 1.0, yaw: 270.0, matrixScale: [5.0, 2.5, 1.25], color: [64, 82, 104], still: true },
    { model: "Doodads\\Northrend\\Water\\North_IceFloe3\\North_IceFloe3.mdx", x: 0.0, y: 1973.0, z: 0.0, scale: 1.0, yaw: 270.0, matrixScale: [1.25, 2.5, 1.25], color: [64, 82, 104], still: true },
    { model: "Doodads\\Icecrown\\Structures\\IC_IceArch\\IC_IceArch.mdx", x: 0.0, y: 4800.0, z: -1500.0, scale: 7.5, yaw: 270.0, color: [46, 60, 82] },
    { model: "Doodads\\Icecrown\\Rocks\\Glacier\\Glacier2.mdx", x: -2300.0, y: 5200.0, z: -2200.0, scale: 5.0, yaw: 60.0, matrixScale: [1.25, 1.0, 2.25], color: [44, 64, 90] },
    { model: "Doodads\\Icecrown\\Rocks\\Glacier\\Glacier5.mdx", x: 2300.0, y: 5000.0, z: -2200.0, scale: 5.0, yaw: 20.0, matrixScale: [1.25, 1.0, 2.5], color: [44, 64, 90] },
    { model: "Doodads\\Icecrown\\Rocks\\Glacier\\Glacier5.mdx", x: -3100.0, y: 3800.0, z: -1900.0, scale: 4.0, yaw: 140.0, matrixScale: [1.25, 1.0, 1.75], color: [42, 62, 88] },
    { model: "Doodads\\Icecrown\\Rocks\\Glacier\\Glacier2.mdx", x: 3200.0, y: 3900.0, z: -1900.0, scale: 4.0, yaw: 80.0, matrixScale: [1.25, 1.0, 2.0], color: [42, 62, 88] },
    { model: "Doodads\\Icecrown\\Props\\IceCrownObelisk\\IceCrownObelisk0.mdx", x: -3100.0, y: 3400.0, z: -1000.0, scale: 4.5, yaw: 80.0, color: [45, 58, 80] },
    { model: "Doodads\\Icecrown\\Props\\IceCrownObelisk\\IceCrownObelisk0.mdx", x: 3100.0, y: 3400.0, z: -1000.0, scale: 5.0, yaw: 250.0, color: [45, 58, 80] },
    { model: "Doodads\\Icecrown\\Props\\IceCrownPillar\\IceCrownPillar0.mdx", x: -2800.0, y: 3000.0, z: -800.0, scale: 4.0, yaw: 15.0, color: [45, 58, 80] },
    { model: "Doodads\\Icecrown\\Props\\IceCrownPillar\\IceCrownPillar0.mdx", x: 2800.0, y: 3000.0, z: -800.0, scale: 4.0, yaw: 140.0, color: [45, 58, 80] },
    { model: "Doodads\\Icecrown\\Props\\IceCrownPillar\\IceCrownPillar0.mdx", x: -340.0, y: 60.0, z: 0.0, scale: 0.625, yaw: 270.0, color: [44, 56, 76] },
    { model: "Doodads\\Icecrown\\Props\\IceCrownPillar\\IceCrownPillar0.mdx", x: 340.0, y: 60.0, z: 0.0, scale: 0.625, yaw: 270.0, color: [44, 56, 76] },
    { model: "Doodads\\Icecrown\\Props\\IceCrownPillar\\IceCrownPillar0.mdx", x: 0.0, y: 60.0, z: 0.0, scale: 1.25, yaw: 270.0, matrixScale: [0.5, 0.5, 1.0], color: [44, 56, 76] },
    { model: STAGE_SNOW_MODEL, x: 0.0, y: 4000.0, z: 0.0, scale: 1.0, yaw: 0.0 },
  ],
};

/** Every stage draws with the stock Lordaeron light, so fighters are lit as at stock (#375). */
export const STOCK_TERRAIN_LIGHT = "Environment\\DNC\\DNCLordaeron\\DNCLordaeronTerrain\\DNCLordaeronTerrain.mdl";
export const STOCK_UNIT_LIGHT = "Environment\\DNC\\DNCLordaeron\\DNCLordaeronUnit\\DNCLordaeronUnit.mdl";

/**
 * A scenery colour under the stage's mood: the stage light (stageLighting.ts)
 * divided by the stock noon light, its first entry, averaging key and fill.
 * Only scenery takes it; the fighters keep the stock light.
 */
export function sceneryColor(stage: number, color: readonly [number, number, number]): readonly [number, number, number] {
  return moodColor(STAGE_LIGHTS.find(entry => entry.stage === stage)?.light, color);
}

export function moodColor(light: StageLight | undefined, color: readonly [number, number, number]): readonly [number, number, number] {
  const stock = STAGE_LIGHTS[0]?.light;
  if (stock === undefined || light === undefined) return color;
  const intensity = light.intensity ?? 1.0;
  const channel = (index: 0 | 1 | 2) => min(255, toInt(f32(f32(f32(color[index] * f32(intensity * (light.key[index] + light.ambient[index]))) / (stock.key[index] + stock.ambient[index])) + 0.5)));
  return [channel(0), channel(1), channel(2)];
}

export function stageScenery(stage: number): StageScenery {
  if (stage === FROZEN_THRONE_STAGE) return FROZEN_THRONE;
  if (stage === WIND_TEST_STAGE) return NORDRASSIL_SCENERY;
  if (stage === CARRIED_TEST_STAGE) return GRYPHON_SCENERY;
  if (stage === DRIFTING_DECK_STAGE) return DUROTAR_SCENERY;
  if (stage === PATTERNED_DECKS_STAGE) return NAXXRAMAS_SCENERY;
  if (stage === HELLFIRE_STAGE) return HELLFIRE_SCENERY;
  if (stage === CANNON_TEST_STAGE) return BLACKROCK_SCENERY;
  if (stage === TIMED_TEST_STAGE) return AHNQIRAJ_SCENERY;
  if (stage === STRATHOLME_STAGE) return STRATHOLME_SCENERY;
  if (stage === TOMB_OF_SARGERAS_STAGE) return TOMB_OF_SARGERAS_SCENERY;
  return SUMMER;
}


export function terrainPieces(stage: number): readonly SceneryPiece[] {
  if (stage === TOMB_OF_SARGERAS_STAGE) return [
    { model: STAGE_TOMB_WATER_MODEL, x: 0.0, y: 0.0, z: 1.0, scale: 1.0, matrixScale: [12.0, 1.0, 1.0], yaw: 0.0 },
    // The sea extends beneath the camera so it reads as a surface, rather than a narrow tile.
    { model: STAGE_TOMB_SEA_MODEL, x: 0.0, y: 2200.0, z: SEA_SURFACE_Z, scale: 1.0,
      matrixScale: [240.0, 140.0, 1.0], color: [176, 160, 144], yaw: 0.0 },
  ];
  const floor = stageScenery(stage).floor;
  if (floor !== undefined) return [
    { model: floor.model, x: 0.0, y: 2200.0, z: floor.z, scale: 1.0, matrixScale: [240.0, 140.0, 1.0], color: floor.color, yaw: 0.0 },
  ];
  return [];
}

export function hiddenBelow(stage: number): number | undefined {
  return stage === TOMB_OF_SARGERAS_STAGE ? SEA_SURFACE_Z : stageScenery(stage).floor?.z;
}

const LAVA_RIM_MARGIN = 16.0;

export function lavaRimPiece(side: -1 | 1): SceneryPiece {
  return { model: STAGE_GROUND_MODEL, x: side * LAVA_CENTER_X, y: 0.0, z: 0.5, scale: 1.0, matrixScale: [(2 * (LAVA_HALF_WIDTH + LAVA_RIM_MARGIN)) / 100, 1.25, 1.0], yaw: 0.0 };
}

export function lavaPiece(side: -1 | 1): SceneryPiece {
  return { model: STAGE_LAVA_MODEL, x: side * LAVA_CENTER_X, y: 0.0, z: 1.0, scale: 1.0, matrixScale: [(2 * LAVA_HALF_WIDTH) / 100, 1.0, 1.0], yaw: 0.0 };
}


export function pointLightPieces(stage: number): readonly SceneryPiece[] {
  const models = STAGE_POINT_LIGHT_MODELS[stage] ?? [];
  const lights = STAGE_POINT_LIGHTS.find(entry => entry.stage === stage)?.lights ?? [];
  return lights.map((light, index) => ({ model: models[index] ?? "", x: light.x, y: light.y, z: light.z, scale: 1.0, yaw: 0.0 }));
}


export function shadowCastingLights(stage: number): number {
  return (STAGE_POINT_LIGHTS.find(entry => entry.stage === stage)?.lights ?? []).filter(light => light.castsShadow).length;
}

/** Every effect a stage's scene places, in the order the shell creates them. */
export function placedPieces(stage: number, mood = true): readonly SceneryPiece[] {
  const scenery = stageScenery(stage);
  const pieces = scenery.pieces.map(piece => {
    const color = piece.color ?? scenery.tint ?? [255, 255, 255] as const;
    return { ...piece, color: mood ? sceneryColor(stage, color) : color };
  });
  return [...pieces, ...terrainPieces(stage), ...pointLightPieces(stage)];
}

export function driftingPieces(stage: number): readonly DriftingPiece[] {
  const scenery = stageScenery(stage);
  return (scenery.drifters ?? []).map(piece => ({ ...piece, color: sceneryColor(stage, scenery.tint ?? [255, 255, 255]) }));
}

export interface DrawnScale {
  readonly scale: number;
  readonly matrixScale: readonly [number, number, number] | undefined;
}

/** Warcraft culls an effect by its model's extents times its scale and ignores the matrix scale, so a stretch past 1 moves into the scale. */
export function drawnScale(piece: Readonly<Pick<SceneryPiece, "scale" | "matrixScale">>): DrawnScale {
  const matrix = piece.matrixScale;
  if (matrix === undefined) return { scale: piece.scale, matrixScale: undefined };
  const widest = max(max(Math.abs(matrix[0]), Math.abs(matrix[1])), max(Math.abs(matrix[2]), 1.0));
  return { scale: f32(piece.scale * widest), matrixScale: [f32(matrix[0] / widest), f32(matrix[1] / widest), f32(matrix[2] / widest)] };
}
