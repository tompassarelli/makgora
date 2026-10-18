import { f32 } from "wisp/src/sim/f32";
import { STAGE_SKY_MODELS } from "../../generated/stages/stageSkyInfo";
import type { StageScenery } from "./stageScenery";
import { STAGE_GROUND_MODEL } from "../../generated/stages/terrainAssetInfo";

const SPIRES = "Doodads\\Outland\\Rocks\\Outland_Spires\\Outland_Spires7.mdx";
const ZEPPELIN = "Units\\Creeps\\GoblinZeppelin\\GoblinZeppelin.mdx";
const MOUND = "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks2.mdx";
const NECROPOLIS = "buildings\\undead\\Necropolis\\Necropolis.mdx";
const ZIGGURAT = "buildings\\undead\\Ziggurat\\Ziggurat.mdx";
const SLAUGHTERHOUSE = "buildings\\undead\\Slaughterhouse\\Slaughterhouse.mdx";
const BONEYARD = "buildings\\undead\\Boneyard\\Boneyard.mdx";
const GRAVEYARD = "buildings\\undead\\Graveyard\\Graveyard.mdx";
const TEMPLE = "buildings\\undead\\TempleOfTheDamned\\TempleOfTheDamned.mdx";
const PLAGUE_CLOUD = "Abilities\\Spells\\Undead\\PlagueCloud\\PlagueCloudCaster.mdx";

