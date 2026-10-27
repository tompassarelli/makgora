import { resolve } from 'node:path';
import type { BodyPose, PoseSample } from './victoryAnatomy';

/** Every selectable fighter's victory clip sampled as world joint pivots, written by tools/animations/victory-anatomy.ts from the shipped models. */
export const VICTORY_ANATOMY_RECORD = resolve(import.meta.dir, '../../test/fixtures/victory-anatomy.json');

/** Fighters whose arms have no elbow joint to bend, so the record leaves them out. */
export const VICTORY_UNJOINTED: Readonly<Record<string, string>> = {
    Thrall: 'his rider arm is one bone from shoulder to wrist',
};

/** Victories whose upper arm still pulls out of its shoulder seam (#496), each owed a re-authored cheer; every other rule holds for them. */
export const VICTORY_SEAM_DEBT: Readonly<Record<string, string>> = {
    Illidan: 'his right arm opens its seam at frame 75 as the V drops',
    'Shadow Hunter': 'his raised arms pull out of the shoulders through the cheer',
    'Goblin Tinker': 'his raised arm pulls out of its shoulder',
    Medivh: 'his raised arm pulls out of its shoulder',
};

export interface VictoryAnatomyRecord { readonly fighter: string; readonly clip: string; readonly rest: BodyPose; readonly samples: readonly PoseSample[] }
