import { f32 } from "wisp/src/sim/f32";
import type { StageScenery } from "./stageScenery";
import { STAGE_SKY_MODELS } from "../../generated/stages/stageSkyInfo";
import { STAGE_GROUND_MODEL, STAGE_LAVA_MODEL } from "../../generated/stages/terrainAssetInfo";
import { STAGE_CRAG_CRAG_MODEL, STAGE_CRAG_KNOLL_MODEL, STAGE_CRAG_PEAK_MODEL } from "../../generated/stages/cragAssetInfo";

const SPIRE = "Doodads\\Felwood\\Rocks\\Felwood_Spires\\Felwood_Spires0.mdx";
const BACK = "Doodads\\Ruins\\Rocks\\Ruins_Spires\\Ruins_Spires0.mdx";
const ASHEN_MOUND = "Doodads\\Ashenvale\\Rocks\\AshenRock\\AshenRock2.mdx";
const SPIRES0 = "Doodads\\Outland\\Rocks\\Outland_Spires\\Outland_Spires0.mdx";
const SPIRES2 = "Doodads\\Outland\\Rocks\\Outland_Spires\\Outland_Spires2.mdx";
const SPIRES7 = "Doodads\\Outland\\Rocks\\Outland_Spires\\Outland_Spires7.mdx";
const SPIRES8 = "Doodads\\Outland\\Rocks\\Outland_Spires\\Outland_Spires8.mdx";
const BASALT = "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks0.mdx";
const TRAP = "Doodads\\Cinematic\\FireTrapUp\\FireTrapUp.mdx";
const PILLAR = "Doodads\\Cinematic\\FirePillarMedium\\FirePillarMedium.mdx";
const OBELISK = "Doodads\\Ruins\\Props\\RuinsObelisk\\RuinsObelisk1.mdx";
const QIRAJI_GATE = "Doodads\\Ruins\\Structures\\SRuinArch\\SRuinArch.mdx";
const ZIGGURAT = "buildings\\other\\NerubianZiggurat\\NerubianZiggurat.mdx";
const MESA_SPIRE = "Doodads\\Barrens\\Rocks\\Barrens_Spires\\Barrens_Spires0.mdx";
const DUNE_SPIRE = "Doodads\\Barrens\\Rocks\\Barrens_Spires\\Barrens_Spires2.mdx";
const LOW_SPIRE = "Doodads\\Barrens\\Rocks\\Barrens_Spires\\Barrens_Spires1.mdx";
const GRANITE_NEAR = [150, 156, 162] as const;
const GRANITE_MID = [190, 196, 204] as const;
const GRANITE_FAR = [220, 226, 234] as const;

