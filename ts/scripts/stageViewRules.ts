import { modelReach } from "wisp/scripts/wisp/models";
import { boxSeen } from "wisp/scripts/wisp/visibility";
import { arenaFarZ, PLAYABLE_BOUNDS, WORLD_BOUNDS, cameraRay, extremeCamera } from "../src/game/presentation/arenaCamera";
import { isStructure } from "../src/game/presentation/stageRules";
import { hiddenBelow, type SceneryPiece, type StageScenery } from "../src/game/presentation/stageScenery";
import { MAIN_DECK_BODY_SURFACES, solidSurfaceAt } from "../src/game/sim/stage";
import { stageBounds } from "../src/game/sim/stageBounds";
import { MATCH_CAMERA_ASPECT, createMatchCamera } from "../src/game/sim/matchCamera";
import { MODEL_FACTS } from "./wisp/modelFacts";
import { SMASHCRAFT_SCENE } from "./wisp/playerView";
import { MAIN_DECK_HALF_DEPTH, mainDeckOutlineStage } from "./stageDeck";

type Box = { readonly min: readonly [number, number, number]; readonly max: readonly [number, number, number] };

export const TEMPLE_OF_TIDES = "Buildings\\Naga\\TempleOfTides\\TempleOfTides.mdx";

export const STAND_BOUNDS: Readonly<Record<string, Box>> = {
  [TEMPLE_OF_TIDES]: { min: [-180.0, -170.0, -91.0], max: [176.0, 183.0, 374.0] },
};

export function insideWorld(x: number, y: number): boolean {
  const nativeY = y + PLAYABLE_BOUNDS.centreY;
  return x >= WORLD_BOUNDS.left && x <= WORLD_BOUNDS.right && nativeY >= WORLD_BOUNDS.front && nativeY <= WORLD_BOUNDS.back;
}

export function worldProblems(name: string, origin: { readonly x: number; readonly y: number }, pieces: readonly SceneryPiece[]): readonly string[] {
  return pieces.filter(piece => !insideWorld(origin.x + piece.x, origin.y + piece.y)).map(piece => `${name}: ${piece.model} stands outside the world bounds`);
}

export function behindProblems(stage: number, name: string, scenery: Pick<StageScenery, "fog" | "pieces">): readonly string[] {
  const visibility = SMASHCRAFT_SCENE.visibility;
  if (visibility === undefined) throw new Error("missing visibility");
  const problems: string[] = [];
  const corners = (box: { min: readonly [number, number, number]; max: readonly [number, number, number] }) =>
    [box.min[0], box.max[0]].flatMap(x => [box.min[1], box.max[1]].flatMap(y => [box.min[2], box.max[2]].map(z => [x, y, z] as const)));
  const radians = (degrees: number) => degrees * Math.PI / 180;
  for (const camera of visibility.cameras) {
    const pitch = radians(camera.angleOfAttack > 180 ? camera.angleOfAttack - 360 : camera.angleOfAttack);
    const yaw = radians(camera.rotation);
    const forward = [Math.cos(pitch) * Math.cos(yaw), Math.cos(pitch) * Math.sin(yaw), Math.sin(pitch)] as const;
    const along = ([x, y, z]: readonly [number, number, number]) => x * forward[0] + y * forward[1] + z * forward[2];
    const blast = stageBounds(stage).blast;
    const fight = { min: [blast.left - 200, -200, blast.bottom - 200], max: [blast.right + 200, 200, blast.top + 200] } as const;
    const farthestFighter = Math.max(...corners(fight).map(along));
    const [tx, ty, tz] = camera.target;
    const eye = [tx - camera.distance * forward[0], ty - camera.distance * forward[1], tz - camera.distance * forward[2]] as const;
    if (scenery.fog !== undefined && !(farthestFighter - along(eye) < scenery.fog.start)) problems.push(`${name}: fog starts inside the fight`);
    for (const piece of scenery.pieces) {
      const turn = radians(piece.yaw);
      const turned = (x: number, y: number) => [x * Math.cos(turn) - y * Math.sin(turn), x * Math.sin(turn) + y * Math.cos(turn)] as const;
      const facts = MODEL_FACTS[piece.model];
      if (facts === undefined) throw new Error(`missing facts for ${piece.model}`);
      const reach = modelReach(facts);
      if (reach.unknown.length > 0) problems.push(`${name}: ${piece.model} has unknown reach ${reach.unknown.join(", ")}`);
      for (const box of reach.boxes) {
        const flat = [box.min[0], box.max[0]].flatMap(x => [box.min[1], box.max[1]].map(y => turned(x, y)));
        const placed = {
          min: [Math.min(...flat.map(p => p[0])) * piece.scale + piece.x, Math.min(...flat.map(p => p[1])) * piece.scale + piece.y, box.min[2] * piece.scale + piece.z] as const,
          max: [Math.max(...flat.map(p => p[0])) * piece.scale + piece.x, Math.max(...flat.map(p => p[1])) * piece.scale + piece.y, box.max[2] * piece.scale + piece.z] as const,
        };
        if (boxSeen(placed, camera) && Math.min(...corners(placed).map(along)) <= farthestFighter) problems.push(`${name}: ${piece.model} stands in front of the fight`);
      }
    }
  }
  return [...new Set(problems)];
}

