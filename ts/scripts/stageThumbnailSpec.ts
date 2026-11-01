




import { createHash } from "node:crypto";
import { STAGE_CATALOG, type StageTile } from "../src/game/menu/stageCatalog";
import { deckModel, stageModels } from "../src/game/presentation/stagePreload";
import { placedPieces, stageScenery, terrainPieces } from "../src/game/presentation/stageScenery";
import { surfaceCount, surfaceLeft, surfacePass, surfaceRight, surfaceZ } from "../src/game/sim/stage";
import { hasCannon } from "../src/game/sim/stageHazards";


export interface HeroCamera {

  readonly rotation: number;

  readonly angleOfAttack: number;
  readonly distance: number;
  readonly fieldOfView: number;

  readonly x: number;

  readonly z: number;
}

const HERO: HeroCamera = { rotation: 80.0, angleOfAttack: 340.0, distance: 1900.0, fieldOfView: 52.0, x: 0.0, z: -220.0 };


export const HERO_CAMERAS: Readonly<Partial<Record<StageTile, HeroCamera>>> = {
  0: { ...HERO, distance: 1700.0 },
  2: { ...HERO },
  3: { ...HERO },
  4: { ...HERO },
  6: { ...HERO },
  7: { ...HERO },
  10: { ...HERO },
  11: { ...HERO },
  12: { ...HERO },
  13: { ...HERO },
  14: { ...HERO },
};

export const RENDERED_STAGES = STAGE_CATALOG.map((entry) => entry.id).filter((stage) => HERO_CAMERAS[stage] !== undefined);

export const CARD = {

  width: 512,
  height: 512,

  renderWidth: 768,
  renderHeight: 768,

  quality: 82,

  grade: ["-modulate", "100,94,100", "-sigmoidal-contrast", "2.5x42%"],

  skyTop: 0.35,
} as const;


export function stageNamed(name: string): StageTile | undefined {
  return STAGE_CATALOG.find((entry) => entry.name.toLowerCase() === name.toLowerCase())?.id;
}


export function regenerateCommand(stage: StageTile): string {
  const info = STAGE_CATALOG.find((entry) => entry.id === stage);
  return `bun scripts/stageThumbnails.ts --stage ${JSON.stringify(info?.name ?? String(stage))}`;
}


export function thumbnailFile(stage: StageTile): string {
  const info = STAGE_CATALOG.find((entry) => entry.id === stage);
  if (info === undefined) throw new Error(`stage ${stage} is not selectable`);
  return info.texture.replace("war3mapImported\\", "");
}





export function stageArtInputs(stage: StageTile) {
  const surfaces = Array.from({ length: surfaceCount(stage) }, (_, index) => ({
    model: deckModel(stage, index), left: surfaceLeft(stage, index, 0), right: surfaceRight(stage, index, 0), z: surfaceZ(stage, index, 0), pass: surfacePass(stage, index),
  }));
  return {
    stage, file: thumbnailFile(stage),
    scenery: stageScenery(stage), terrain: terrainPieces(stage), pieces: placedPieces(stage), models: stageModels(stage), cannon: hasCannon(stage), surfaces,
    camera: HERO_CAMERAS[stage], card: CARD,
  };
}

const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");


export function stageInputHash(stage: StageTile): string {
  return sha256(JSON.stringify(stageArtInputs(stage)));
}






export interface ThumbnailManifest {
  readonly stages: readonly { readonly stage: number; readonly file: string; readonly inputs: string; readonly sha256: string; readonly bytes: number }[];
}
