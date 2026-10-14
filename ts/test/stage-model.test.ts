import { expect, test } from "bun:test";
import { modelReach } from "wisp/scripts/wisp/models";
import { MODEL_FACTS } from "../scripts/wisp/modelFacts";
import { STAGE_CATALOG } from "../src/game/menu/stageCatalog";
import { ARENA_CAMERA, ARENA_FOG_FAR_MARGIN, arenaDepthOffset, arenaFogOffset, arenaFogEnd, arenaFarZ, extremeCamera, finalCamera } from "../src/game/presentation/arenaCamera";
import { placedPieces } from "../src/game/presentation/stageScenery";
import { stageBounds } from "../src/game/sim/stageBounds";
import { createMatchCamera } from "../src/game/sim/matchCamera";
import { MAIN_DECK_HALF_DEPTH, type DeckFace, type OutlinePoint, mainDeckFaces } from "../scripts/stageDeck";
import { STAGE_DECK_PALETTES } from "../src/game/assets/stagePalette";
import { MAIN_DECK_BODY_SURFACES, mainDeckLeft, mainDeckRight, mainDeckZ, solidSurfaceAt, solidSurfaceCount, surfaceLine } from "../src/game/sim/stage";


const SHIPPED_STAGES = [1, ...STAGE_DECK_PALETTES.map(({ stage }) => stage).filter((stage) => solidSurfaceCount(stage) > 0)];


function collisionCorners(stage: number): OutlinePoint[] {
  const left = mainDeckLeft(stage);
  const center = (left + mainDeckRight(stage)) / 2;
  const floor = mainDeckZ(stage);
  const walkingLine = surfaceLine(stage, 0);
  const corners: OutlinePoint[] = walkingLine === undefined
    ? [[left - center, 0]]
    : walkingLine.xs.slice(0, -1).map((x, index) => [x - center, (walkingLine.zs[index] ?? Number.NaN) - floor]);
  for (let index = 0; index < MAIN_DECK_BODY_SURFACES; index++) {
    const line = solidSurfaceAt(stage, index);
    corners.push([line.startX - center, line.startZ - floor]);
  }
  return corners;
}

const key = ([x, z]: OutlinePoint) => `${x},${z}`;






function frontOutline(faces: readonly DeckFace[], start: OutlinePoint): OutlinePoint[] {
  const edges = new Map<string, { readonly from: OutlinePoint; readonly to: OutlinePoint }>();
  for (const { normal, corners } of faces) {
    if (normal[0] !== 0 || normal[1] !== -1 || normal[2] !== 0) continue;
    corners.forEach(([x, , z], index) => {
      const next = corners[(index + 1) % corners.length] ?? corners[0];
      if (next === undefined) return;
      const from: OutlinePoint = [x, z];
      const to: OutlinePoint = [next[0], next[2]];
      const reverse = `${key(to)}>${key(from)}`;
      if (edges.has(reverse)) edges.delete(reverse);
      else edges.set(`${key(from)}>${key(to)}`, { from, to });
    });
  }

  const after = new Map([...edges.values()].map(({ from, to }) => [key(to), from]));
  const points: OutlinePoint[] = [start];
  for (let point = after.get(key(start)); point !== undefined && key(point) !== key(start); point = after.get(key(point))) {
    if (points.length > edges.size) throw new Error("the front faces' outline does not close");
    points.push(point);
  }
  return points.filter((point, index) => {
    const before = points[(index + points.length - 1) % points.length] ?? point;
    const next = points[(index + 1) % points.length] ?? point;
    const turn = (point[0] - before[0]) * (next[1] - point[1]) - (point[1] - before[1]) * (next[0] - point[0]);
    return Math.abs(turn) > 1e-6 * Math.hypot(point[0] - before[0], point[1] - before[1]) * Math.hypot(next[0] - point[0], next[1] - point[1]);
  });
}


const area = (points: readonly OutlinePoint[]) => Math.abs(points.reduce((sum, [x, z], index) => {
  const [nextX, nextZ] = points[(index + 1) % points.length] ?? [x, z];
  return sum + x * nextZ - nextX * z;
}, 0)) / 2;