export function floatingProblems(stage: number, name: string, pieces: readonly SceneryPiece[]): readonly string[] {
  const tilt = (10 * Math.PI) / 180;
  const problems: string[] = [];
  const placed = pieces.flatMap((piece) => {
    const bounds = STAND_BOUNDS[piece.model] ?? MODEL_FACTS[piece.model]?.bounds;
    if (bounds === undefined) return [];
    const turn = (piece.yaw * Math.PI) / 180;
    const flat = [bounds.min[0], bounds.max[0]].flatMap(x => [bounds.min[1], bounds.max[1]].map(y => [x * Math.cos(turn) - y * Math.sin(turn), x * Math.sin(turn) + y * Math.cos(turn)] as const));
    const stretch = (piece.matrixScale?.[2] ?? 1) * piece.scale;
    return [{
      model: piece.model,
      left: Math.min(...flat.map(p => p[0])) * piece.scale + piece.x, right: Math.max(...flat.map(p => p[0])) * piece.scale + piece.x,
      front: Math.min(...flat.map(p => p[1])) * piece.scale + piece.y,
      bottom: bounds.min[2] * stretch + piece.z, top: bounds.max[2] * stretch + piece.z,
    }];
  });
  for (const extreme of ["near", "far"] as const) {
    const camera = createMatchCamera();
    extremeCamera(camera, stage, MATCH_CAMERA_ASPECT, extreme);
    const depth = (y: number, z: number) => camera.distance + y * Math.cos(tilt) - (z - camera.z) * Math.sin(tilt);
    const project = (x: number, y: number, z: number) => [
      0.5 + (x - camera.x) / (2 * depth(y, z) * camera.tangent * MATCH_CAMERA_ASPECT),
      0.5 - (y * Math.sin(tilt) + (z - camera.z) * Math.cos(tilt)) / (2 * depth(y, z) * camera.tangent),
    ] as const;
    const deck = Array.from({ length: MAIN_DECK_BODY_SURFACES }, (_, index) => solidSurfaceAt(mainDeckOutlineStage(stage), index)).map(line => project(line.startX, -MAIN_DECK_HALF_DEPTH, line.startZ));
    const behindDeck = ([column, row]: readonly [number, number]) => deck.reduce((inside, [x1, y1], index) => {
      const [x2, y2] = deck.at(index - 1) ?? [x1, y1];
      return (y1 > row) !== (y2 > row) && column < ((x2 - x1) * (row - y1)) / (y2 - y1) + x1 ? !inside : inside;
    }, false);
    for (const piece of placed) {
      const surface = hiddenBelow(stage);
      if (surface !== undefined && piece.bottom < surface) continue;
      const shown = Array.from({ length: 21 }, (_, step) => piece.left + ((piece.right - piece.left) * step) / 20).filter((x) => {
        if (depth(piece.front, piece.bottom) > arenaFarZ(stage, camera)) return false;
        const at = project(x, piece.front, piece.bottom);
        if (at[0] < 0 || at[0] > 1 || at[1] < 0 || at[1] > 1 || behindDeck(at)) return false;
        return !placed.some((other) => other !== piece && other.front <= piece.front && x >= other.left && x <= other.right && piece.bottom >= other.bottom && piece.bottom <= other.top);
      });
      if (shown.length > 0) problems.push(`${name} ${extreme}: ${piece.model} base at z ${Math.round(piece.bottom)}`);
    }
  }
  return problems;
}

