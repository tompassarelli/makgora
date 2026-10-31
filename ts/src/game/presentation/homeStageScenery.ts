import { f32 } from "wisp/src/sim/f32";

import { STAGE_GROUND_MODEL } from "../../generated/stages/terrainAssetInfo";
import { STAGE_SKY_MODELS } from "../../generated/stages/stageSkyInfo";
import type { StageScenery } from "./stageScenery";

const HILL = "Doodads\\Underground\\Rocks\\UndergoundRock\\UndergoundRock3.mdx";
const TOWN_FIRE = "Doodads\\Cinematic\\TownBurningFireEmitter\\TownBurningFireEmitter.mdx";
const ISLE_PEAK = "Doodads\\Ruins\\Rocks\\Ruins_Spires\\Ruins_Spires0.mdx";


export const STRATHOLME_SCENERY: StageScenery = {
  farZ: 13000.0,
  sky: STAGE_SKY_MODELS[6] ?? "",
  skyLook: { zenith: [0.11, 0.094, 0.125], cover: 0.6, sunAzimuth: 90, sunElevation: 4, sun: [0.6, 0.15, 0.08], stars: 0.5, glow: 0.6 },
  fog: { start: 3300.0, end: 7000.0, red: 0.25, green: 0.265625, blue: 0.3125 },
  floor: { model: STAGE_GROUND_MODEL, z: -1300.0, color: [36, 24, 20] },
  pieces: [
    { model: "Doodads\\Cityscape\\Structures\\CityBuildingLarge_45_Ruined\\CityBuildingLarge_45_Ruined.mdx", x: -3900.0, y: 4000.0, z: -1300.0, scale: 2.8125, yaw: 15.0, matrixScale: [1.0, 1.0, 1.25], color: [52, 56, 68] },
    { model: "Doodads\\Cityscape\\Structures\\CityBuildingSmall45_0_Ruined\\CityBuildingSmall45_0_Ruined.mdx", x: -3040.0, y: 4220.0, z: -1300.0, scale: 3.1875, yaw: 76.0, matrixScale: [1.0, 1.0, 1.25], color: [52, 56, 68] },
    { model: "Doodads\\Cityscape\\Structures\\CityBuildingLarge_0_Ruined\\CityBuildingLarge_0_Ruined.mdx", x: -2180.0, y: 4440.0, z: -1300.0, scale: 3.0, yaw: 137.0, matrixScale: [1.0, 1.0, 1.25], color: [52, 56, 68] },
    { model: "Doodads\\Cityscape\\Structures\\CityBuildingSmall90_2_Ruined\\CityBuildingSmall90_2_Ruined.mdx", x: -1320.0, y: 4000.0, z: -1300.0, scale: 2.8125, yaw: 198.0, matrixScale: [1.0, 1.0, 1.25], color: [52, 56, 68] },
    { model: "Doodads\\Cityscape\\Structures\\CityBuildingLarge_45_Ruined\\CityBuildingLarge_45_Ruined.mdx", x: -460.0, y: 4220.0, z: -1300.0, scale: 3.1875, yaw: 259.0, matrixScale: [1.0, 1.0, 1.25], color: [52, 56, 68] },
    { model: "Doodads\\Cityscape\\Structures\\CityBuildingSmall45_0_Ruined\\CityBuildingSmall45_0_Ruined.mdx", x: 400.0, y: 4440.0, z: -1300.0, scale: 3.0, yaw: 320.0, matrixScale: [1.0, 1.0, 1.25], color: [52, 56, 68] },
    { model: "Doodads\\Cityscape\\Structures\\CityBuildingLarge_0_Ruined\\CityBuildingLarge_0_Ruined.mdx", x: 1260.0, y: 4000.0, z: -1300.0, scale: 2.8125, yaw: 21.0, matrixScale: [1.0, 1.0, 1.25], color: [52, 56, 68] },
    { model: "Doodads\\Cityscape\\Structures\\CityBuildingSmall90_2_Ruined\\CityBuildingSmall90_2_Ruined.mdx", x: 2120.0, y: 4220.0, z: -1300.0, scale: 3.1875, yaw: 82.0, matrixScale: [1.0, 1.0, 1.25], color: [52, 56, 68] },
    { model: "Doodads\\Cityscape\\Structures\\CityBuildingLarge_45_Ruined\\CityBuildingLarge_45_Ruined.mdx", x: 2980.0, y: 4440.0, z: -1300.0, scale: 3.0, yaw: 143.0, matrixScale: [1.0, 1.0, 1.25], color: [52, 56, 68] },
    { model: "Doodads\\Cityscape\\Structures\\CityBuildingSmall45_0_Ruined\\CityBuildingSmall45_0_Ruined.mdx", x: 3880.0, y: 4000.0, z: -1300.0, scale: 2.8125, yaw: 204.0, matrixScale: [1.0, 1.0, 1.25], color: [52, 56, 68] },
    { model: "Doodads\\Cityscape\\Structures\\CathedralRuined\\CathedralRuined.mdx", x: 1500.0, y: 4900.0, z: -1300.0, scale: 4.0, yaw: 250.0, color: [84, 88, 104] },
    { model: "Doodads\\Cityscape\\Structures\\CityWallEntrance\\CityWallEntrance.mdx", x: -1900.0, y: 3500.0, z: -1350.0, scale: 2.5, yaw: 285.0, color: [52, 56, 68] },
    { model: "Doodads\\Cityscape\\Structures\\CityBuildingSmall135_1_Ruined\\CityBuildingSmall135_1_Ruined.mdx", x: 2450.0, y: 3300.0, z: -1300.0, scale: 2.0625, yaw: 160.0, color: [52, 56, 68] },
    { model: "Doodads\\Cityscape\\Structures\\CityBuildingLarge_0_Ruined\\CityBuildingLarge_0_Ruined.mdx", x: -1600.0, y: 7600.0, z: -1800.0, scale: 3.0, yaw: 270.0 },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks2.mdx", x: -1600.0, y: 7600.0, z: -4000.0, scale: 10.0, yaw: 110.0, matrixScale: [1.0, 1.0, f32(2.797)] },
    { model: "Doodads\\Ruins\\Rocks\\CliffRubble_Single\\CliffRubble_Single0.mdx", x: -3600.0, y: 1450.0, z: -1400.0, scale: 3.25, yaw: 20.0, matrixScale: [2.5, 1.0, 1.25], color: [150, 116, 100] },
    { model: "Doodads\\Dungeon\\Rocks\\DungeonRock\\DungeonRock4.mdx", x: -2500.0, y: 1650.0, z: -1400.0, scale: 4.75, yaw: 160.0, matrixScale: [1.75, 1.0, 1.25], color: [150, 116, 100] },
    { model: "Doodads\\Ruins\\Rocks\\CliffRubble_Single\\CliffRubble_Single0.mdx", x: -1400.0, y: 1500.0, z: -1400.0, scale: 2.75, yaw: 250.0, matrixScale: [3.0, 1.0, 1.25], color: [150, 116, 100] },
    { model: "Doodads\\Dungeon\\Rocks\\DungeonRock\\DungeonRock4.mdx", x: -300.0, y: 1700.0, z: -1400.0, scale: 4.0, yaw: 80.0, matrixScale: [2.25, 1.0, 1.25], color: [150, 116, 100] },
    { model: "Doodads\\Ruins\\Rocks\\CliffRubble_Single\\CliffRubble_Single0.mdx", x: 800.0, y: 1550.0, z: -1400.0, scale: 2.5, yaw: 310.0, matrixScale: [3.25, 1.0, 1.25], color: [150, 116, 100] },
    { model: "Doodads\\Dungeon\\Rocks\\DungeonRock\\DungeonRock4.mdx", x: 1900.0, y: 1600.0, z: -1400.0, scale: 4.5, yaw: 200.0, matrixScale: [2.0, 1.0, 1.25], color: [150, 116, 100] },
    { model: "Doodads\\Ruins\\Rocks\\CliffRubble_Single\\CliffRubble_Single0.mdx", x: 3000.0, y: 1450.0, z: -1400.0, scale: 3.25, yaw: 120.0, matrixScale: [2.5, 1.0, 1.25], color: [150, 116, 100] },
    { model: "Doodads\\Dungeon\\Rocks\\DungeonRock\\DungeonRock4.mdx", x: 4000.0, y: 1650.0, z: -1400.0, scale: 5.5, yaw: 340.0, matrixScale: [1.5, 1.0, 1.25], color: [150, 116, 100] },
    { model: "Doodads\\Ruins\\Rocks\\CliffRubble_Single\\CliffRubble_Single0.mdx", x: -4000.0, y: 2600.0, z: -1400.0, scale: 4.0, yaw: 190.0, matrixScale: [2.25, 1.0, 1.25], color: [180, 146, 128] },
    { model: "Doodads\\Cityscape\\Structures\\CityBuildingLarge_0_BaseRuin\\CityBuildingLarge_0_BaseRuin.mdx", x: -2800.0, y: 2900.0, z: -1400.0, scale: 2.75, yaw: 40.0, matrixScale: [1.25, 1.0, 1.25], color: [180, 146, 128] },
    { model: "Doodads\\Ruins\\Rocks\\CliffRubble_Single\\CliffRubble_Single0.mdx", x: -1500.0, y: 2700.0, z: -1400.0, scale: 3.25, yaw: 300.0, matrixScale: [3.0, 1.0, 1.25], color: [180, 146, 128] },
    { model: "Doodads\\Cityscape\\Structures\\CityBuildingLarge_0_BaseRuin\\CityBuildingLarge_0_BaseRuin.mdx", x: -200.0, y: 3000.0, z: -1400.0, scale: 2.25, yaw: 130.0, matrixScale: [1.5, 1.0, 1.25], color: [180, 146, 128] },
    { model: "Doodads\\Ruins\\Rocks\\CliffRubble_Single\\CliffRubble_Single0.mdx", x: 1100.0, y: 2800.0, z: -1400.0, scale: 3.25, yaw: 220.0, matrixScale: [3.0, 1.0, 1.25], color: [180, 146, 128] },
    { model: "Doodads\\Cityscape\\Structures\\CityBuildingLarge_0_BaseRuin\\CityBuildingLarge_0_BaseRuin.mdx", x: 2400.0, y: 2650.0, z: -1400.0, scale: 2.75, yaw: 70.0, matrixScale: [1.25, 1.0, 1.25], color: [180, 146, 128] },
    { model: "Doodads\\Ruins\\Rocks\\CliffRubble_Single\\CliffRubble_Single0.mdx", x: 3500.0, y: 2950.0, z: -1400.0, scale: 4.0, yaw: 260.0, matrixScale: [2.25, 1.0, 1.25], color: [180, 146, 128] },
    { model: "Doodads\\Cityscape\\Structures\\City_ColumnSingle1_Ruined\\City_ColumnSingle1_Ruined.mdx", x: -2700.0, y: 2100.0, z: -1400.0, scale: 4.0, yaw: 30.0 },
    { model: "Doodads\\Cityscape\\Structures\\City_ColumnSingle1_Ruined\\City_ColumnSingle1_Ruined.mdx", x: 2500.0, y: 2300.0, z: -1400.0, scale: 3.0, yaw: 90.0 },
    { model: "Doodads\\Cityscape\\Structures\\CityBuildingLarge_90_Ruined\\CityBuildingLarge_90_Ruined.mdx", x: -3700.0, y: 6000.0, z: -1300.0, scale: 4.5, yaw: 200.0, color: [60, 64, 76] },
    { model: "Doodads\\Cityscape\\Structures\\CityBuildingSmall0_2_Ruined\\CityBuildingSmall0_2_Ruined.mdx", x: -2600.0, y: 5800.0, z: -1300.0, scale: 4.5, yaw: 110.0, color: [60, 64, 76] },
    { model: "Doodads\\Cityscape\\Structures\\City_ColumnSemiCircle_Ruined\\City_ColumnSemiCircle_Ruined.mdx", x: -1500.0, y: 6400.0, z: -1300.0, scale: 3.5, yaw: 270.0, color: [60, 64, 76] },
    { model: "Doodads\\Cityscape\\Structures\\CityBuildingSmall135_2_Ruined\\CityBuildingSmall135_2_Ruined.mdx", x: -400.0, y: 5700.0, z: -1300.0, scale: 3.5, yaw: 40.0, color: [60, 64, 76] },
    { model: "Doodads\\Cityscape\\Structures\\CityBuildingLarge_135_Ruined\\CityBuildingLarge_135_Ruined.mdx", x: 3000.0, y: 6100.0, z: -1300.0, scale: 4.5, yaw: 300.0, color: [60, 64, 76] },
    { model: "Doodads\\Cityscape\\Structures\\CityBuildingSmall90_1_Ruined\\CityBuildingSmall90_1_Ruined.mdx", x: 4000.0, y: 5700.0, z: -1300.0, scale: 5.0, yaw: 160.0, color: [60, 64, 76] },
    { model: TOWN_FIRE, x: -3400.0, y: 6000.0, z: -750.0, scale: 2.5, yaw: 20.0, color: [90, 60, 50] },
    { model: TOWN_FIRE, x: 3500.0, y: 6300.0, z: -500.0, scale: 2.5, yaw: 200.0 },
    { model: TOWN_FIRE, x: 2100.0, y: 7400.0, z: -400.0, scale: 3.5, yaw: 110.0 },
    { model: HILL, x: -1000.0, y: 7800.0, z: -1500.0, scale: 18.0, yaw: 30.0, matrixScale: [2.0, 1.0, 1.0], color: [110, 86, 76] },
    { model: HILL, x: 2600.0, y: 8000.0, z: -1500.0, scale: 20.0, yaw: 250.0, matrixScale: [1.75, 1.0, 1.0], color: [110, 86, 76] },
    { model: "Doodads\\Cityscape\\Structures\\CityBuildingLarge_135_Ruined\\CityBuildingLarge_135_Ruined.mdx", x: -700.0, y: 3200.0, z: -1300.0, scale: 2.5, yaw: 70.0, color: [52, 56, 68] },
    { model: "Doodads\\Cityscape\\Structures\\CityBuildingLarge_90_Ruined\\CityBuildingLarge_90_Ruined.mdx", x: 750.0, y: 3000.0, z: -1300.0, scale: 2.25, yaw: 230.0, color: [52, 56, 68] },
    { model: "Doodads\\Cityscape\\Structures\\Archway1_Ruined\\Archway1_Ruined.mdx", x: -100.0, y: 2400.0, z: -1300.0, scale: 1.75, yaw: 90.0 },
    { model: "Doodads\\Cityscape\\Props\\FountainRuined\\FountainRuined.mdx", x: 1300.0, y: 2200.0, z: -1300.0, scale: 3.0, yaw: 0.0 },
    { model: "Doodads\\Cityscape\\Structures\\CityBuildingSmall90_1_Ruined\\CityBuildingSmall90_1_Ruined.mdx", x: -1500.0, y: 2300.0, z: -1300.0, scale: 2.0, yaw: 250.0 },
  ],
};