test("the main deck model's outline is the main deck's collision lines on every shipped stage [k2 property]", () => {
  for (const stage of SHIPPED_STAGES) {
    const corners = collisionCorners(stage);
    const [ledge] = corners;
    if (ledge === undefined) throw new Error(`stage ${stage} has no main deck`);
    const faces = mainDeckFaces(stage);
    const outline = frontOutline(faces, ledge);
    expect(outline.length).toBe(corners.length);
    outline.forEach(([x, z], index) => {
      expect(x).toBeCloseTo(corners[index]?.[0] ?? Number.NaN, 3);
      expect(z).toBeCloseTo(corners[index]?.[1] ?? Number.NaN, 3);
    });

    const fronts = faces.filter(({ normal }) => normal[1] === -1).map(({ corners: points }) => points.map(([x, , z]): OutlinePoint => [x, z]));
    expect(fronts.reduce((sum, face) => sum + area(face), 0)).toBeCloseTo(area(corners), 2);

    for (let index = 0; index < MAIN_DECK_BODY_SURFACES; index++) {
      const line = solidSurfaceAt(stage, index);
      const center = (mainDeckLeft(stage) + mainDeckRight(stage)) / 2;
      const floor = mainDeckZ(stage);
      const front = [[line.startX - center, -MAIN_DECK_HALF_DEPTH, line.startZ - floor], [line.endX - center, -MAIN_DECK_HALF_DEPTH, line.endZ - floor]];
      const side = faces.find(({ corners: points }) => JSON.stringify(points.slice(0, 2)) === JSON.stringify(front));
      expect(side?.normal).toEqual([line.normalX, 0, line.normalZ]);
      expect(side?.corners.map(([, y]) => y)).toEqual([-MAIN_DECK_HALF_DEPTH, -MAIN_DECK_HALF_DEPTH, MAIN_DECK_HALF_DEPTH, MAIN_DECK_HALF_DEPTH]);
    }
  }
});


test("each stage keeps scenery visible through fog and farZ throughout player zoom with the #456 margin [k3 measure #456]", () => {
  const pitch = (ARENA_CAMERA.angleOfAttack - 360) * Math.PI / 180;
  const yaw = ARENA_CAMERA.rotation * Math.PI / 180;
  for (const { id, name } of STAGE_CATALOG) {
    for (const aspect of [16 / 9, 64 / 27]) {
      const camera = createMatchCamera();
      const near = createMatchCamera();
      extremeCamera(near, id, aspect, "near");
      finalCamera(near, id);
      const far = createMatchCamera();
      extremeCamera(far, id, aspect, "far");
      finalCamera(far, id);
      const region = stageBounds(id).camera;
      for (let zoom = 0; zoom <= 32; zoom++) {
        const fraction = zoom / 32;
        camera.distance = 498 + (Math.max(near.distance, far.distance) - 498) * fraction;
        camera.z = region.bottom + (region.top - region.bottom) * fraction;
        const farZ = arenaFarZ(id, camera);
        const fogEnd = arenaFogEnd(id);
        expect(farZ, name).toBeGreaterThanOrEqual(fogEnd + ARENA_FOG_FAR_MARGIN - 0.001);
        const offset = camera.distance - camera.z * Math.sin(pitch);
        expect(arenaDepthOffset(camera), `${name}: fog camera reference`).toBeCloseTo(offset, 3);
        expect(arenaFogOffset(id), `${name}: shared fog covers player zoom`).toBeGreaterThanOrEqual(offset);
        for (const piece of placedPieces(id)) {
          const facts = MODEL_FACTS[piece.model];
          if (facts === undefined) throw new Error(`${name}: missing facts for ${piece.model}`);
          if (facts.triangles > 0 && facts.bounds === undefined) throw new Error(`${name}: missing mesh bounds for ${piece.model}`);
          const reach = modelReach(facts);
          expect(reach.unknown, `${name}: ${piece.model}`).toEqual([]);
          const boxes = reach.boxes.length > 0 ? reach.boxes : [{ min: [0, 0, 0] as const, max: [0, 0, 0] as const }];
          const turn = piece.yaw * Math.PI / 180;
          const [sx, sy, sz] = piece.matrixScale ?? [1, 1, 1];
          for (const bounds of boxes) for (const x of [bounds.min[0], bounds.max[0]]) for (const y of [bounds.min[1], bounds.max[1]]) for (const z of [bounds.min[2], bounds.max[2]]) {
            const worldX = piece.x + piece.scale * (x * sx * Math.cos(turn) - y * sy * Math.sin(turn));
            const worldY = piece.y + piece.scale * (x * sx * Math.sin(turn) + y * sy * Math.cos(turn));
            const worldZ = piece.z + piece.scale * z * sz;
            const depth = camera.distance + (worldX - camera.x) * Math.cos(pitch) * Math.cos(yaw) + worldY * Math.cos(pitch) * Math.sin(yaw) + (worldZ - camera.z) * Math.sin(pitch);
            expect(depth, `${name} ${aspect} zoom ${zoom}: ${piece.model}`).toBeLessThanOrEqual(farZ);
            expect(depth, `${name} ${aspect} zoom ${zoom}: fully fogged ${piece.model}`).toBeLessThan(fogEnd);
          }
        }
      }
    }
  }
});