export const NORDRASSIL_SCENERY: StageScenery = {
  farZ: 13000.0,
  sky: STAGE_SKY_MODELS[10] ?? "",
  skyLook: { zenith: [f32(0.04), f32(0.07), f32(0.094)], cover: f32(0.45), sunAzimuth: 70, sunElevation: 28, sun: [f32(0.16), f32(0.26), f32(0.24)], stars: f32(0.8), glow: f32(0.15) },
  tint: [34, 46, 42],
  fog: { start: 5000.0, end: 5300.0, red: 0.0625, green: 0.09375, blue: 0.078125 },
  heightFog: { start: 5500.0, end: 11000.0, density: 0.25, heightStart: -2600.0, heightEnd: -600.0, maxDensity: 0.5, drawOverSky: false },
  floor: { model: STAGE_GROUND_MODEL, z: -1050.0, color: [14, 22, 18] },
  pieces: [
    { model: "Doodads\\Ashenvale\\Structures\\Worldtree\\Worldtree.mdx", x: 0.0, y: 4000.0, z: -1050.0, scale: f32(0.55), yaw: 300.0, color: [60, 52, 50] },
    { model: SPIRE, x: -3890.0, y: 4300.0, z: -1508.0, scale: 3.25, yaw: 140.0, matrixScale: [2.75, 1.0, 1.5] },
    { model: SPIRE, x: -3390.0, y: 4650.0, z: -1631.0, scale: 4.5, yaw: 250.0, matrixScale: [2.5, 1.0, 1.25] },
    { model: SPIRE, x: -2690.0, y: 4350.0, z: -1634.0, scale: 3.5, yaw: 75.0, matrixScale: [2.75, 1.0, 1.5] },
    { model: SPIRE, x: -2190.0, y: 4600.0, z: -1551.0, scale: 4.25, yaw: 200.0, matrixScale: [2.5, 1.0, 1.25] },
    { model: SPIRE, x: -1490.0, y: 4400.0, z: -1694.0, scale: 3.0, yaw: 310.0, matrixScale: [2.75, 1.0, 1.75] },
    { model: SPIRE, x: -990.0, y: 4700.0, z: -1732.0, scale: 4.75, yaw: 30.0, matrixScale: [2.5, 1.0, 1.25] },
    { model: SPIRE, x: 1410.0, y: 4650.0, z: -1651.0, scale: 4.5, yaw: 225.0, matrixScale: [2.5, 1.0, 1.25] },
    { model: SPIRE, x: 2110.0, y: 4400.0, z: -1719.0, scale: 5.5, yaw: 50.0, matrixScale: [2.75, 1.0, 1.0] },
    { model: SPIRE, x: 2610.0, y: 4600.0, z: -1691.0, scale: 4.5, yaw: 330.0, matrixScale: [2.5, 1.0, 1.25] },
    { model: SPIRE, x: 3310.0, y: 4300.0, z: -1684.0, scale: 3.0, yaw: 95.0, matrixScale: [2.75, 1.0, 1.75] },
    { model: SPIRE, x: 3810.0, y: 4500.0, z: -1591.0, scale: 4.25, yaw: 260.0, matrixScale: [2.5, 1.0, 1.25] },
    { model: ASHEN_MOUND, x: -3420.0, y: 3850.0, z: -1536.0, scale: 10.5, yaw: 170.0, matrixScale: [3.0, 1.0, 1.25] },
    { model: ASHEN_MOUND, x: -2500.0, y: 4100.0, z: -1692.0, scale: 13.0, yaw: 185.0, matrixScale: [3.0, 1.0, 1.25] },
    { model: ASHEN_MOUND, x: -1420.0, y: 3900.0, z: -1548.0, scale: 11.0, yaw: 165.0, matrixScale: [3.0, 1.0, 1.25] },
    { model: ASHEN_MOUND, x: 1500.0, y: 4150.0, z: -1452.0, scale: 14.0, yaw: 190.0, matrixScale: [3.0, 1.0, 1.0] },
    { model: ASHEN_MOUND, x: 2580.0, y: 3900.0, z: -1476.0, scale: 10.25, yaw: 160.0, matrixScale: [3.0, 1.0, 1.25] },
    { model: ASHEN_MOUND, x: 3500.0, y: 4000.0, z: -1743.0, scale: 13.25, yaw: 205.0, matrixScale: [3.0, 1.0, 1.25] },
    { model: BACK, x: -3820.0, y: 4800.0, z: -1374.0, scale: 5.25, yaw: 190.0, matrixScale: [3.0, 1.0, 1.0] },
    { model: BACK, x: -3280.0, y: 4800.0, z: -1440.0, scale: 4.0, yaw: 300.0, matrixScale: [3.0, 1.0, 1.25] },
    { model: BACK, x: -2620.0, y: 4800.0, z: -1414.0, scale: 5.25, yaw: 120.0, matrixScale: [3.0, 1.0, 1.0] },
    { model: BACK, x: -2080.0, y: 4800.0, z: -1658.0, scale: 4.0, yaw: 250.0, matrixScale: [3.0, 1.0, 1.5] },
    { model: BACK, x: -1420.0, y: 4800.0, z: -1504.0, scale: 5.25, yaw: 10.0, matrixScale: [3.0, 1.0, 1.0] },
    { model: BACK, x: -880.0, y: 4800.0, z: -1808.0, scale: 4.0, yaw: 160.0, matrixScale: [3.0, 1.0, 1.5] },
    { model: BACK, x: 980.0, y: 4800.0, z: -1414.0, scale: 5.25, yaw: 300.0, matrixScale: [3.0, 1.0, 1.0] },
    { model: BACK, x: 1520.0, y: 4800.0, z: -1658.0, scale: 4.0, yaw: 120.0, matrixScale: [3.0, 1.0, 1.5] },
    { model: BACK, x: 2180.0, y: 4800.0, z: -1504.0, scale: 5.25, yaw: 250.0, matrixScale: [3.0, 1.0, 1.0] },
    { model: BACK, x: 2720.0, y: 4800.0, z: -1808.0, scale: 4.0, yaw: 10.0, matrixScale: [3.0, 1.0, 1.5] },
    { model: BACK, x: 3380.0, y: 4800.0, z: -1374.0, scale: 5.25, yaw: 160.0, matrixScale: [3.0, 1.0, 1.0] },
    { model: BACK, x: 3920.0, y: 4800.0, z: -1440.0, scale: 4.0, yaw: 40.0, matrixScale: [3.0, 1.0, 1.25] },
    { model: SPIRE, x: -4050.0, y: 4450.0, z: -1579.0, scale: 5.5, yaw: 200.0, matrixScale: [4.0, 1.0, 1.0] },
    { model: SPIRE, x: 4050.0, y: 4600.0, z: -1561.0, scale: 4.25, yaw: 20.0, matrixScale: [4.0, 1.0, 1.25] },
    { model: ASHEN_MOUND, x: -4050.0, y: 4000.0, z: -1711.0, scale: 13.0, yaw: 190.0, matrixScale: [4.5, 1.0, 1.5] },
    { model: ASHEN_MOUND, x: 4050.0, y: 3950.0, z: -1467.0, scale: 16.5, yaw: 175.0, matrixScale: [4.0, 1.0, 1.0] },
    { model: BACK, x: -220.0, y: 5000.0, z: -1374.0, scale: 5.25, yaw: 40.0, matrixScale: [3.0, 1.0, 1.0] },
    { model: SPIRE, x: 210.0, y: 5000.0, z: -1711.0, scale: 4.5, yaw: 285.0, matrixScale: [2.5, 1.0, 1.25] },
    { model: BACK, x: 520.0, y: 5000.0, z: -1440.0, scale: 4.0, yaw: 190.0, matrixScale: [3.0, 1.0, 1.25] },
    { model: "Doodads\\Ashenvale\\Rocks\\AshenRock\\AshenRock0.mdx", x: -3600.0, y: 1450.0, z: -1150.0, scale: 6.5, yaw: 20.0, matrixScale: [1.5, 1.0, 1.25], color: [34, 46, 42] },
    { model: "Doodads\\Felwood\\Rocks\\FelwoodRock\\FelwoodRock3.mdx", x: -2500.0, y: 1650.0, z: -1150.0, scale: 3.5, yaw: 160.0, matrixScale: [2.25, 1.0, 1.25], color: [34, 46, 42] },
    { model: "Doodads\\Ashenvale\\Rocks\\AshenRock\\AshenRock0.mdx", x: -1400.0, y: 1500.0, z: -1150.0, scale: 4.75, yaw: 250.0, matrixScale: [2.0, 1.0, 1.25], color: [34, 46, 42] },
    { model: "Doodads\\Felwood\\Rocks\\FelwoodRock\\FelwoodRock3.mdx", x: -300.0, y: 1700.0, z: -1150.0, scale: 2.5, yaw: 80.0, matrixScale: [3.25, 1.0, 1.25], color: [34, 46, 42] },
    { model: "Doodads\\Ashenvale\\Rocks\\AshenRock\\AshenRock0.mdx", x: 800.0, y: 1550.0, z: -1150.0, scale: 4.75, yaw: 310.0, matrixScale: [2.0, 1.0, 1.25], color: [34, 46, 42] },
    { model: "Doodads\\Felwood\\Rocks\\FelwoodRock\\FelwoodRock3.mdx", x: 1900.0, y: 1600.0, z: -1150.0, scale: 3.25, yaw: 200.0, matrixScale: [2.5, 1.0, 1.25], color: [34, 46, 42] },
    { model: "Doodads\\Ashenvale\\Rocks\\AshenRock\\AshenRock0.mdx", x: 3000.0, y: 1450.0, z: -1150.0, scale: 6.25, yaw: 120.0, matrixScale: [1.5, 1.0, 1.25], color: [34, 46, 42] },
    { model: "Doodads\\Felwood\\Rocks\\FelwoodRock\\FelwoodRock3.mdx", x: 4000.0, y: 1650.0, z: -1150.0, scale: 4.25, yaw: 340.0, matrixScale: [1.75, 1.0, 1.25], color: [34, 46, 42] },
    { model: "Doodads\\Felwood\\Rocks\\FelwoodRock\\FelwoodRock3.mdx", x: -4000.0, y: 2600.0, z: -1150.0, scale: 5.25, yaw: 190.0, matrixScale: [1.75, 1.0, 1.25], color: [34, 46, 42] },
    { model: "Doodads\\Ashenvale\\Rocks\\AshenRock\\AshenRock0.mdx", x: -2800.0, y: 2900.0, z: -1150.0, scale: 7.5, yaw: 40.0, matrixScale: [1.5, 1.0, 1.25], color: [34, 46, 42] },
    { model: "Doodads\\Felwood\\Rocks\\FelwoodRock\\FelwoodRock3.mdx", x: -1500.0, y: 2700.0, z: -1150.0, scale: 4.0, yaw: 300.0, matrixScale: [2.25, 1.0, 1.25], color: [34, 46, 42] },
    { model: "Doodads\\Ashenvale\\Rocks\\AshenRock\\AshenRock0.mdx", x: -200.0, y: 3000.0, z: -1150.0, scale: 5.75, yaw: 130.0, matrixScale: [2.0, 1.0, 1.25], color: [34, 46, 42] },
    { model: "Doodads\\Felwood\\Rocks\\FelwoodRock\\FelwoodRock3.mdx", x: 1100.0, y: 2800.0, z: -1150.0, scale: 4.0, yaw: 220.0, matrixScale: [2.25, 1.0, 1.25], color: [34, 46, 42] },
    { model: "Doodads\\Ashenvale\\Rocks\\AshenRock\\AshenRock0.mdx", x: 2400.0, y: 2650.0, z: -1150.0, scale: 7.75, yaw: 70.0, matrixScale: [1.5, 1.0, 1.25], color: [34, 46, 42] },
    { model: "Doodads\\Felwood\\Rocks\\FelwoodRock\\FelwoodRock3.mdx", x: 3500.0, y: 2950.0, z: -1150.0, scale: 5.25, yaw: 260.0, matrixScale: [1.75, 1.0, 1.25], color: [34, 46, 42] },
    { model: "Buildings\\NightElf\\MoonWell\\MoonWell.mdx", x: -2600.0, y: 2200.0, z: -950.0, scale: 1.5, yaw: 250.0, color: [90, 120, 140] },
    { model: "Buildings\\NightElf\\MoonWell\\MoonWell.mdx", x: 2900.0, y: 2350.0, z: -950.0, scale: 1.0, yaw: 290.0, color: [90, 120, 140] },
    { model: "Doodads\\Ashenvale\\Structures\\AshenBrokenColumn\\AshenBrokenColumn0.mdx", x: -1700.0, y: 2000.0, z: -1150.0, scale: 4.5, yaw: 30.0 },
    { model: "Doodads\\Ashenvale\\Structures\\AshenRuinsBlocks\\AshenRuinsBlocks.mdx", x: 1800.0, y: 2100.0, z: -1150.0, scale: 5.0, yaw: 200.0 },
    { model: "Doodads\\Ashenvale\\Structures\\ARockArch\\ARockArch.mdx", x: 3700.0, y: 2300.0, z: -1150.0, scale: 1.75, yaw: 95.0 },
    { model: "Doodads\\Ashenvale\\Props\\AshenObilisk\\AshenObilisk.mdx", x: -3600.0, y: 2400.0, z: -1150.0, scale: 4.0, yaw: 300.0 },
  ],
};

