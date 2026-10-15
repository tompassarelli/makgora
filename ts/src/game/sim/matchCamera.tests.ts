import { assertEquals, test } from "wisp/src/runtime/testing";
import { Character } from "./codes";
import { createFighter } from "./fighter";
import { advanceMatchCamera, createMatchCamera } from "./matchCamera";
import { createRoster } from "./roster";

const SMALLEST_NORMAL = 1.1754943508222875e-38;

test("the match camera easing toward centred fighters comes to rest without a subnormal x, which Warcraft flushes to zero, as natively in smashcraft#25 [k4 reference native]", () => {
  const world = createRoster(3, [createFighter(Character.blademaster, -240.0, 1), createFighter(Character.mountainKing, 240.0, -1)]);
  const camera = createMatchCamera();
  advanceMatchCamera(camera, world, 0);
  camera.x = 30.0;
  let previous = camera.x;
  let still = 0;
  for (let frame = 0; frame < 3000 && still < 60; frame++) {
    advanceMatchCamera(camera, world, 0);
    const x = camera.x;
    assertEquals(x === 0 || x >= SMALLEST_NORMAL || x <= -SMALLEST_NORMAL, true, `frame ${frame}: camera x ${x} is subnormal`);
    still = x === previous ? still + 1 : 0;
    previous = x;
  }
  assertEquals(still >= 60, true, `camera x never came to rest: ${camera.x}`);
});