export const DUROTAR_SCENERY: StageScenery = {
  farZ: 13000.0,
  sky: STAGE_SKY_MODELS[3] ?? "",
  fog: { start: 5000.0, end: 11000.0, red: 0.75, green: 0.5, blue: 0.25 },
  floor: { model: STAGE_GROUND_MODEL, z: -1300.0, color: [64, 40, 30] },
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
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks2.mdx", x: -3600.0, y: 1450.0, z: -1400.0, scale: 7.5, yaw: 20.0, matrixScale: [1.75, 1.0, 1.25], color: [200, 120, 90] },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Spires\\Barrens_Spires3.mdx", x: -2500.0, y: 1650.0, z: -1400.0, scale: 1.5, yaw: 160.0, matrixScale: [2.75, 1.0, 1.25], color: [200, 120, 90] },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks2.mdx", x: -1400.0, y: 1500.0, z: -1400.0, scale: 6.0, yaw: 250.0, matrixScale: [2.0, 1.0, 1.25], color: [200, 120, 90] },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Spires\\Barrens_Spires3.mdx", x: -300.0, y: 1700.0, z: -1400.0, scale: 1.25, yaw: 80.0, matrixScale: [3.5, 1.0, 1.25], color: [200, 120, 90] },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks2.mdx", x: 800.0, y: 1550.0, z: -1400.0, scale: 5.75, yaw: 310.0, matrixScale: [2.25, 1.0, 1.25], color: [200, 120, 90] },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Spires\\Barrens_Spires3.mdx", x: 1900.0, y: 1600.0, z: -1400.0, scale: 1.5, yaw: 200.0, matrixScale: [2.75, 1.0, 1.25], color: [200, 120, 90] },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks2.mdx", x: 3000.0, y: 1450.0, z: -1400.0, scale: 7.25, yaw: 120.0, matrixScale: [1.75, 1.0, 1.25], color: [200, 120, 90] },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Spires\\Barrens_Spires3.mdx", x: 4000.0, y: 1650.0, z: -1400.0, scale: 1.75, yaw: 340.0, matrixScale: [2.5, 1.0, 1.25], color: [200, 120, 90] },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks2.mdx", x: -4000.0, y: 2600.0, z: -1400.0, scale: 9.0, yaw: 190.0, matrixScale: [1.75, 1.0, 1.25], color: [230, 160, 120] },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Spires\\Barrens_Spires0.mdx", x: -2800.0, y: 2900.0, z: -1400.0, scale: 2.0, yaw: 40.0, matrixScale: [2.5, 1.0, 1.25], color: [230, 160, 120] },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks2.mdx", x: -1500.0, y: 2700.0, z: -1400.0, scale: 7.25, yaw: 300.0, matrixScale: [2.0, 1.0, 1.25], color: [230, 160, 120] },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Spires\\Barrens_Spires0.mdx", x: -200.0, y: 3000.0, z: -1400.0, scale: 1.5, yaw: 130.0, matrixScale: [3.25, 1.0, 1.375], color: [230, 160, 120] },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks2.mdx", x: 1100.0, y: 2800.0, z: -1400.0, scale: 7.5, yaw: 220.0, matrixScale: [2.0, 1.0, 1.25], color: [230, 160, 120] },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Spires\\Barrens_Spires0.mdx", x: 2400.0, y: 2650.0, z: -1400.0, scale: 2.0, yaw: 70.0, matrixScale: [2.5, 1.0, 1.25], color: [230, 160, 120] },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks2.mdx", x: 3500.0, y: 2950.0, z: -1400.0, scale: 9.0, yaw: 260.0, matrixScale: [1.75, 1.0, 1.25], color: [230, 160, 120] },
    { model: "Doodads\\Barrens\\Plants\\Barrens_TreeDoodad\\Barrens_TreeDoodad0.mdx", x: -2700.0, y: 2100.0, z: -1400.0, scale: 3.5, yaw: 40.0 },
    { model: "Doodads\\Barrens\\Plants\\Barrens_TreeDoodad\\Barrens_TreeDoodad5.mdx", x: 1800.0, y: 2300.0, z: -1400.0, scale: 3.25, yaw: 160.0 },
    { model: "Doodads\\Barrens\\Plants\\Barrens_TreeDoodad\\Barrens_TreeDoodad0.mdx", x: 3300.0, y: 2000.0, z: -1400.0, scale: 2.75, yaw: 280.0 },
    { model: "Doodads\\Barrens\\Rocks\\RockPillar\\RockPillar0.mdx", x: -1500.0, y: 2350.0, z: -1400.0, scale: 6.5, yaw: 210.0 },
    { model: "Doodads\\Barrens\\Rocks\\RockPillar\\RockPillar2.mdx", x: 2600.0, y: 2400.0, z: -1400.0, scale: 7.0, yaw: 300.0 },
    { model: "buildings\\orc\\OrcBarracks\\OrcBarracks.mdx", x: -800.0, y: 2350.0, z: -1300.0, scale: 2.0, yaw: 280.0 },
    { model: "buildings\\orc\\SpiritLodge\\SpiritLodge.mdx", x: 650.0, y: 2150.0, z: -1300.0, scale: 2.25, yaw: 240.0 },
    { model: "buildings\\orc\\TrollBurrow\\TrollBurrow.mdx", x: 0.0, y: 2650.0, z: -1300.0, scale: 3.0, yaw: 200.0 },
    { model: MOUND, x: 100.0, y: 1950.0, z: -1400.0, scale: 6.0, yaw: 150.0, matrixScale: [3.0, 1.0, f32(0.9)], color: [200, 120, 90] },
  ],
};

