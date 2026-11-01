import type { CueBirth } from "./projectileArt";

export type CueAnchor = "hand" | "body" | "feet" | "ahead" | "behind" | "overhead" | "barrel" | "breath";

export interface Cue {
  readonly model: string;
  readonly anchor: CueAnchor;
  readonly scale: number;
  readonly anchorFrames?: readonly { readonly x: number; readonly z: number }[] | undefined;
  readonly scaleEnd?: number | undefined;
  readonly scaleFrames?: number | undefined;
  readonly birth?: CueBirth | undefined;

  readonly drawn?: boolean | undefined;






  readonly sequence?: string | undefined;
  readonly seconds?: number | undefined;
  readonly pitch?: number | undefined;
  readonly roll?: number | undefined;
  readonly sound?: string | undefined;
  readonly yaw?: number | undefined;
  readonly depth?: number | undefined;
  readonly timeScale?: number | undefined;
  readonly alpha?: number | undefined;
  readonly color?: readonly [number, number, number] | undefined;

  readonly replacesBody?: boolean | undefined;
  readonly rebirthFrames?: number | undefined;
  /** When its move ends early, the cue keeps playing where it stood until this many frames after it first showed (presentation/cueLinger.ts). */
  readonly lingerFrames?: number | undefined;
}

export interface MoveCues {
  readonly spell: string;
  readonly startup: Cue;
  readonly active: Cue;
  /** The fighter's own body tint and alpha while either cue shows. */
  readonly body?: { readonly red: number; readonly green: number; readonly blue: number; readonly alpha: number } | undefined;
  /** The fighter is not drawn while intangible. */
  readonly vanishes?: true | undefined;
  readonly trail?: true | undefined;
}

export interface CueState {
  readonly cues: MoveCues | undefined;
  readonly phase: "none" | "startup" | "active";
}
