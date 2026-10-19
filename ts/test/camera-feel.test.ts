import { expect, test } from "bun:test";
import { FOUR_PLAYER_CAMERA_SCENARIOS, measureCameraFeel } from "../scripts/cameraFeel";

test("with four fighters the camera zooms no more often or farther than Melee's reference camera on the same paths [k3 measure docs/melee-camera.md]", () => {
  const { ours, melee } = measureCameraFeel(FOUR_PLAYER_CAMERA_SCENARIOS);
  expect(ours.snaps).toBeLessThanOrEqual(melee.snaps);
  expect(ours.zoomTravel).toBeLessThanOrEqual(melee.zoomTravel * 1.05);
  expect(ours.zoom[2]!).toBeLessThanOrEqual(melee.zoom[2]! * 1.05);
}, 300_000);