export const GRYPHON_SCENERY: StageScenery = {
  farZ: 13000.0,
  sky: STAGE_SKY_MODELS[11] ?? "",

  fog: { start: 5000.0, end: 9000.0, red: 0.5, green: 0.625, blue: 0.75 },
  heightFog: { start: 5000.0, end: 9000.0, density: 0.25, heightStart: -1800.0, heightEnd: -500.0, maxDensity: 0.5, drawOverSky: true },
  floor: { model: STAGE_GROUND_MODEL, z: -1300.0, color: [46, 66, 40] },
  pieces: [

    { model: "Buildings\\Human\\GryphonAviary\\GryphonAviary.mdx", x: 0.0, y: 5050.0, z: -450.0, scale: f32(2.6), yaw: 270.0 },
    { model: STAGE_CRAG_CRAG_MODEL, x: 0.0, y: 4900.0, z: -1400.0, scale: 1.0, yaw: 180.0, matrixScale: [17.5, 18.0, 3.75], color: GRANITE_FAR },
    { model: STAGE_CRAG_KNOLL_MODEL, x: -2300.0, y: 4600.0, z: -1400.0, scale: 1.0, yaw: 200.0, matrixScale: [11.0, 7.0, 4.25], color: GRANITE_FAR },
    { model: STAGE_CRAG_PEAK_MODEL, x: -3650.0, y: 5200.0, z: -1400.0, scale: 1.0, yaw: 170.0, matrixScale: [13.5, 9.0, 5.75], color: GRANITE_FAR },
    { model: STAGE_CRAG_CRAG_MODEL, x: -1350.0, y: 5600.0, z: -1400.0, scale: 1.0, yaw: 150.0, matrixScale: [10.0, 7.0, 4.5], color: GRANITE_FAR },
    { model: "Buildings\\Human\\Blacksmith\\Blacksmith.mdx", x: 1550.0, y: 5800.0, z: -830.0, scale: 2.0, yaw: 250.0 },
    { model: STAGE_CRAG_KNOLL_MODEL, x: 1550.0, y: 5800.0, z: -1400.0, scale: 1.0, yaw: 20.0, matrixScale: [13.0, 8.0, 4.25], color: GRANITE_FAR },
    { model: STAGE_CRAG_CRAG_MODEL, x: 2750.0, y: 5000.0, z: -1400.0, scale: 1.0, yaw: 210.0, matrixScale: [11.0, 8.0, 7.0], color: GRANITE_FAR },
    { model: STAGE_CRAG_PEAK_MODEL, x: 3950.0, y: 4500.0, z: -1400.0, scale: 1.0, yaw: 120.0, matrixScale: [12.0, 8.0, 4.0], color: GRANITE_FAR },
    { model: STAGE_CRAG_CRAG_MODEL, x: -2300.0, y: 8000.0, z: -1400.0, scale: 1.0, yaw: 160.0, matrixScale: [14.0, 14.0, 8.75], color: GRANITE_FAR },
    { model: STAGE_CRAG_PEAK_MODEL, x: 2600.0, y: 8800.0, z: -1400.0, scale: 1.0, yaw: 200.0, matrixScale: [21.0, 15.0, 8.5], color: GRANITE_FAR },
    { model: STAGE_CRAG_CRAG_MODEL, x: 5200.0, y: 7400.0, z: -1400.0, scale: 1.0, yaw: 90.0, matrixScale: [14.0, 11.0, 7.0], color: GRANITE_FAR },
    { model: STAGE_CRAG_KNOLL_MODEL, x: 300.0, y: 7600.0, z: -1400.0, scale: 1.0, yaw: 60.0, matrixScale: [22.0, 14.0, 9.0], color: GRANITE_FAR },
    { model: STAGE_CRAG_KNOLL_MODEL, x: -2050.0, y: 3200.0, z: -1400.0, scale: 1.0, yaw: 35.0, matrixScale: [3.5, 3.5, 3.0], color: GRANITE_NEAR },
    { model: STAGE_CRAG_CRAG_MODEL, x: -3600.0, y: 1450.0, z: -1400.0, scale: 1.0, yaw: 20.0, matrixScale: [8.0, 4.5, 2.75], color: GRANITE_NEAR },
    { model: STAGE_CRAG_KNOLL_MODEL, x: -2500.0, y: 1650.0, z: -1400.0, scale: 1.0, yaw: 160.0, matrixScale: [9.0, 7.25, 5.5], color: GRANITE_NEAR },
    { model: STAGE_CRAG_CRAG_MODEL, x: -1400.0, y: 1500.0, z: -1400.0, scale: 1.0, yaw: 250.0, matrixScale: [7.5, 3.75, 2.5], color: GRANITE_NEAR },
    { model: STAGE_CRAG_KNOLL_MODEL, x: -300.0, y: 1700.0, z: -1400.0, scale: 1.0, yaw: 80.0, matrixScale: [8.75, 6.0, 5.25], color: GRANITE_NEAR },
    { model: STAGE_CRAG_CRAG_MODEL, x: 800.0, y: 1550.0, z: -1400.0, scale: 1.0, yaw: 310.0, matrixScale: [7.5, 3.75, 2.5], color: GRANITE_NEAR },
    { model: STAGE_CRAG_KNOLL_MODEL, x: 1900.0, y: 1600.0, z: -1400.0, scale: 1.0, yaw: 200.0, matrixScale: [8.75, 7.0, 5.5], color: GRANITE_NEAR },
    { model: STAGE_CRAG_CRAG_MODEL, x: 3000.0, y: 1450.0, z: -1400.0, scale: 1.0, yaw: 120.0, matrixScale: [7.75, 4.5, 2.75], color: GRANITE_NEAR },
    { model: STAGE_CRAG_KNOLL_MODEL, x: 4000.0, y: 1650.0, z: -1400.0, scale: 1.0, yaw: 340.0, matrixScale: [8.0, 7.0, 5.75], color: GRANITE_NEAR },
    { model: STAGE_CRAG_KNOLL_MODEL, x: -4000.0, y: 2600.0, z: -1400.0, scale: 1.0, yaw: 190.0, matrixScale: [10.75, 8.0, 7.25], color: GRANITE_MID },
    { model: STAGE_CRAG_CRAG_MODEL, x: -2800.0, y: 2900.0, z: -1400.0, scale: 1.0, yaw: 40.0, matrixScale: [10.0, 5.75, 3.75], color: GRANITE_MID },
    { model: STAGE_CRAG_KNOLL_MODEL, x: -1500.0, y: 2700.0, z: -1400.0, scale: 1.0, yaw: 300.0, matrixScale: [11.0, 8.75, 6.75], color: GRANITE_MID },
    { model: STAGE_CRAG_CRAG_MODEL, x: -200.0, y: 3000.0, z: -1400.0, scale: 1.0, yaw: 130.0, matrixScale: [10.75, 4.75, 3.5], color: GRANITE_MID },
    { model: STAGE_CRAG_KNOLL_MODEL, x: 1100.0, y: 2800.0, z: -1400.0, scale: 1.0, yaw: 220.0, matrixScale: [11.25, 8.0, 7.0], color: GRANITE_MID },
    { model: STAGE_CRAG_CRAG_MODEL, x: 2400.0, y: 2650.0, z: -1400.0, scale: 1.0, yaw: 70.0, matrixScale: [10.5, 6.0, 3.75], color: GRANITE_MID },
    { model: STAGE_CRAG_KNOLL_MODEL, x: 3500.0, y: 2950.0, z: -1400.0, scale: 1.0, yaw: 260.0, matrixScale: [10.75, 8.0, 7.25], color: GRANITE_MID },
    { model: "Doodads\\LordaeronSummer\\Structures\\LRockArch\\LRockArch.mdx", x: -2700.0, y: 2200.0, z: -1400.0, scale: 2.25, yaw: 95.0, color: GRANITE_MID },
    { model: "Doodads\\LordaeronSummer\\Structures\\LRockArch\\LRockArch.mdx", x: 3100.0, y: 2350.0, z: -1400.0, scale: 1.75, yaw: 60.0, color: GRANITE_MID },
    { model: STAGE_CRAG_CRAG_MODEL, x: -1800.0, y: 3600.0, z: -1400.0, scale: 1.0, yaw: 130.0, matrixScale: [12.0, 6.0, 3.0], color: GRANITE_MID },
  ],
};

