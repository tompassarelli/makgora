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
