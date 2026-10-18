import { f32 } from "wisp/src/sim/f32";
import { STAGE_SKY_MODELS } from "../../generated/stages/stageSkyInfo";
import type { StageScenery } from "./stageScenery";
import { STAGE_TOMB_SEA_MODEL } from "../../generated/stages/terrainAssetInfo";

const SPIRES = "Doodads\\Outland\\Rocks\\Outland_Spires\\Outland_Spires7.mdx";
const GLACIER = "Doodads\\Icecrown\\Rocks\\Glacier\\Glacier0.mdx";
const ZEPPELIN = "Units\\Creeps\\GoblinZeppelin\\GoblinZeppelin.mdx";
const MOUND = "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks2.mdx";
const RUINED_LARGE_0 = "Doodads\\Cityscape\\Structures\\CityBuildingLarge_0_Ruined\\CityBuildingLarge_0_Ruined.mdx";
const RUINED_LARGE_45 = "Doodads\\Cityscape\\Structures\\CityBuildingLarge_45_Ruined\\CityBuildingLarge_45_Ruined.mdx";
const RUINED_SMALL_45 = "Doodads\\Cityscape\\Structures\\CityBuildingSmall45_0_Ruined\\CityBuildingSmall45_0_Ruined.mdx";
const RUINED_SMALL_90 = "Doodads\\Cityscape\\Structures\\CityBuildingSmall90_2_Ruined\\CityBuildingSmall90_2_Ruined.mdx";

export const DUROTAR_SCENERY: StageScenery = {
  farZ: 13000.0,
  sky: STAGE_SKY_MODELS[3] ?? "",
  fog: { start: 5000.0, end: 11000.0, red: 0.75, green: 0.5, blue: 0.25 },
  floor: { model: STAGE_TOMB_SEA_MODEL, z: -1300.0, color: [168, 140, 120] },
  drifters: [
    { model: ZEPPELIN, fromX: -7000.0, toX: 7000.0, y: 5600.0, z: 800.0, bob: 40.0, bobs: 6.0, scale: 2.5, seconds: 50.0, offset: 0.25 },
  ],
  pieces: [

    { model: MOUND, x: -4000.0, y: 4500.0, z: -1608.0, scale: 12.0, yaw: 195.0, matrixScale: [2.5, 1.0, 1.75] },
    { model: MOUND, x: -3150.0, y: 4300.0, z: -1708.0, scale: 10.5, yaw: 170.0, matrixScale: [2.75, 1.0, 2.0] },
    { model: MOUND, x: -2300.0, y: 4600.0, z: -1730.0, scale: 13.0, yaw: 185.0, matrixScale: [2.5, 1.0, 1.75] },
    { model: MOUND, x: -1400.0, y: 4350.0, z: -1486.0, scale: 11.0, yaw: 165.0, matrixScale: [2.75, 1.0, 1.75] },
    { model: MOUND, x: -500.0, y: 4650.0, z: -1694.0, scale: 12.5, yaw: 200.0, matrixScale: [2.5, 1.0, 1.75] },
    { model: MOUND, x: 400.0, y: 4400.0, z: -1610.0, scale: 10.0, yaw: 175.0, matrixScale: [3.0, 1.0, 2.0] },
    { model: MOUND, x: 1150.0, y: 4700.0, z: -1558.0, scale: 14.0, yaw: 190.0, matrixScale: [2.5, 1.0, 1.5] },
    { model: MOUND, x: 2050.0, y: 4300.0, z: -1609.0, scale: 10.25, yaw: 160.0, matrixScale: [3.0, 1.0, 2.0] },
    { model: MOUND, x: 3000.0, y: 4550.0, z: -1498.0, scale: 13.25, yaw: 205.0, matrixScale: [2.5, 1.0, 1.5] },
    { model: MOUND, x: 3950.0, y: 4350.0, z: -1682.0, scale: 8.5, yaw: 180.0, matrixScale: [3.5, 1.0, 2.5] },
    { model: SPIRES, x: -3500.0, y: 4100.0, z: -1459.0, scale: 1.75, yaw: 30.0, matrixScale: [1.5, 1.0, 2.75] },
    { model: SPIRES, x: 3600.0, y: 4200.0, z: -1524.0, scale: 2.25, yaw: 330.0, matrixScale: [1.5, 1.0, 2.25] },
    { model: "buildings\\orc\\WatchTower\\WatchTower.mdx", x: -2300.0, y: 4600.0, z: 60.0, scale: 3.0, yaw: 300.0 },
    { model: "buildings\\orc\\WatchTower\\WatchTower.mdx", x: 1150.0, y: 4700.0, z: 95.0, scale: 3.0, yaw: 255.0 },
    { model: "buildings\\orc\\WatchTower\\WatchTower.mdx", x: 3000.0, y: 4550.0, z: 66.0, scale: 2.75, yaw: 285.0 },
  ],
};

