export interface SpecialSteer {
  readonly launchSpeed: number;
  readonly speed: number;
  readonly acceleration: number;
  readonly turnCos: number;
  readonly turnSin: number;
}

export interface SpecialSteeredShot {
  readonly frame: number;
  readonly turnCos: number;
  readonly turnSin: number;
  readonly coast: number;
  readonly fallSpeed: number;
  readonly hitRecovery: number;
  readonly selfHit?: SpecialSelfHit | undefined;
}

/** The shot, once it has flown `armedAfter` frames, strikes its own caster inside `radius` of a point `bodyZ` above his feet; he flies off along its heading as the move's first follow-up. */
export interface SpecialSelfHit {
  readonly armedAfter: number;
  readonly radius: number;
  readonly bodyZ: number;
}
