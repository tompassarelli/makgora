import { resolve } from 'node:path';
import type { BodyPose, PoseSample } from './victoryAnatomy';

/** Every selectable fighter's victory clip sampled as world joint pivots, written by tools/animations/victory-anatomy.ts from the shipped models. */
export const VICTORY_ANATOMY_RECORD = resolve(import.meta.dir, '../../test/fixtures/victory-anatomy.json');

/** Fighters whose arms have no elbow joint to bend, so the record leaves them out. */
export const VICTORY_UNJOINTED: Readonly<Record<string, string>> = {
    Thrall: 'his rider arm is one bone from shoulder to wrist',
};

export interface VictoryAnatomyRecord { readonly fighter: string; readonly clip: string; readonly rest: BodyPose; readonly samples: readonly PoseSample[] }
