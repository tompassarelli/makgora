import { expect, test } from "bun:test";
import { KO_ZOOM_FRAMES, ORBIT_START_FRAME, finale, orbitWinner, zoomOntoKo, zoomWeight } from "../src/host/loop/finale";
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

test("the results orbit waits for its start frame, then swings the heading and tilts down [k2 property]", () => {
  const camera = createMatchCamera();
  camera.x = 0;
  camera.distance = 950;
  expect(orbitWinner(camera, 200, ORBIT_START_FRAME, 90, 350)).toEqual({ rotation: 90, angle: 350 });
  expect(camera.x).toBe(0);
  const end = orbitWinner(camera, 200, ORBIT_START_FRAME + 400, 90, 350);
  expect(end).toEqual({ rotation: 160, angle: 338 });
  expect(camera.x).toBe(200);
  expect(camera.distance).toBeCloseTo(665, 1);
  finale.orbit = false;
  const off = createMatchCamera();
  expect(orbitWinner(off, 200, ORBIT_START_FRAME + 400, 90, 350)).toEqual({ rotation: 90, angle: 350 });
  finale.orbit = true;
});

test("--start names where the native window opens [k2 property]", () => {
  expect(standaloneArguments(["--start", "select"], "native").start).toBe("select");
  expect(standaloneArguments([]).start).toBeUndefined();
  expect(() => standaloneArguments(["--start", "title"])).toThrow("--start needs");
});
