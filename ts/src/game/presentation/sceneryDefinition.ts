import type { DriftingPiece } from "./driftingScenery";

export interface SceneryPiece {
  readonly model: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly scale: number;

  readonly yaw: number;
  readonly matrixScale?: readonly [number, number, number];
  readonly color?: readonly [number, number, number];
  readonly flying?: true;
  /** The model plays its floating idle; a still piece holds its first frame so a stacked spire does not bob. */
  readonly still?: true;
  /** The piece plays its Death sequence and holds its end: a brazier stands with its flame out. */
  readonly unlit?: true;
}

/** The native window's painted sky for a stage, which keeps one time of day: the zenith colour, the cloud cover, the sun's (or moon's) place and colour, and how far stars and a horizon glow show. Colours are 0 to 1; the horizon is the fog's colour. */
export interface StageSkyLook {
  readonly zenith: readonly [number, number, number];
  readonly cover: number;
  readonly sunAzimuth: number;
  readonly sunElevation: number;
  readonly sun: readonly [number, number, number];
  readonly stars: number;
  readonly glow: number;
}

export interface StageScenery {
  readonly farZ: number;
  readonly sky: string;
  readonly skyLook?: StageSkyLook;
  readonly pieces: readonly SceneryPiece[];
  readonly drifters?: readonly DriftingPiece[];
  /** The pieces' colour under the stock light, before the stage's mood (sceneryColor). */
  readonly tint?: readonly [number, number, number];
  readonly fog?: { readonly start: number; readonly end: number; readonly red: number; readonly green: number; readonly blue: number };
  /** #360: an opaque full-width surface far below the bottom blast zone; it hides the bases of the pieces that stand in it. */
  readonly floor?: { readonly model: string; readonly z: number; readonly color: readonly [number, number, number] };
  readonly heightFog?: {
    readonly start: number;
    readonly end: number;
    readonly density: number;

    readonly heightStart: number;
    readonly heightEnd: number;
    readonly maxDensity: number;
    readonly drawOverSky: boolean;
  };
}
