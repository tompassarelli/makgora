




export interface Silhouette {
  readonly slot: 0 | 1;
  readonly fighter: string;
  readonly move: string;
  readonly width: number;
  readonly height: number;
  readonly conceal?: "fighter" | "cues";
}

export interface CaptureFixture {
  readonly name: string;
  readonly frames: readonly number[];
  readonly script: string;
  readonly holdTicks?: number;
  readonly openingTicks?: number;
  readonly tailFrames?: number;
  readonly reel?: { readonly fighter: string; readonly row: string; readonly slot: string; readonly facing: "right" | "left" };
  readonly silhouette?: Silhouette;
}

// A hidden capture's stamp names frame + SILHOUETTE_HIDDEN_FRAME, so a pixel stamp tells the pair apart.
export const SILHOUETTE_HIDDEN_FRAME = 16384;

const WALK = "#! chat -dev quick hero rifleman\n40 a stick 1 0\n70 a stick 0 0\n90 b tap X 2\n";
const OTHER = "#! chat -dev quick hero mountain king\n40 b stick -1 0\n70 b stick 0 0\n";

export const CAPTURE_FIXTURES: readonly CaptureFixture[] = [
  { name: "control-walk", frames: [30, 31, 62, 100, 101], script: WALK },
  { name: "control-other", frames: [30, 62, 100], script: OTHER },
  { name: "control-walk-again", frames: [30, 31, 62, 100, 101], script: WALK },
];