export const BLACKROCK_SCENERY: StageScenery = {
  farZ: 17000.0,
  sky: STAGE_SKY_MODELS[12] ?? "",
  fog: { start: 8000.0, end: 16000.0, red: 0.5, green: 0.125, blue: 0.0625 },
  floor: { model: STAGE_LAVA_MODEL, z: -1300.0, color: [118, 73, 64] },
  pieces: [
    { model: SPIRES0, x: -4000.0, y: 4400.0, z: -1599.0, scale: 3.5, yaw: 190.0, matrixScale: [1.75, 1.0, 1.5] },
    { model: SPIRES8, x: -3450.0, y: 4250.0, z: -1491.0, scale: 3.25, yaw: 170.0, matrixScale: [1.75, 1.0, 1.5] },
    { model: SPIRES7, x: -2800.0, y: 4550.0, z: -1632.0, scale: 3.75, yaw: 200.0, matrixScale: [1.75, 1.0, 1.5] },
    { model: SPIRES2, x: -2000.0, y: 4300.0, z: -1744.0, scale: 3.0, yaw: 165.0, matrixScale: [2.0, 1.0, 2.0] },
    { model: SPIRES0, x: -1200.0, y: 4600.0, z: -1599.0, scale: 3.25, yaw: 185.0, matrixScale: [1.75, 1.0, 1.75] },
    { model: SPIRES8, x: -400.0, y: 4350.0, z: -1552.0, scale: 3.5, yaw: 205.0, matrixScale: [1.75, 1.0, 1.5] },
    { model: SPIRES7, x: 400.0, y: 4500.0, z: -1560.0, scale: 3.0, yaw: 175.0, matrixScale: [2.0, 1.0, 1.75] },
    { model: SPIRES2, x: 1200.0, y: 4250.0, z: -1694.0, scale: 3.75, yaw: 160.0, matrixScale: [1.75, 1.0, 1.5] },
    { model: SPIRES0, x: 2000.0, y: 4550.0, z: -1499.0, scale: 3.0, yaw: 195.0, matrixScale: [2.0, 1.0, 1.75] },
    { model: SPIRES8, x: 2800.0, y: 4300.0, z: -1441.0, scale: 3.25, yaw: 180.0, matrixScale: [1.75, 1.0, 1.5] },
    { model: SPIRES7, x: 3600.0, y: 4600.0, z: -1410.0, scale: 3.5, yaw: 190.0, matrixScale: [1.75, 1.0, 1.5] },
    { model: SPIRES2, x: 4000.0, y: 4350.0, z: -1694.0, scale: 3.0, yaw: 170.0, matrixScale: [2.0, 1.0, 2.0] },
    { model: SPIRES7, x: -3250.0, y: 5300.0, z: -1488.0, scale: 3.25, yaw: 165.0, matrixScale: [2.25, 1.0, 1.5] },
    { model: SPIRES0, x: -2400.0, y: 5000.0, z: -1506.0, scale: 4.5, yaw: 175.0, matrixScale: [2.25, 1.0, 1.0] },
    { model: SPIRES0, x: -1550.0, y: 5300.0, z: -1678.0, scale: 3.25, yaw: 175.0, matrixScale: [2.25, 1.0, 1.5] },
    { model: SPIRES8, x: -875.0, y: 5000.0, z: -1702.0, scale: 3.5, yaw: 205.0, matrixScale: [2.25, 1.0, 1.5] },
    { model: SPIRES8, x: -75.0, y: 5100.0, z: -1541.0, scale: 3.25, yaw: 200.0, matrixScale: [2.25, 1.0, 1.5] },
    { model: SPIRES7, x: 850.0, y: 5100.0, z: -1832.0, scale: 4.5, yaw: 165.0, matrixScale: [2.25, 1.0, 1.25] },
    { model: SPIRES7, x: 1675.0, y: 5100.0, z: -1488.0, scale: 3.25, yaw: 205.0, matrixScale: [2.25, 1.0, 1.5] },
    { model: SPIRES2, x: 2400.0, y: 5000.0, z: -1494.0, scale: 4.5, yaw: 165.0, matrixScale: [2.25, 1.0, 1.25] },
    { model: SPIRES0, x: 3275.0, y: 5100.0, z: -1635.0, scale: 4.0, yaw: 200.0, matrixScale: [2.25, 1.0, 1.25] },
    { model: BASALT, x: -2500.0, y: 4800.0, z: -1600.0, scale: 7.0, yaw: 190.0, matrixScale: [1.75, 1.0, 5.5], color: [30, 28, 30] },
    { model: BASALT, x: -3300.0, y: 4000.0, z: -1550.0, scale: 6.0, yaw: 20.0, matrixScale: [2.25, 1.0, 2.5], color: [30, 28, 30] },
    { model: BASALT, x: 3200.0, y: 4050.0, z: -1550.0, scale: 6.0, yaw: 150.0, matrixScale: [2.25, 1.0, 2.0], color: [30, 28, 30] },
    { model: TRAP, x: 2000.0, y: 4550.0, z: 880.0, scale: 2.0, yaw: 0.0 },
    { model: PILLAR, x: -2800.0, y: 4550.0, z: 930.0, scale: 1.25, yaw: 0.0 },
  ],
};

