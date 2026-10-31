import type { StrikeCapsule } from "../heroMoves";
import type { HitEffect } from "../hitRegions";
import type { AppliedStatus } from "../appliedStatus";

export interface SpecialCompanion {
  readonly behavior?: "sentry" | "flying" | undefined;
  readonly followHeight?: number | undefined;
  readonly lungeDrop?: number | undefined;
  readonly volleyFrames?: readonly number[] | undefined;
  readonly waveFrame?: number | undefined;
  readonly engage?: number | undefined;
  readonly followSpeed: number;
  readonly followBehind: number;
  readonly returnSpeed: number;
  readonly lungeStartup: number;
  readonly lungeActive: number;
  readonly lungeRecovery: number;
  readonly lungeTravel: number;
  readonly bite: StrikeCapsule;
  readonly biteEffect: HitEffect;
  readonly biteStatus?: AppliedStatus | undefined;
  readonly stunFrames: number;
  readonly leash: number;
  readonly leashFrames: number;
  readonly body?: CompanionBody | undefined;
}

export interface CompanionBody {
  readonly weight: number;
  readonly gravity: number;
  readonly fallSpeed: number;
  readonly hopSpeed: number;
  readonly hopReach: number;
  readonly airJumps: number;
  readonly airDrift: number;
}

export const CompanionOrder = { lunge: 1, return: 2 } as const;
export type CompanionOrder = (typeof CompanionOrder)[keyof typeof CompanionOrder];

export const CompanionMode = { follow: 0, lunge: 1, stunned: 2, returning: 3, vanished: 4 } as const;
export type CompanionMode = (typeof CompanionMode)[keyof typeof CompanionMode];
