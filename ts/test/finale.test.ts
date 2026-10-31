import { expect, test } from "bun:test";
import { KO_ZOOM_FRAMES, zoomOntoKo, zoomWeight } from "../src/host/loop/finale";
import { createMatchCamera } from "../src/game/sim/matchCamera";
import { standaloneArguments } from "../scripts/wisp/standalone";

test("the KO zoom starts and ends on the match shot and lasts under a second [k2 property]", () => {
  expect(zoomWeight(0)).toBe(0);
  expect(zoomWeight(KO_ZOOM_FRAMES)).toBe(0);
  expect(KO_ZOOM_FRAMES).toBeLessThan(60);
  const peak = Math.max(...Array.from({ length: KO_ZOOM_FRAMES }, (_, frame) => zoomWeight(frame)));
  expect(peak).toBe(1);
  const camera = createMatchCamera();
  camera.x = 100;
  camera.distance = 1450;
  zoomOntoKo(camera, { x: -300, z: 40 }, 20);
  expect(camera.x).toBe(-300);
  expect(camera.distance).toBe(650);
});

test("--start names where the native window opens [k2 property]", () => {
  expect(standaloneArguments(["--start", "select"], "native").start).toBe("select");
  expect(standaloneArguments([]).start).toBeUndefined();
  expect(() => standaloneArguments(["--start", "title"])).toThrow("--start needs");
});
