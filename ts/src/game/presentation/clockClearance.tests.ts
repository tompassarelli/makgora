import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { STAGE_CATALOG } from "../menu/stageCatalog";
import { copyMatchCamera, createMatchCamera, type MatchCamera } from "../sim/matchCamera";
import { NORDRASSIL_TOP_PLATFORM_Z, WIND_TEST_STAGE } from "../sim/stage";
import { cameraPoint, finalCamera } from "./arenaCamera";

const CLOCK_BOTTOM_ROW = f32(0.11);
const ASPECT = 16.0 / 9.0;

function matchShot(distance: number, tangent: number, z: number): MatchCamera {
  const camera = createMatchCamera();
  camera.distance = distance;
  camera.tangent = tangent;
  camera.z = z;
  return camera;
}

test("Nordrassil's top platform is framed below the match clock at every match zoom and camera height, as is a camera already above it left alone [k1 scenario]", () => {
  for (const distance of [900.0, 1100.0, 1450.0, 2400.0, 5000.0]) {
    for (const tangent of [0.2679491937160492, 0.3443276286125183]) {
      for (const z of [-200.0, 0.0, 160.0, 400.0, 800.0]) {
        const camera = matchShot(distance, tangent, z);
        finalCamera(camera, WIND_TEST_STAGE);
        assertTrue(camera.z >= z);
        assertTrue(cameraPoint(camera, ASPECT, 0.0, NORDRASSIL_TOP_PLATFORM_Z).row >= CLOCK_BOTTOM_ROW);
      }
    }
  }
});

test("No stage other than Nordrassil and the Tomb of Sargeras moves the camera in the final framing [k1 scenario]", () => {
  for (const stage of STAGE_CATALOG) {
    if (stage.id === WIND_TEST_STAGE || stage.name === "Tomb of Sargeras") continue;
    const camera = matchShot(1100.0, 0.3443276286125183, 0.0);
    const before = createMatchCamera();
    copyMatchCamera(before, camera);
    finalCamera(camera, stage.id);
    assertEquals(camera.z, before.z, stage.name);
    assertEquals(camera.distance, before.distance, stage.name);
  }
});