export const NAXXRAMAS_SCENERY: StageScenery = {
  farZ: 20000.0,
  sky: STAGE_SKY_MODELS[4] ?? "",
  fog: { start: 3300.0, end: 19000.0, red: 0.09375, green: 0.3125, blue: 0.25 },
  floor: { model: STAGE_GROUND_MODEL, z: -1300.0, color: [34, 38, 26] },
  pieces: [
    { model: NECROPOLIS, x: 1500.0, y: 6600.0, z: 350.0, scale: 2.5, yaw: 250.0, flying: true },
    { model: ZIGGURAT, x: -3800.0, y: 4150.0, z: -1700.0, scale: 5.0, yaw: 10.0 },
    { model: GRAVEYARD, x: -2900.0, y: 4400.0, z: -1700.0, scale: 4.0, yaw: 290.0 },
    { model: SLAUGHTERHOUSE, x: -2000.0, y: 4200.0, z: -1700.0, scale: 4.5, yaw: 250.0 },
    { model: TEMPLE, x: -1100.0, y: 4450.0, z: -1700.0, scale: 4.0, yaw: 218.0 },
    { model: ZIGGURAT, x: -250.0, y: 4250.0, z: -1700.0, scale: 4.25, yaw: 350.0 },
    { model: BONEYARD, x: 650.0, y: 4400.0, z: -1700.0, scale: 4.0, yaw: 300.0 },
    { model: ZIGGURAT, x: 1500.0, y: 4100.0, z: -1700.0, scale: 3.25, yaw: 20.0 },
    { model: GRAVEYARD, x: 2400.0, y: 4350.0, z: -1700.0, scale: 3.0, yaw: 240.0 },
    { model: TEMPLE, x: 3300.0, y: 4150.0, z: -1700.0, scale: 5.25, yaw: 280.0 },
    { model: BONEYARD, x: 4000.0, y: 4450.0, z: -1700.0, scale: 3.0, yaw: 330.0 },
    { model: PLAGUE_CLOUD, x: -2000.0, y: 4200.0, z: -1000.0, scale: 3.0, yaw: 0.0 },
    { model: PLAGUE_CLOUD, x: 2400.0, y: 4350.0, z: -1050.0, scale: 2.5, yaw: 0.0 },
    { model: SLAUGHTERHOUSE, x: -3000.0, y: 5450.0, z: -1900.0, scale: 5.5, yaw: 120.0 },
    { model: ZIGGURAT, x: 2800.0, y: 5500.0, z: -1900.0, scale: 6.0, yaw: 340.0 },
    { model: "Doodads\\Underground\\Rocks\\UndergoundRock\\UndergoundRock4.mdx", x: -3600.0, y: 1450.0, z: -1400.0, scale: 5.25, yaw: 20.0, matrixScale: [1.75, 1.0, 1.25], color: [124, 114, 134] },
    { model: "Doodads\\Underground\\Rocks\\UndergoundRock\\UndergoundRock0.mdx", x: -2500.0, y: 1650.0, z: -1400.0, scale: 8.25, yaw: 160.0, matrixScale: [1.25, 1.0, 1.25], color: [124, 114, 134] },
    { model: "Doodads\\Underground\\Rocks\\UndergoundRock\\UndergoundRock4.mdx", x: -1400.0, y: 1500.0, z: -1400.0, scale: 4.25, yaw: 250.0, matrixScale: [2.0, 1.0, 1.25], color: [124, 114, 134] },
    { model: "Doodads\\Underground\\Rocks\\UndergoundRock\\UndergoundRock0.mdx", x: -300.0, y: 1700.0, z: -1400.0, scale: 6.75, yaw: 80.0, matrixScale: [1.5, 1.0, 1.25], color: [124, 114, 134] },
    { model: "Doodads\\Underground\\Rocks\\UndergoundRock\\UndergoundRock4.mdx", x: 800.0, y: 1550.0, z: -1400.0, scale: 4.25, yaw: 310.0, matrixScale: [2.0, 1.0, 1.25], color: [124, 114, 134] },
    { model: "Doodads\\Underground\\Rocks\\UndergoundRock\\UndergoundRock0.mdx", x: 1900.0, y: 1600.0, z: -1400.0, scale: 8.0, yaw: 200.0, matrixScale: [1.25, 1.0, 1.25], color: [124, 114, 134] },
    { model: "Doodads\\Underground\\Rocks\\UndergoundRock\\UndergoundRock4.mdx", x: 3000.0, y: 1450.0, z: -1400.0, scale: 5.0, yaw: 120.0, matrixScale: [1.75, 1.0, 1.25], color: [124, 114, 134] },
    { model: "Doodads\\Underground\\Rocks\\UndergoundRock\\UndergoundRock0.mdx", x: 4000.0, y: 1650.0, z: -1400.0, scale: 9.25, yaw: 340.0, matrixScale: [1.0, 0.875, 1.25], color: [124, 114, 134] },
    { model: "Doodads\\Underground\\Rocks\\UndergoundRock\\UndergoundRock0.mdx", x: -4000.0, y: 2600.0, z: -1400.0, scale: 10.75, yaw: 190.0, matrixScale: [1.0, 0.75, 1.25], color: [160, 150, 172] },
    { model: "Doodads\\Underground\\Rocks\\UndergoundRock\\UndergoundRock4.mdx", x: -2800.0, y: 2900.0, z: -1400.0, scale: 5.75, yaw: 40.0, matrixScale: [1.75, 1.0, 1.25], color: [160, 150, 172] },
    { model: "Doodads\\Underground\\Rocks\\UndergoundRock\\UndergoundRock0.mdx", x: -1500.0, y: 2700.0, z: -1400.0, scale: 8.75, yaw: 300.0, matrixScale: [1.25, 1.0, 1.25], color: [160, 150, 172] },
    { model: "Doodads\\Underground\\Rocks\\UndergoundRock\\UndergoundRock4.mdx", x: -200.0, y: 3000.0, z: -1400.0, scale: 4.75, yaw: 130.0, matrixScale: [2.25, 1.0, 1.25], color: [160, 150, 172] },
    { model: "Doodads\\Underground\\Rocks\\UndergoundRock\\UndergoundRock0.mdx", x: 1100.0, y: 2800.0, z: -1400.0, scale: 9.0, yaw: 220.0, matrixScale: [1.25, 0.875, 1.25], color: [160, 150, 172] },
    { model: "Doodads\\Underground\\Rocks\\UndergoundRock\\UndergoundRock4.mdx", x: 2400.0, y: 2650.0, z: -1400.0, scale: 6.0, yaw: 70.0, matrixScale: [1.75, 1.0, 1.25], color: [160, 150, 172] },
    { model: "Doodads\\Underground\\Rocks\\UndergoundRock\\UndergoundRock0.mdx", x: 3500.0, y: 2950.0, z: -1400.0, scale: 10.75, yaw: 260.0, matrixScale: [1.0, 0.75, 1.25], color: [160, 150, 172] },
    { model: "Doodads\\LordaeronSummer\\Structures\\FarmScorched\\FarmScorched.mdx", x: -2900.0, y: 2200.0, z: -1150.0, scale: 3.5, yaw: 200.0 },
    { model: "Doodads\\LordaeronSummer\\Structures\\BarnScorched\\BarnScorched.mdx", x: -1700.0, y: 2400.0, z: -1150.0, scale: 2.5, yaw: 250.0 },
    { model: "Doodads\\LordaeronSummer\\Structures\\WindMillBurned\\WindMillBurned.mdx", x: 2000.0, y: 2300.0, z: -1150.0, scale: 3.0, yaw: 230.0 },
    { model: "Doodads\\LordaeronSummer\\Structures\\TowerScorched\\TowerScorched.mdx", x: 3300.0, y: 2100.0, z: -1180.0, scale: 4.0, yaw: 300.0 },
    { model: "Doodads\\Northrend\\Props\\NorthrendTombstone\\NorthrendTombstone0.mdx", x: 1200.0, y: 2000.0, z: -1400.0, scale: 5.0, yaw: 260.0 },
    { model: "Doodads\\Northrend\\Props\\NorthrendTombstone\\NorthrendTombstone0.mdx", x: -3800.0, y: 2000.0, z: -1400.0, scale: 6.0, yaw: 200.0 },
  ],
};

