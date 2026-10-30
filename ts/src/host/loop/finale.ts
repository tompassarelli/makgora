import { f32 } from "wisp/src/sim/f32";
import type { MatchCamera } from "../../game/sim/matchCamera";

/** The match's closing shots, which read the sim and never write to it: turning one off must leave the state digest untouched. */
export const finale = { koZoom: true, orbit: true, zoomFramesShown: 0, orbitFramesShown: 0 };

export const KO_ZOOM_FRAMES = 45;
const ZOOM_IN_FRAMES = 15;
const ZOOM_OUT_FROM = 30;
const ZOOM_DISTANCE = 650.0;
const ZOOM_TANGENT = 0.2679491937160492;
const ZOOM_LIFT = 60.0;

/** Where the final KO landed: the knocked-out fighter's place on the frame the match ended. */
export interface KoZoom {
  readonly x: number;
  readonly z: number;
}

const smooth = (t: number): number => {
  const clamped = Math.min(1.0, Math.max(0.0, t));
  return clamped * clamped * (3.0 - 2.0 * clamped);
};

/** How far the camera has moved from the match shot to the KO shot `frame` frames after the match ended: in over 15 frames, out over the last 15 of 45. */
export function zoomWeight(frame: number): number {
  return smooth(frame / ZOOM_IN_FRAMES) * (1.0 - smooth((frame - ZOOM_OUT_FROM) / (KO_ZOOM_FRAMES - ZOOM_OUT_FROM)));
}

/** Moves `camera`, already the match's last shot, toward the KO point by `zoomWeight(frame)`. */
export function zoomOntoKo(camera: MatchCamera, zoom: KoZoom, frame: number): void {
  const weight = zoomWeight(frame);
  finale.zoomFramesShown++;
  const goal = { x: zoom.x, z: zoom.z + ZOOM_LIFT, distance: Math.min(camera.distance, ZOOM_DISTANCE), tangent: ZOOM_TANGENT };
  camera.x += (goal.x - camera.x) * weight;
  camera.z += (goal.z - camera.z) * weight;
  camera.distance += (goal.distance - camera.distance) * weight;
  camera.tangent += (goal.tangent - camera.tangent) * weight;
}

export const koZoomActive = (zoom: KoZoom | undefined, frame: number): zoom is KoZoom => finale.koZoom && zoom !== undefined && frame < KO_ZOOM_FRAMES;

export const ORBIT_START_FRAME = 90;
const ORBIT_FRAMES = 300;
const ORBIT_SWEEP_DEGREES = 70.0;
const ORBIT_TILT_DEGREES = 12.0;
const ORBIT_PUSH = f32(0.3);

/** The results camera's heading and tilt. */
export interface OrbitView {
  readonly rotation: number;
  readonly angle: number;
}

/** Sweeps the results camera around the winner from `ORBIT_START_FRAME` on: it slides to the winner, pushes in, swings its heading by 70 degrees and tilts down 12. */
export function orbitWinner(camera: MatchCamera, winnerX: number, frame: number, rotation: number, angle: number): OrbitView {
  const progress = finale.orbit ? smooth((frame - ORBIT_START_FRAME) / ORBIT_FRAMES) : 0.0;
  if (progress > 0.0) finale.orbitFramesShown++;
  camera.x += (winnerX - camera.x) * progress;
  camera.distance *= 1.0 - ORBIT_PUSH * progress;
  return { rotation: rotation + ORBIT_SWEEP_DEGREES * progress, angle: angle - ORBIT_TILT_DEGREES * progress };
}
