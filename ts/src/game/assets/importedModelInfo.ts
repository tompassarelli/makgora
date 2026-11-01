import { f32 } from "wisp/src/sim/f32";
import { THRALL_MODEL_FILE } from "../fighters/thrall/clips";







export const LICH_KING_MODEL = "war3mapImported\\LichKing2.mdx";


export const LICH_KING_ICON = "ReplaceableTextures\\CommandButtons\\BTNLichKing.blp";




export const LICH_KING_STOCK_SCALE = { unit: "LichKing2", scale: 1.0 } as const;


export const HOWLING_BLAST_MODEL = "Abilities\\Weapons\\FrostWyrmMissile\\FrostWyrmMissile.mdx";




export const GROM_BLOODLUST_MODEL = "war3mapImported\\GromBloodlustQuiet.mdx";

export const SCOURGE_WALL_MODEL = "war3mapImported\\UndeadWalls.mdx";

export const TYRANDE_MODEL = "war3mapImported\\TyrandeDismountedV2.mdx";

export const TYRANDE_ICON = "ReplaceableTextures\\CommandButtons\\BTNPriestessOfTheMoon.blp";

export const TYRANDE_STOCK_SCALE = { unit: "TyrandeDismountedV2", scale: 1.0 } as const;

export const PRESTOR_MODEL = "war3mapImported\\KatranaPrestorHero.mdx";

export const PRESTOR_STOCK_SCALE = { unit: "KatranaPrestorHero", scale: 1.0 } as const;

export const ONYXIA_DRAGON_MODEL = "war3mapImported\\OnyxiaDragon.mdx";

export const ONYXIA_DRAGON_STOCK_SCALE = { unit: "OnyxiaDragon", scale: f32(0.48) } as const;

export const IMPORTED_MODEL_FILES: readonly { readonly entry: string; readonly file: string; readonly reanimated?: true }[] = [
  { entry: GROM_BLOODLUST_MODEL, file: "GromBloodlustQuiet.mdx" },
  { entry: SCOURGE_WALL_MODEL, file: "UndeadWalls.mdx" },
  { entry: LICH_KING_MODEL, file: "LichKing2.mdx" },
  { entry: THRALL_MODEL_FILE, file: "WarchiefThrallDismountedV2.mdx", reanimated: true },
  // Warcraft derives a unit portrait path by appending "_Portrait".
  { entry: "war3mapImported\\LichKing2_Portrait.mdx", file: "LichKing2_Portrait.mdx" },
  { entry: "LichKing.BLP", file: "LichKing.BLP" },
  { entry: "HelmOfDom.BLP", file: "HelmOfDom.BLP" },
  { entry: "FrostmourneNew.blp", file: "FrostmourneNew.blp" },
  { entry: LICH_KING_ICON, file: "BTNLichKing.blp" },
  { entry: "ReplaceableTextures\\CommandButtonsDisabled\\DISBTNLichKing.blp", file: "DISBTNLichKing.blp" },
  { entry: "ReplaceableTextures\\SSCscorescreen-hero-lichking.blp", file: "SSCscorescreen-hero-lichking.blp" },
  { entry: TYRANDE_MODEL, file: "TyrandeDismountedV2.mdx", reanimated: true },
  { entry: PRESTOR_MODEL, file: "KatranaPrestorHero.mdx" },
  { entry: "KatranaPrestor.blp", file: "KatranaPrestor.blp" },
  { entry: ONYXIA_DRAGON_MODEL, file: "OnyxiaDragon.mdx" },
  ...["Attach", "Body", "Fin", "Head", "Limbs"].map((part) => ({ entry: `OnyxiaDragon${part}.blp`, file: `OnyxiaDragon${part}.blp` })),
];