export const NAXXRAMAS_SCENERY: StageScenery = {
  farZ: 20000.0,
  sky: STAGE_SKY_MODELS[4] ?? "",
  fog: { start: 3300.0, end: 19000.0, red: 0.09375, green: 0.3125, blue: 0.25 },
  floor: { model: STAGE_TOMB_SEA_MODEL, z: -1300.0, color: [72, 80, 92] },
  pieces: [
    { model: "buildings\\undead\\Necropolis\\Necropolis.mdx", x: 1500.0, y: 6600.0, z: 350.0, scale: 2.5, yaw: 250.0, flying: true },
    { model: RUINED_LARGE_45, x: -3900.0, y: 4100.0, z: -1300.0, scale: 2.8125, yaw: 35.0, matrixScale: [1.0, 1.0, 1.25] },
    { model: RUINED_SMALL_45, x: -3000.0, y: 4350.0, z: -1300.0, scale: 3.1875, yaw: 96.0, matrixScale: [1.0, 1.0, 1.25] },
    { model: RUINED_LARGE_0, x: -2100.0, y: 4150.0, z: -1300.0, scale: 3.0, yaw: 157.0, matrixScale: [1.0, 1.0, 1.25] },
    { model: RUINED_SMALL_90, x: -1200.0, y: 4450.0, z: -1300.0, scale: 2.8125, yaw: 218.0, matrixScale: [1.0, 1.0, 1.25] },
    { model: RUINED_LARGE_45, x: -300.0, y: 4200.0, z: -1300.0, scale: 3.0, yaw: 279.0, matrixScale: [1.0, 1.0, 1.25] },
    { model: RUINED_SMALL_45, x: 600.0, y: 4400.0, z: -1300.0, scale: 3.1875, yaw: 340.0, matrixScale: [1.0, 1.0, 1.25] },
    { model: RUINED_LARGE_0, x: 1500.0, y: 4100.0, z: -1300.0, scale: 2.8125, yaw: 41.0, matrixScale: [1.0, 1.0, 1.25] },
    { model: RUINED_SMALL_90, x: 2400.0, y: 4350.0, z: -1300.0, scale: 3.1875, yaw: 102.0, matrixScale: [1.0, 1.0, 1.25] },
    { model: RUINED_LARGE_45, x: 3200.0, y: 4150.0, z: -1300.0, scale: 3.0, yaw: 163.0, matrixScale: [1.0, 1.0, 1.25] },
    { model: RUINED_SMALL_45, x: 4000.0, y: 4450.0, z: -1300.0, scale: 2.8125, yaw: 224.0, matrixScale: [1.0, 1.0, 1.25] },
    { model: GLACIER, x: -3700.0, y: 5300.0, z: -2199.0, scale: 7.0, yaw: 180.0, matrixScale: [2.0, 1.0, 0.75] },
    { model: GLACIER, x: -2300.0, y: 5400.0, z: -2442.0, scale: 8.0, yaw: 170.0, matrixScale: [1.75, 1.0, 0.75] },
    { model: GLACIER, x: -900.0, y: 5250.0, z: -2078.0, scale: 6.5, yaw: 190.0, matrixScale: [2.25, 1.0, 0.75] },
    { model: GLACIER, x: 700.0, y: 5450.0, z: -2563.0, scale: 8.5, yaw: 175.0, matrixScale: [1.75, 1.0, 0.75] },
    { model: GLACIER, x: 2200.0, y: 5300.0, z: -2292.0, scale: 6.0, yaw: 200.0, matrixScale: [2.25, 1.0, 1.0] },
    { model: GLACIER, x: 3600.0, y: 5400.0, z: -1921.0, scale: 9.5, yaw: 165.0, matrixScale: [2.0, 1.0, 0.5] },
  ],
};

export const HELLFIRE_SCENERY: StageScenery = {
  farZ: 17000.0,
  sky: STAGE_SKY_MODELS[14] ?? "",
  fog: { start: 3300.0, end: 16000.0, red: 0.3125, green: 0.203125, blue: 0.171875 },
  floor: { model: STAGE_TOMB_SEA_MODEL, z: -1300.0, color: [88, 36, 28] },
  pieces: [
    { model: SPIRES, x: -3800.0, y: 4500.0, z: -1321.0, scale: 5.0, yaw: 175.0, matrixScale: [1.75, 1.0, 0.75] },
    { model: SPIRES, x: -3250.0, y: 4350.0, z: -1816.0, scale: 4.5, yaw: 195.0, matrixScale: [2.0, 1.0, 1.0] },
    { model: SPIRES, x: -2550.0, y: 4650.0, z: -1443.0, scale: 5.5, yaw: 165.0, matrixScale: [1.5, 1.0, 0.75] },
    { model: SPIRES, x: -1100.0, y: 4400.0, z: -1335.0, scale: 4.75, yaw: 205.0, matrixScale: [1.75, 1.0, 0.75] },
    { model: SPIRES, x: -200.0, y: 4700.0, z: -1387.0, scale: 5.25, yaw: 185.0, matrixScale: [1.75, 1.0, 0.75] },
    { model: SPIRES, x: 700.0, y: 4450.0, z: -1711.0, scale: 4.25, yaw: 160.0, matrixScale: [2.0, 1.0, 1.0] },
    { model: SPIRES, x: 1600.0, y: 4600.0, z: -1499.0, scale: 5.75, yaw: 200.0, matrixScale: [1.5, 1.0, 0.75] },
    { model: SPIRES, x: 2500.0, y: 4300.0, z: -1786.0, scale: 4.5, yaw: 170.0, matrixScale: [2.0, 1.0, 1.0] },
    { model: SPIRES, x: 3400.0, y: 4650.0, z: -1341.0, scale: 5.0, yaw: 190.0, matrixScale: [1.75, 1.0, 0.75] },
    { model: SPIRES, x: 4050.0, y: 4400.0, z: -1918.0, scale: 6.5, yaw: 180.0, matrixScale: [1.5, 1.0, 0.75] },
    { model: "Abilities\\Spells\\NightElf\\Immolation\\ImmolationTarget.mdx", x: -1850.0, y: 4500.0, z: -1100.0, scale: 0.75, yaw: 0.0 },
    { model: "Abilities\\Spells\\NightElf\\Immolation\\ImmolationTarget.mdx", x: 2500.0, y: 4300.0, z: 280.0, scale: 0.5, yaw: 0.0 },
  ],
};
