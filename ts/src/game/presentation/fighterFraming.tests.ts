import { assertEquals, test } from "wisp/src/runtime/testing";
import { at } from "wisp/src/runtime/lookup";
import { STAGE_CATALOG } from "../menu/stageCatalog";
import "../roster/kits";
import { Character } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { advanceMatchCamera, createMatchCamera, MATCH_CAMERA_ASPECT } from "../sim/matchCamera";
import { createRoster } from "../sim/roster";
import { mainDeckLeft, mainDeckRight, mainDeckZAt } from "../sim/stage";
import { localCamera } from "./arenaCamera";
import { fitFighterFrames } from "./fighterFraming";

const CLOSE_DISTANCE = 1000.0;
const SETTLE_FRAMES = 240;
const PAIRS: readonly (readonly [Character, Character])[] = [
  [Character.butcher, Character.thrall], [Character.demonHunter, Character.uther], [Character.butcher, Character.uther], [Character.demonHunter, Character.thrall],
  [Character.alchemist, Character.alchemist], [Character.alchemist, Character.thrall],
];

function touchingDistance(stage: number, left: Character, right: Character): number {
  const centre = (mainDeckLeft(stage) + mainDeckRight(stage)) / 2.0;
  const a = createFighter(left, centre, 1), b = createFighter(right, centre, -1);
  a.motion.z = mainDeckZAt(stage, centre);
  b.motion.z = a.motion.z;
  const world = createRoster(3, [a, b]);
  const camera = createMatchCamera();
  for (let frame = 0; frame < SETTLE_FRAMES; frame++) advanceMatchCamera(camera, world, stage);
  const view = createMatchCamera();
  localCamera(view, camera, stage, MATCH_CAMERA_ASPECT);
  fitFighterFrames(view, world, stage, MATCH_CAMERA_ASPECT);
  return view.distance;
}

test("two touching fighters at centre stage settle no wider than the close distance, at the same distance on every stage, with the Butcher, Thrall, Illidan, Uther and the Alchemist [k3 measure docs/melee-camera.md]", () => {
  for (const [left, right] of PAIRS) {
    const first = touchingDistance(at(STAGE_CATALOG, 0).id, left, right);
    for (const stage of STAGE_CATALOG) {
      const distance = touchingDistance(stage.id, left, right);
      assertEquals(distance <= CLOSE_DISTANCE, true, `${stage.name} fighters ${left} and ${right}: settled at ${distance}`);
      assertEquals(Math.abs(distance - first) < 1.0, true, `${stage.name} fighters ${left} and ${right}: ${distance} against ${first}`);
    }
  }
});