export const AHNQIRAJ_SCENERY: StageScenery = {
  farZ: 17000.0,
  sky: STAGE_SKY_MODELS[13] ?? "",
  fog: { start: 8000.0, end: 16000.0, red: 0.125, green: 0.1015625, blue: 0.125 },
  tint: [58, 50, 58],
  floor: { model: STAGE_GROUND_MODEL, z: -1300.0, color: [40, 35, 38] },
  pieces: [

    { model: QIRAJI_GATE, x: -700.0, y: 4800.0, z: -1330.0, scale: 4.5, yaw: 90.0, matrixScale: [1.0, f32(0.7), 1.0], color: [78, 68, 78] },
    { model: OBELISK, x: 1500.0, y: 4000.0, z: -1451.0, scale: 3.0, yaw: 300.0, matrixScale: [1.0, 1.0, 3.0] },
    { model: OBELISK, x: 2150.0, y: 4100.0, z: -1579.0, scale: 2.5, yaw: 330.0, matrixScale: [1.0, 1.0, 3.5] },
    { model: ZIGGURAT, x: -2600.0, y: 4700.0, z: -1300.0, scale: 1.0, yaw: 250.0, matrixScale: [5.5, 5.5, 5.5], color: [78, 68, 78] },
    { model: ZIGGURAT, x: 1300.0, y: 5300.0, z: -1300.0, scale: 1.0, yaw: 290.0, matrixScale: [6.5, 6.5, 6.5], color: [78, 68, 78] },
    { model: "Doodads\\Ruins\\Structures\\SRuinArch45\\SRuinArch45.mdx", x: 2650.0, y: 4400.0, z: -1330.0, scale: 3.0, yaw: 200.0, color: [78, 68, 78] },
    { model: MESA_SPIRE, x: -3900.0, y: 4400.0, z: -1500.0, scale: 3.5, yaw: 190.0, matrixScale: [1.5, 1.0, 1.5], color: [78, 68, 78] },
    { model: MESA_SPIRE, x: 3900.0, y: 4900.0, z: -1500.0, scale: 4.5, yaw: 20.0, matrixScale: [1.5, 1.0, 1.25], color: [78, 68, 78] },
    { model: LOW_SPIRE, x: 2050.0, y: 5700.0, z: -1500.0, scale: 3.0, yaw: 300.0, matrixScale: [2.0, 1.0, 1.0], color: [78, 68, 78] },
    { model: LOW_SPIRE, x: -2700.0, y: 8500.0, z: -1500.0, scale: 7.0, yaw: 60.0, matrixScale: [2.0, 1.0, 1.0], color: [78, 68, 78] },
    { model: MESA_SPIRE, x: 1800.0, y: 9000.0, z: -1500.0, scale: 6.0, yaw: 230.0, matrixScale: [2.0, 1.0, 0.75], color: [78, 68, 78] },
    { model: ZIGGURAT, x: -300.0, y: 8800.0, z: -1500.0, scale: 1.0, yaw: 270.0, matrixScale: [7.0, 7.0, 7.0], color: [78, 68, 78] },
    { model: DUNE_SPIRE, x: -3600.0, y: 1450.0, z: -1400.0, scale: 2.5, yaw: 20.0, matrixScale: [1.5, 1.0, 1.125], color: [58, 50, 58] },
    { model: LOW_SPIRE, x: -2500.0, y: 1650.0, z: -1400.0, scale: 2.5, yaw: 160.0, matrixScale: [1.75, 1.0, 1.0], color: [58, 50, 58] },
    { model: DUNE_SPIRE, x: -1400.0, y: 1500.0, z: -1400.0, scale: 2.5, yaw: 250.0, matrixScale: [1.5, 1.0, 1.0], color: [58, 50, 58] },
    { model: LOW_SPIRE, x: -300.0, y: 1700.0, z: -1400.0, scale: 2.5, yaw: 80.0, matrixScale: [1.75, 1.0, 0.875], color: [58, 50, 58] },
    { model: DUNE_SPIRE, x: 800.0, y: 1550.0, z: -1400.0, scale: 2.5, yaw: 310.0, matrixScale: [1.5, 1.0, 1.0], color: [58, 50, 58] },
    { model: LOW_SPIRE, x: 1900.0, y: 1600.0, z: -1400.0, scale: 2.5, yaw: 200.0, matrixScale: [1.75, 1.0, 1.0], color: [58, 50, 58] },
    { model: DUNE_SPIRE, x: 3000.0, y: 1450.0, z: -1400.0, scale: 2.5, yaw: 120.0, matrixScale: [1.5, 1.0, 1.0], color: [58, 50, 58] },
    { model: LOW_SPIRE, x: 4000.0, y: 1650.0, z: -1400.0, scale: 2.5, yaw: 340.0, matrixScale: [1.75, 1.0, 1.0], color: [58, 50, 58] },
    { model: "Doodads\\Ruins\\Rocks\\CliffRubble_Single\\CliffRubble_Single0.mdx", x: -4000.0, y: 2600.0, z: -1400.0, scale: 3.5, yaw: 190.0, matrixScale: [2.75, 1.0, 1.25], color: [58, 50, 58] },
    { model: "Doodads\\Ruins\\Rocks\\CliffRubble_Single\\CliffRubble_Single0.mdx", x: -2800.0, y: 2900.0, z: -1400.0, scale: 3.5, yaw: 40.0, matrixScale: [2.75, 1.0, 1.25], color: [58, 50, 58] },
    { model: "Doodads\\Ruins\\Rocks\\CliffRubble_Single\\CliffRubble_Single0.mdx", x: -1500.0, y: 2700.0, z: -1400.0, scale: 3.5, yaw: 300.0, matrixScale: [2.75, 1.0, 1.25], color: [58, 50, 58] },
    { model: "Doodads\\Ruins\\Rocks\\CliffRubble_Single\\CliffRubble_Single0.mdx", x: -200.0, y: 3000.0, z: -1400.0, scale: 3.5, yaw: 130.0, matrixScale: [2.75, 1.0, 1.25], color: [58, 50, 58] },
    { model: "Doodads\\Ruins\\Rocks\\CliffRubble_Single\\CliffRubble_Single0.mdx", x: 1100.0, y: 2800.0, z: -1400.0, scale: 3.5, yaw: 220.0, matrixScale: [2.75, 1.0, 1.25], color: [58, 50, 58] },
    { model: "Doodads\\Ruins\\Rocks\\CliffRubble_Single\\CliffRubble_Single0.mdx", x: 2400.0, y: 2650.0, z: -1400.0, scale: 3.5, yaw: 70.0, matrixScale: [2.75, 1.0, 1.25], color: [58, 50, 58] },
    { model: "Doodads\\Ruins\\Rocks\\CliffRubble_Single\\CliffRubble_Single0.mdx", x: 3500.0, y: 2950.0, z: -1400.0, scale: 3.5, yaw: 260.0, matrixScale: [2.75, 1.0, 1.25], color: [58, 50, 58] },
    { model: "Doodads\\Ruins\\Structures\\RuinsArchwayBroken450\\RuinsArchwayBroken450.mdx", x: -2800.0, y: 2150.0, z: -1350.0, scale: 2.0, yaw: 30.0, color: [58, 50, 58] },
    { model: "Doodads\\Barrens\\Plants\\Cactus\\Cactus2.mdx", x: -3350.0, y: 2350.0, z: -1400.0, scale: 4.0, yaw: 110.0 },
    { model: "Doodads\\Ruins\\Structures\\RuinsArchwayBroken00\\RuinsArchwayBroken00.mdx", x: 2400.0, y: 2300.0, z: -1350.0, scale: 2.25, yaw: 95.0, color: [58, 50, 58] },
    { model: "Doodads\\Barrens\\Plants\\Cactus\\Cactus0.mdx", x: 3500.0, y: 2000.0, z: -1400.0, scale: 4.5, yaw: 200.0 },
  ],
};
