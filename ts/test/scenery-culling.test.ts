import { expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { install, start } from "../src/host/entries/devMain";
import { STAGE_CATALOG } from "../src/game/menu/stageCatalog";
import { ARENA_CAMERA, arenaFarZ, extremeCamera, finalCamera } from "../src/game/presentation/arenaCamera";
import { drawnScale, lavaPiece, placedPieces } from "../src/game/presentation/stageScenery";
import { createMatchCamera } from "../src/game/sim/matchCamera";
import { stageBounds } from "../src/game/sim/stageBounds";
import { sweep } from "./sweep";

test("every stage piece keeps its authored size while its matrix scale stays within the scale Warcraft culls by [k2 property]", () => {
  for (const { id, name } of STAGE_CATALOG) for (const piece of [...placedPieces(id), lavaPiece(-1), lavaPiece(1)]) {
    const drawn = drawnScale(piece);
    const authored = piece.matrixScale ?? [1, 1, 1];
    const matrix = drawn.matrixScale ?? [1, 1, 1];
    for (let axis = 0; axis < 3; axis++) {
      expect(Math.abs(matrix[axis]!), `${name}: ${piece.model}`).toBeLessThanOrEqual(1);
      const size = drawn.scale * matrix[axis]!, want = piece.scale * authored[axis]!;
      expect(Math.abs(size - want), `${name}: ${piece.model} axis ${axis}`).toBeLessThanOrEqual(Math.abs(want) * 1e-6);
    }
  }
});

function expectDrawnWithinCullScale(id: number, name: string): void {
  const runtime = installHeadless(SMASHCRAFT_HEADLESS);
  try {
    const clients = runtime.clients({ install, start }, [0], { keepCalls: 0 });
    clients.start();
    clients.frames(20);
    clients.chat(0, `-dev quick stage ${id}`);
    clients.frames(40);
    const models = new Set(placedPieces(id).map(piece => piece.model));
    const scenery = clients.client(0).effectPoses({ visibleOnly: true }).filter(effect => models.has(effect.model) && effect.destroyed === undefined);
    expect(scenery.length, name).toBeGreaterThan(0);
    for (const effect of scenery) for (const axis of effect.matrixScale) expect(Math.abs(axis), `${name}: ${effect.model}`).toBeLessThanOrEqual(1);
    expect(clients.client(0).errors, name).toEqual([]);
  } finally {
    runtime.restore();
  }
}

test("Gryphon Aerie draws its stretched granite with no matrix scale past 1, so the camera's zoom never culls a crag whose origin leaves the view [k1 scenario]", () => {
  expectDrawnWithinCullScale(11, "Gryphon Aerie");
});

sweep("every stage draws its scenery with no matrix scale past 1 [k1 scenario]", () => {
  for (const { id, name } of STAGE_CATALOG) expectDrawnWithinCullScale(id, name);
});

test("every stage piece's origin stays nearer the eye than the camera's far clip across the whole zoom range, so none pops at the far cull [k2 property]", () => {
  const pitch = (ARENA_CAMERA.angleOfAttack - 360) * Math.PI / 180;
  const yaw = ARENA_CAMERA.rotation * Math.PI / 180;
  const forward = [Math.cos(pitch) * Math.cos(yaw), Math.cos(pitch) * Math.sin(yaw), Math.sin(pitch)] as const;
  for (const { id, name } of STAGE_CATALOG) for (const aspect of [16 / 9, 64 / 27]) {
    const near = createMatchCamera();
    extremeCamera(near, id, aspect, "near");
    finalCamera(near, id);
    const far = createMatchCamera();
    extremeCamera(far, id, aspect, "far");
    finalCamera(far, id);
    const region = stageBounds(id).camera;
    const camera = createMatchCamera();
    for (let zoom = 0; zoom <= 32; zoom++) for (const x of [region.left, 0, region.right]) {
      const fraction = zoom / 32;
      camera.distance = 498 + (Math.max(near.distance, far.distance) - 498) * fraction;
      camera.z = region.bottom + (region.top - region.bottom) * fraction;
      camera.x = x;
      const eye = [camera.x - camera.distance * forward[0], -camera.distance * forward[1], camera.z - camera.distance * forward[2]] as const;
      const farZ = arenaFarZ(id, camera);
      for (const piece of placedPieces(id)) {
        const distance = Math.hypot(piece.x - eye[0], piece.y - eye[1], piece.z - eye[2]);
        expect(distance, `${name} ${aspect} zoom ${zoom} x ${x}: ${piece.model} at ${piece.x}, ${piece.y}`).toBeLessThan(farZ);
      }
    }
  }
});
