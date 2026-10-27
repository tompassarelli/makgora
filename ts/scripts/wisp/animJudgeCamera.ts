import { JUDGE_PART_TILES } from "./animJudgeStrip";
import { createMatchCamera, type MatchCamera } from "../../src/game/sim/matchCamera";
import type { ScoreFrame } from "./animScore";
import type { SampledCue } from "./animScoreSample";

const CUE_REACH = 40;

const CAMERA_SLACK_PIXELS = 50;
const FRAME_WIDTH = 1920;
const FRAME_HEIGHT = 1080;
const PITCH_COS = 0.9848077297210693;
const MARGIN_PIXELS = 24;

export const CAMERA_LIFT = 90;

export const JUDGE_CAMERA = { distance: 917.6737060546875, tangent: 0.34432750940322876 } as const;

export function judgeCamera(): MatchCamera {
  const camera = createMatchCamera();
  camera.x = 0.0;
  camera.distance = JUDGE_CAMERA.distance;
  camera.tangent = JUDGE_CAMERA.tangent;
  return camera;
}

export const judgePixelsPerUnit = (): number => FRAME_HEIGHT / (2 * JUDGE_CAMERA.distance * JUDGE_CAMERA.tangent);

export const judgeFraming = (): string => `${JUDGE_CAMERA.distance}/${JUDGE_CAMERA.tangent}/parts of ${JUDGE_PART_TILES}`;

export const heldOffset = (offsets: readonly number[], index: number, pixelsPerUnit: number) => {
  const slack = CAMERA_SLACK_PIXELS / pixelsPerUnit, at = offsets[index] ?? 0;
  const middle = (Math.min(...offsets, at) + Math.max(...offsets, at)) / 2;
  return Math.min(at + slack, Math.max(at - slack, middle));
};

export function judgeCrop(frames: readonly (ScoreFrame | undefined)[], heights: readonly number[], travels: readonly number[], pixelsPerUnit: number, cues: readonly (readonly SampledCue[])[] = []): { readonly width: number; readonly height: number; readonly x: number; readonly y: number } {
  let left = FRAME_WIDTH, right = 0, top = FRAME_HEIGHT, bottom = 0;
  const include = (index: number, x: number, z: number) => {
    const offset = (heights[index] ?? 0) - heldOffset(heights, index, pixelsPerUnit) - CAMERA_LIFT;
    const shift = (travels[index] ?? 0) - heldOffset(travels, index, pixelsPerUnit);
    const column = FRAME_WIDTH / 2 + (shift + x) * pixelsPerUnit;
    const row = FRAME_HEIGHT / 2 - (offset + z) * pixelsPerUnit * PITCH_COS;
    left = Math.min(left, column);
    right = Math.max(right, column);
    top = Math.min(top, row);
    bottom = Math.max(bottom, row);
  };
  for (const [index, frame] of frames.entries()) {
    if (frame === undefined) continue;
    for (let vertex = 0; vertex < frame.drawn.length; vertex++) if (frame.drawn[vertex] === 1) include(index, frame.vertices[vertex * 2] ?? 0, frame.vertices[vertex * 2 + 1] ?? 0);
  }
  for (const [index, placed] of cues.entries()) for (const cue of placed) {
    const x = cue.x - (travels[index] ?? 0), z = cue.z - (heights[index] ?? 0), reach = CUE_REACH * cue.scale;
    include(index, x - reach, z - reach);
    include(index, x + reach, z + reach);
  }
  const x = Math.max(0, Math.floor(left - MARGIN_PIXELS)), y = Math.max(0, Math.floor(top - MARGIN_PIXELS));
  return { width: Math.min(FRAME_WIDTH, Math.ceil(right + MARGIN_PIXELS)) - x, height: Math.min(FRAME_HEIGHT, Math.ceil(bottom + MARGIN_PIXELS)) - y, x, y };
}

export interface JudgeFacing {
  readonly sign: number;
  readonly yaw: number;
  readonly caption: string;
  readonly pose: (pose: ScoreFrame | undefined) => ScoreFrame | undefined;
  readonly cues: (cues: readonly SampledCue[]) => SampledCue[];
}

const facing = (sign: number): JudgeFacing => ({
  sign,
  yaw: sign < 0 ? Math.PI : 0,
  caption: sign < 0 ? " Here the fighter faces left." : "",
  pose: (pose) => pose && { ...pose, vertices: pose.vertices.map((value, index) => index % 2 === 0 ? sign * value : value) },
  cues: (cues) => cues.map((cue) => ({ ...cue, x: sign * cue.x })),
});

const SIDES: Readonly<Record<string, JudgeFacing>> = { right: facing(1), left: facing(-1) };

export const judgeFacing = (side = "right"): JudgeFacing | undefined => Object.hasOwn(SIDES, side) ? SIDES[side] : undefined;