// Vertex bounds of the Reforged (_hd.w3mod, build 3.0.1.24371) models of Hellfire, which draw 1.5 to 2 times the Classic size; Classic facts under-size them.
export const REFORGED_BOUNDS: Readonly<Record<string, Box>> = {
  "buildings\\demon\\DemonGate\\DemonGate.mdx": { min: [-242.0, -275.0, -141.0], max: [283.0, 293.0, 521.0] },
  "Doodads\\Outland\\Rocks\\Outland_Rock\\Outland_Rock5.mdx": { min: [-64.0, -78.0, -5.0], max: [68.0, 67.0, 113.0] },
  "Doodads\\Outland\\Rocks\\Outland_Spires\\Outland_Spires7.mdx": { min: [-204.0, -206.0, -2.0], max: [200.0, 195.0, 463.0] },
  "Doodads\\Outland\\Structures\\Outland_RockArch\\Outland_RockArch.mdx": { min: [-130.0, -456.0, -308.0], max: [107.0, 472.0, 394.0] },
};

function screenBox(camera: Parameters<typeof cameraRay>[0], piece: SceneryPiece, box: Box): { readonly left: number; readonly right: number; readonly top: number; readonly bottom: number } {
  const [mx, my, mz] = piece.matrixScale ?? [1, 1, 1];
  const turn = (piece.yaw * Math.PI) / 180;
  const columns: number[] = [], rows: number[] = [];
  for (const x of [box.min[0] * mx, box.max[0] * mx]) for (const y of [box.min[1] * my, box.max[1] * my]) for (const z of [box.min[2] * mz, box.max[2] * mz]) {
    const ray = cameraRay(camera, (x * Math.cos(turn) - y * Math.sin(turn)) * piece.scale + piece.x, (x * Math.sin(turn) + y * Math.cos(turn)) * piece.scale + piece.y, z * piece.scale + piece.z);
    columns.push(0.5 + ray.across / (2 * camera.tangent * MATCH_CAMERA_ASPECT));
    rows.push(0.5 - ray.up / (2 * camera.tangent));
  }
  return { left: Math.min(...columns), right: Math.max(...columns), top: Math.min(...rows), bottom: Math.max(...rows) };
}

export function clearingProblems(stage: number, name: string, pieces: readonly SceneryPiece[]): readonly string[] {
  const landmark = pieces.find(piece => isStructure(piece.model));
  const own = landmark === undefined ? undefined : REFORGED_BOUNDS[landmark.model];
  if (landmark === undefined || own === undefined) return [];
  const problems: string[] = [];
  for (const extreme of ["near", "far"] as const) {
    const camera = createMatchCamera();
    extremeCamera(camera, stage, MATCH_CAMERA_ASPECT, extreme);
    const shown = screenBox(camera, landmark, own);
    for (const piece of pieces) {
      const box = REFORGED_BOUNDS[piece.model] ?? MODEL_FACTS[piece.model]?.bounds;
      if (piece === landmark || box === undefined || piece.y >= landmark.y) continue;
      const covers = screenBox(camera, piece, box);
      if (Math.min(shown.right, covers.right) > Math.max(shown.left, covers.left) && Math.min(shown.bottom, covers.bottom) > Math.max(shown.top, covers.top)) problems.push(`${name} ${extreme}: ${piece.model} at x ${piece.x}, y ${piece.y} covers the landmark ${landmark.model} in Reforged`);
    }
  }
  return problems;
}