export const TOMB_OF_SARGERAS_SCENERY: StageScenery = {
  farZ: 13000.0,
  sky: STAGE_SKY_MODELS[7] ?? "",
  skyLook: { zenith: [0.11, 0.19, 0.24], cover: 0.75, sunAzimuth: 120, sunElevation: 40, sun: [0.5, 0.72, 0.68], stars: 0, glow: 0.1 },
  tint: [96, 144, 152],
  fog: { start: 5000.0, end: 11000.0, red: 0.25, green: 0.4375, blue: 0.46875 },

  heightFog: { start: 5000.0, end: 11000.0, density: 0.25, heightStart: -1800.0, heightEnd: -100.0, maxDensity: 0.375, drawOverSky: false },
  pieces: [
    // Delfino's continuous drowned shoreline, with the temple above the right third.
    { model: "Buildings\\Naga\\TempleOfTides\\TempleOfTides.mdx", x: 1250.0, y: 4000.0, z: -800.0, scale: 4.0, yaw: 250.0, color: [104, 156, 164] },
    { model: "Doodads\\Ruins\\Structures\\SRuinArch\\SRuinArch.mdx", x: -4000.0, y: 3900.0, z: -1900.0, scale: 5.0, yaw: 90.0, matrixScale: [0.5, 2.0, 1.0] },
    { model: "Doodads\\Ruins\\Structures\\SRuinArch\\SRuinArch.mdx", x: 0.0, y: 4500.0, z: -2150.0, scale: 6.25, yaw: 270.0, matrixScale: [0.5, 2.0, 1.0] },
    { model: "Doodads\\Ruins\\Structures\\SRuinArch\\SRuinArch.mdx", x: 4000.0, y: 4500.0, z: -1400.0, scale: 4.0, yaw: 85.0, matrixScale: [0.5, 2.0, 1.0] },
    { model: "Doodads\\Ruins\\Rocks\\Ruins_Rock\\Ruins_Rock0.mdx", x: 1500.0, y: 4600.0, z: -5150.0, scale: 17.0, yaw: 287.0, matrixScale: [1.0, 1.0, 2.0] },
    { model: "Doodads\\Terrain\\CliffDoodad\\Waterfall\\Waterfall.mdx", x: -2200.0, y: 3600.0, z: -2200.0, scale: 5.0, yaw: 270.0, matrixScale: [1.0, 1.0, 2.5] },
    { model: "Doodads\\Ruins\\Structures\\SRuinArch\\SRuinArch.mdx", x: -1800.0, y: 3500.0, z: -900.0, scale: 4.0, yaw: 15.0 },
    { model: "Doodads\\Ruins\\Rocks\\Ruins_Rock\\Ruins_Rock0.mdx", x: -3100.0, y: 3900.0, z: -5300.0, scale: 16.0, yaw: 52.0, matrixScale: [1.0, 1.0, 2.0] },
    { model: "Doodads\\Ruins\\Rocks\\Ruins_Rock\\Ruins_Rock0.mdx", x: -850.0, y: 4100.0, z: -5500.0, scale: 14.0, yaw: 145.0, matrixScale: [1.0, 1.0, 2.5] },
    // TS-1/TS-3: coral frames the outer edge rather than stacking another column beneath the waterfall.
    { model: "Doodads\\Ruins\\Water\\Coral\\Coral0.mdx", x: -2500.0, y: 2500.0, z: -2600.0, scale: 3.0, yaw: 300.0, matrixScale: [1.0, 1.0, 4.0] },
    { model: "Doodads\\Ruins\\Rocks\\Ruins_Spires\\Ruins_Spires0.mdx", x: 2400.0, y: 2700.0, z: -2800.0, scale: 3.0, yaw: 140.0, matrixScale: [1.0, 1.0, 3.0] },
    { model: "Doodads\\Ruins\\Rocks\\Ruins_Rock\\Ruins_Rock0.mdx", x: 3250.0, y: 3700.0, z: -5400.0, scale: 12.0, yaw: 205.0, matrixScale: [1.0, 1.0, 3.0] },
    { model: "Doodads\\Ruins\\Props\\RuinsPillar\\RuinsPillar3.mdx", x: -3300.0, y: 1900.0, z: -560.0, scale: 3.0, yaw: 40.0 },
    { model: "Doodads\\Ruins\\Props\\RuinsPillar\\RuinsPillar0.mdx", x: -1500.0, y: 2300.0, z: -800.0, scale: 3.0, yaw: 120.0 },
    { model: "Doodads\\Ruins\\Water\\Coral\\Coral5.mdx", x: 2600.0, y: 2000.0, z: -560.0, scale: 2.0, yaw: 200.0 },
    { model: "Doodads\\Ruins\\Rocks\\Ruins_Rock\\Ruins_Rock7.mdx", x: 3700.0, y: 1700.0, z: -600.0, scale: 2.25, yaw: 300.0 },
    { model: "Doodads\\Ruins\\Water\\CoralArch\\CoralArch0.mdx", x: -800.0, y: 3300.0, z: -700.0, scale: 1.25, yaw: 95.0 },
    { model: "Buildings\\Naga\\TidalGuardian\\TidalGuardian.mdx", x: -3100.0, y: 4600.0, z: -700.0, scale: 3.0, yaw: 250.0 },
    { model: "Doodads\\Ruins\\Structures\\SRuinArch45\\SRuinArch45.mdx", x: -500.0, y: 5300.0, z: -900.0, scale: 3.5, yaw: 300.0 },
    { model: "Doodads\\Ruins\\Structures\\RuinsArchwayBroken450\\RuinsArchwayBroken450.mdx", x: 3300.0, y: 5100.0, z: -900.0, scale: 3.0, yaw: 30.0 },
    { model: ISLE_PEAK, x: -2600.0, y: 7400.0, z: -1000.0, scale: 6.0, yaw: 30.0, matrixScale: [2.0, 1.0, 1.0] },
    { model: ISLE_PEAK, x: 3600.0, y: 7800.0, z: -1000.0, scale: 5.5, yaw: 200.0, matrixScale: [1.5, 1.0, 1.0] },
    { model: ISLE_PEAK, x: 900.0, y: 8400.0, z: -1000.0, scale: 5.0, yaw: 120.0, matrixScale: [3.0, 1.0, 0.75] },
  ],
};
