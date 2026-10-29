export interface SpecialBeam {
  readonly originX: number;
  readonly originZ: number;
  readonly range: number;
  readonly track: number;
  readonly chain?: true | undefined;
}
