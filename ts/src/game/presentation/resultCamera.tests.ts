import { assertEquals, test } from "wisp/src/runtime/testing";
import { createMatchCamera } from "../sim/matchCamera";
import { STAGE_CATALOG } from "../menu/stageCatalog";
import { RESULT_MARGIN, RESULTS_CAMERA_FRAMES, cameraPoint, resultCamera, resultFighterPlacement } from "./arenaCamera";

test("the results camera frames every lined-up fighter with room to spare on every stage and aspect [k2 property]", () => {
  for (const stage of STAGE_CATALOG) for (const aspect of [4.0 / 3.0, 16.0 / 10.0, 16.0 / 9.0, 21.0 / 9.0]) for (const count of [1, 2, 3, 4]) {
    const camera = createMatchCamera();
    for (let frame = 0; frame < RESULTS_CAMERA_FRAMES; frame++) resultCamera(camera, stage.id, aspect, frame, count);
    for (let index = 0; index < count; index++) {
      const { x, z } = resultFighterPlacement(stage.id, index, count);
      const left = cameraPoint(camera, aspect, x - RESULT_MARGIN + 20.0, z).column;
      const right = cameraPoint(camera, aspect, x + RESULT_MARGIN - 20.0, z).column;
      assertEquals(left >= 0.0 && right <= 1.0, true, `${stage.name} ${count} fighters aspect ${aspect}: fighter ${index} spans ${left}..${right}`);
    }
    if (count <= 2) assertEquals(camera.distance, 750.0, `${stage.name} keeps the close results shot for ${count}`);
  }
});
