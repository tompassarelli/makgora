import { f32 } from "wisp/src/sim/f32";
import { STAGE_SKY_MODELS } from "../../generated/stages/stageSkyInfo";
import type { StageScenery } from "./stageScenery";
import { STAGE_GROUND_MODEL, STAGE_PLAGUE_MODEL } from "../../generated/stages/terrainAssetInfo";
import { SCOURGE_WALL_MODEL } from "../assets/importedModelInfo";

const SPIRES = "Doodads\\Outland\\Rocks\\Outland_Spires\\Outland_Spires7.mdx";
const ZEPPELIN = "Units\\Creeps\\GoblinZeppelin\\GoblinZeppelin.mdx";
const MOUND = "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks2.mdx";
const GATE = "Doodads\\Icecrown\\Terrain\\IceCrownGate\\IceCrownGate.mdx";
const ARCHWAY = "Doodads\\Dungeon\\Structures\\DungeonArchway1\\DungeonArchway1.mdx";
const PORTCULLIS = "Doodads\\Dungeon\\Structures\\PorticulisWall0_\\PorticulisWall0_0.mdx";
const PILLAR = "Doodads\\Icecrown\\Props\\IceCrownPillar\\IceCrownPillar0.mdx";
const RUNE_OBELISK = "Doodads\\Northrend\\Props\\NorthrendObilisk\\NorthrendObilisk.mdx";
const CRYPT = "buildings\\undead\\TombOfRelics\\TombOfRelics.mdx";
const SARCOPHAGUS = "Doodads\\Northrend\\Structures\\NorthrendCrypt\\NorthrendCrypt.mdx";
const CAGE = "Doodads\\LordaeronSummer\\Props\\CageEmpty\\CageEmpty.mdx";
const IRON_MAIDEN = "Doodads\\Dungeon\\Props\\IronMaiden\\IronMaiden.mdx";
const TORTURE_TABLE = "Doodads\\Dungeon\\Props\\TortureTable\\TortureTable.mdx";
const RUBBLE = "Doodads\\Icecrown\\Structures\\Icecrown_Rubble\\Icecrown_Rubble0.mdx";
const ROCK = "Doodads\\Dungeon\\Rocks\\DungeonRock\\DungeonRock3.mdx";
const COLUMN = "Doodads\\Northrend\\Props\\NorthrendBrokenColumn\\NorthrendBrokenColumn0.mdx";
const GEYSER = "Doodads\\Icecrown\\Water\\BubbleGeyserSteam\\BubbleGeyserSteam.mdx";
const FIRE = "Environment\\UndeadBuildingFire\\UndeadLargeBuildingFire1.mdx";
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

    { model: MOUND, x: -4000.0, y: 4500.0, z: -1308.0, scale: 12.0, yaw: 195.0, matrixScale: [2.5, 1.0, 1.75] },
    { model: MOUND, x: -3150.0, y: 4300.0, z: -1708.0, scale: 10.5, yaw: 170.0, matrixScale: [2.75, 1.0, 2.0] },
    { model: MOUND, x: -2300.0, y: 4600.0, z: -1730.0, scale: 13.0, yaw: 185.0, matrixScale: [2.5, 1.0, 1.75] },
    { model: MOUND, x: -1400.0, y: 4350.0, z: -1700.0, scale: 11.0, yaw: 165.0, matrixScale: [2.75, 1.0, 1.75] },
    { model: MOUND, x: -500.0, y: 4650.0, z: -2244.0, scale: 12.5, yaw: 200.0, matrixScale: [2.5, 1.0, 1.75] },
    { model: MOUND, x: 400.0, y: 4400.0, z: -2100.0, scale: 10.0, yaw: 175.0, matrixScale: [3.0, 1.0, 2.0] },
    { model: MOUND, x: 1150.0, y: 4700.0, z: -1558.0, scale: 14.0, yaw: 190.0, matrixScale: [2.5, 1.0, 1.5] },
    { model: MOUND, x: 2050.0, y: 4300.0, z: -2109.0, scale: 10.25, yaw: 160.0, matrixScale: [3.0, 1.0, 2.0] },
    { model: MOUND, x: 3000.0, y: 4550.0, z: -1498.0, scale: 13.25, yaw: 205.0, matrixScale: [2.5, 1.0, 1.5] },
    { model: MOUND, x: 3950.0, y: 4350.0, z: -1382.0, scale: 8.5, yaw: 180.0, matrixScale: [3.5, 1.0, 2.5] },
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
  fog: { start: 3300.0, end: 10000.0, red: 0.15625, green: 0.21875, blue: 0.1875 },
  floor: { model: STAGE_PLAGUE_MODEL, z: -1300.0, color: [132, 150, 128] },
  pieces: [
    { model: ARCHWAY, x: 2300.0, y: 5400.0, z: -1300.0, scale: 3.5, yaw: 270.0, matrixScale: [1.0, 1.0, 1.375], color: [72, 64, 88] },
    { model: GATE, x: 2300.0, y: 5800.0, z: -1300.0, scale: 3.75, yaw: 90.0, matrixScale: [1.0, 1.0, 1.25], color: [66, 58, 80] },
    { model: ARCHWAY, x: -2700.0, y: 5000.0, z: -1300.0, scale: 4.25, yaw: 90.0, matrixScale: [1.0, 1.0, 1.125], color: [72, 64, 88] },
    { model: ARCHWAY, x: -200.0, y: 6100.0, z: -1300.0, scale: 3.0, yaw: 270.0, matrixScale: [1.0, 1.0, 1.75], color: [68, 60, 84] },
    { model: SCOURGE_WALL_MODEL, x: -5150.0, y: 6700.0, z: -1300.0, scale: 8.0, yaw: 0.0, color: [112, 102, 126] },
    { model: SCOURGE_WALL_MODEL, x: -4250.0, y: 6700.0, z: -1300.0, scale: 8.0, yaw: 0.0, color: [112, 102, 126] },
    { model: SCOURGE_WALL_MODEL, x: -3350.0, y: 6700.0, z: -1300.0, scale: 8.0, yaw: 0.0, color: [112, 102, 126] },
    { model: SCOURGE_WALL_MODEL, x: -2450.0, y: 6700.0, z: -1300.0, scale: 8.0, yaw: 0.0, color: [112, 102, 126] },
    { model: SCOURGE_WALL_MODEL, x: -1550.0, y: 6700.0, z: -1300.0, scale: 8.0, yaw: 0.0, color: [112, 102, 126] },
    { model: SCOURGE_WALL_MODEL, x: -650.0, y: 6700.0, z: -1300.0, scale: 8.0, yaw: 0.0, color: [112, 102, 126] },
    { model: SCOURGE_WALL_MODEL, x: 250.0, y: 6700.0, z: -1300.0, scale: 8.0, yaw: 0.0, color: [112, 102, 126] },
    { model: SCOURGE_WALL_MODEL, x: 1150.0, y: 6700.0, z: -1300.0, scale: 8.0, yaw: 0.0, color: [112, 102, 126] },
    { model: SCOURGE_WALL_MODEL, x: 2050.0, y: 6700.0, z: -1300.0, scale: 8.0, yaw: 0.0, color: [112, 102, 126] },
    { model: SCOURGE_WALL_MODEL, x: 2950.0, y: 6700.0, z: -1300.0, scale: 8.0, yaw: 0.0, color: [112, 102, 126] },
    { model: SCOURGE_WALL_MODEL, x: 3850.0, y: 6700.0, z: -1300.0, scale: 8.0, yaw: 0.0, color: [112, 102, 126] },
    { model: SCOURGE_WALL_MODEL, x: 4750.0, y: 6700.0, z: -1300.0, scale: 8.0, yaw: 0.0, color: [112, 102, 126] },
    { model: SCOURGE_WALL_MODEL, x: 5650.0, y: 6700.0, z: -1300.0, scale: 8.0, yaw: 0.0, color: [112, 102, 126] },
    { model: PILLAR, x: -3300.0, y: 3600.0, z: -1300.0, scale: 7.0, yaw: 40.0, matrixScale: [1.0, 1.0, 2.5], color: [78, 70, 96] },
    { model: PILLAR, x: 3100.0, y: 3200.0, z: -1300.0, scale: 9.5, yaw: 300.0, matrixScale: [1.0, 1.0, 1.875], color: [78, 70, 96] },
    { model: RUNE_OBELISK, x: -900.0, y: 4200.0, z: -1300.0, scale: 5.0, yaw: 200.0 },
    { model: CRYPT, x: -1700.0, y: 4600.0, z: -1300.0, scale: 3.25, yaw: 260.0, color: [76, 68, 92] },
    { model: PLAGUE_CLOUD, x: -2300.0, y: 3200.0, z: -1250.0, scale: 3.0, yaw: 0.0 },
    { model: PLAGUE_CLOUD, x: 900.0, y: 3900.0, z: -1250.0, scale: 2.5, yaw: 0.0 },
    { model: PLAGUE_CLOUD, x: 2700.0, y: 2600.0, z: -1250.0, scale: 2.0, yaw: 0.0 },
    { model: GEYSER, x: -900.0, y: 3400.0, z: -1300.0, scale: 2.0, yaw: 0.0 },
    { model: GEYSER, x: 1700.0, y: 3100.0, z: -1300.0, scale: 1.5, yaw: 0.0 },
    { model: RUBBLE, x: -3600.0, y: 1450.0, z: -1400.0, scale: 6.0, yaw: 20.0, matrixScale: [1.5, 1.0, 1.75], color: [60, 54, 70] },
    { model: ROCK, x: -2500.0, y: 1650.0, z: -1400.0, scale: 4.5, yaw: 160.0, matrixScale: [1.25, 1.0, 1.25], color: [60, 54, 70] },
    { model: RUBBLE, x: -1400.0, y: 1500.0, z: -1400.0, scale: 5.0, yaw: 250.0, matrixScale: [1.75, 1.0, 1.75], color: [60, 54, 70] },
    { model: ROCK, x: -300.0, y: 1700.0, z: -1400.0, scale: 3.75, yaw: 80.0, matrixScale: [1.5, 1.0, 1.375], color: [60, 54, 70] },
    { model: RUBBLE, x: 800.0, y: 1550.0, z: -1400.0, scale: 5.0, yaw: 310.0, matrixScale: [1.75, 1.0, 1.75], color: [60, 54, 70] },
    { model: ROCK, x: 1900.0, y: 1600.0, z: -1400.0, scale: 4.5, yaw: 200.0, matrixScale: [1.25, 1.0, 1.25], color: [60, 54, 70] },
    { model: RUBBLE, x: 3000.0, y: 1450.0, z: -1400.0, scale: 6.0, yaw: 120.0, matrixScale: [1.5, 1.0, 1.75], color: [60, 54, 70] },
    { model: ROCK, x: 4000.0, y: 1650.0, z: -1400.0, scale: 5.0, yaw: 340.0, matrixScale: [1.0, 1.0, 1.25], color: [60, 54, 70] },
    { model: PORTCULLIS, x: -3700.0, y: 2700.0, z: -1750.0, scale: 6.0, yaw: 95.0, color: [100, 92, 116] },
    { model: COLUMN, x: -2500.0, y: 2900.0, z: -1400.0, scale: 5.0, yaw: 40.0, matrixScale: [1.0, 1.0, 1.25], color: [100, 92, 116] },
    { model: PORTCULLIS, x: -1300.0, y: 2650.0, z: -1800.0, scale: 5.0, yaw: 85.0, color: [100, 92, 116] },
    { model: RUBBLE, x: -200.0, y: 3000.0, z: -1400.0, scale: 6.0, yaw: 130.0, matrixScale: [1.75, 1.0, 2.5], color: [100, 92, 116] },
    { model: PORTCULLIS, x: 1000.0, y: 2800.0, z: -1900.0, scale: 6.5, yaw: 90.0, color: [100, 92, 116] },
    { model: COLUMN, x: 2200.0, y: 2650.0, z: -1400.0, scale: 3.75, yaw: 220.0, matrixScale: [1.0, 1.0, 1.75], color: [100, 92, 116] },
    { model: PORTCULLIS, x: 3500.0, y: 2950.0, z: -2100.0, scale: 8.0, yaw: 265.0, color: [100, 92, 116] },
    { model: CAGE, x: -2900.0, y: 2200.0, z: -1300.0, scale: 4.5, yaw: 200.0 },
    { model: IRON_MAIDEN, x: -1800.0, y: 2300.0, z: -1300.0, scale: 7.0, yaw: 250.0 },
    { model: FIRE, x: -650.0, y: 2250.0, z: -1300.0, scale: 1.5, yaw: 0.0 },
    { model: SARCOPHAGUS, x: 1500.0, y: 2100.0, z: -1300.0, scale: 3.5, yaw: 230.0, color: [112, 104, 126] },
    { model: TORTURE_TABLE, x: 2600.0, y: 2350.0, z: -1300.0, scale: 5.0, yaw: 300.0 },
    { model: RUNE_OBELISK, x: 3500.0, y: 2150.0, z: -1300.0, scale: 4.0, yaw: 150.0 },
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