export const HELLFIRE_SCENERY: StageScenery = {
  farZ: 17000.0,
  sky: STAGE_SKY_MODELS[14] ?? "",
  fog: { start: 3300.0, end: 16000.0, red: 0.3125, green: 0.203125, blue: 0.171875 },
  floor: { model: STAGE_GROUND_MODEL, z: -1300.0, color: [52, 24, 18] },
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
    { model: "Doodads\\Outland\\Rocks\\Outland_Spires\\Outland_Spires7.mdx", x: -3600.0, y: 1450.0, z: -1400.0, scale: 1.5, yaw: 20.0, matrixScale: [3.75, 1.0, 1.375], color: [120, 64, 52] },
    { model: "Doodads\\Outland\\Rocks\\Outland_Rock\\Outland_Rock5.mdx", x: -2500.0, y: 1650.0, z: -1400.0, scale: 7.5, yaw: 160.0, matrixScale: [1.5, 1.0, 1.25], color: [120, 64, 52] },
    { model: "Doodads\\Outland\\Rocks\\Outland_Spires\\Outland_Spires7.mdx", x: -1400.0, y: 1500.0, z: -1400.0, scale: 1.25, yaw: 250.0, matrixScale: [4.0, 1.0, 1.25], color: [120, 64, 52] },
    { model: "Doodads\\Outland\\Rocks\\Outland_Rock\\Outland_Rock5.mdx", x: -300.0, y: 1700.0, z: -1400.0, scale: 6.25, yaw: 80.0, matrixScale: [2.0, 1.0, 1.25], color: [120, 64, 52] },
    { model: "Doodads\\Outland\\Rocks\\Outland_Spires\\Outland_Spires7.mdx", x: 800.0, y: 1550.0, z: -1400.0, scale: 1.25, yaw: 310.0, matrixScale: [4.0, 1.0, 1.25], color: [120, 64, 52] },
    { model: "Doodads\\Outland\\Rocks\\Outland_Rock\\Outland_Rock5.mdx", x: 1900.0, y: 1600.0, z: -1400.0, scale: 7.25, yaw: 200.0, matrixScale: [1.75, 1.0, 1.25], color: [120, 64, 52] },
    { model: "Doodads\\Outland\\Rocks\\Outland_Spires\\Outland_Spires7.mdx", x: 3000.0, y: 1450.0, z: -1400.0, scale: 1.5, yaw: 120.0, matrixScale: [3.75, 1.0, 1.25], color: [120, 64, 52] },
    { model: "Doodads\\Outland\\Rocks\\Outland_Rock\\Outland_Rock5.mdx", x: 4000.0, y: 1650.0, z: -1400.0, scale: 8.5, yaw: 340.0, matrixScale: [1.5, 1.0, 1.25], color: [120, 64, 52] },
    { model: "Doodads\\Outland\\Rocks\\Outland_Rock\\Outland_Rock5.mdx", x: -4000.0, y: 2600.0, z: -1400.0, scale: 10.0, yaw: 190.0, matrixScale: [1.5, 1.0, 1.25], color: [160, 96, 80] },
    { model: "Doodads\\Outland\\Rocks\\RubbleRock\\RubbleRock0.mdx", x: -2800.0, y: 2900.0, z: -1400.0, scale: 15.75, yaw: 40.0, matrixScale: [1.0, 0.75, 1.25], color: [160, 96, 80] },
    { model: "Doodads\\Outland\\Rocks\\Outland_Rock\\Outland_Rock5.mdx", x: -1500.0, y: 2700.0, z: -1400.0, scale: 8.25, yaw: 300.0, matrixScale: [1.75, 1.0, 1.25], color: [160, 96, 80] },
    { model: "Doodads\\Outland\\Rocks\\RubbleRock\\RubbleRock0.mdx", x: -200.0, y: 3000.0, z: -1400.0, scale: 13.0, yaw: 130.0, matrixScale: [1.25, 0.875, 1.25], color: [160, 96, 80] },
    { model: "Doodads\\Outland\\Rocks\\Outland_Rock\\Outland_Rock5.mdx", x: 1100.0, y: 2800.0, z: -1400.0, scale: 8.25, yaw: 220.0, matrixScale: [1.75, 1.0, 1.25], color: [160, 96, 80] },
    { model: "Doodads\\Outland\\Rocks\\RubbleRock\\RubbleRock0.mdx", x: 2400.0, y: 2650.0, z: -1400.0, scale: 16.0, yaw: 70.0, matrixScale: [1.0, 0.75, 1.25], color: [160, 96, 80] },
    { model: "Doodads\\Outland\\Rocks\\Outland_Rock\\Outland_Rock5.mdx", x: 3500.0, y: 2950.0, z: -1400.0, scale: 10.0, yaw: 260.0, matrixScale: [1.5, 1.0, 1.25], color: [160, 96, 80] },
    { model: "Doodads\\Outland\\Structures\\Outland_RockArch\\Outland_RockArch.mdx", x: 2900.0, y: 2300.0, z: -1400.0, scale: 2.25, yaw: 95.0 },
  ],
};
