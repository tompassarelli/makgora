




import { RANDOM_STAGE, STAGE_CHOICES, stageTileIndex, type StageChoice } from "./stageCatalog";
import { f32 } from "wisp/src/sim/f32";
import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import { STAGE_LIST_BOX } from "../core/selectScreenLayout";
export type { StageChoice } from "./stageCatalog";


type StageGesture =

  | { kind: "carry" }

  | { kind: "click"; tile: StageChoice };

interface StageDrag {

  down: boolean;

  gesture: StageGesture | undefined;
}

const CARRY: StageGesture = { kind: "carry" };

const LIST_PAD = f32(0.012);
const HEADING_HEIGHT = f32(0.02);
const HEADING_GAP = f32(0.006);
const TILE_GAP = f32(0.008);
const TILE_COLUMNS = 3;
const TILE_ROWS = floorDiv(STAGE_CHOICES.length + TILE_COLUMNS - 1, TILE_COLUMNS);
const TILE_ASPECT = f32(f32(0.094) / f32(0.059));
const LIST_WIDTH = f32(STAGE_LIST_BOX.width - f32(2 * LIST_PAD));
const LIST_HEIGHT = f32(f32(STAGE_LIST_BOX.height - f32(2 * LIST_PAD)) - f32(HEADING_HEIGHT + HEADING_GAP));
const TILE_HEIGHT = Math.min(
  f32(f32(LIST_HEIGHT - f32((TILE_ROWS - 1) * TILE_GAP)) / TILE_ROWS),
  f32(f32(f32(LIST_WIDTH - f32((TILE_COLUMNS - 1) * TILE_GAP)) / TILE_COLUMNS) / TILE_ASPECT),
);
/** One stage tile's size: the largest that fits the stage list's columns and rows at the stage cards' shape. */
export const STAGE_TILE = { width: f32(TILE_HEIGHT * TILE_ASPECT), height: TILE_HEIGHT } as const;
const GRID_WIDTH = f32(f32(TILE_COLUMNS * STAGE_TILE.width) + f32((TILE_COLUMNS - 1) * TILE_GAP));
const GRID_LEFT = f32(STAGE_LIST_BOX.x + f32(f32(STAGE_LIST_BOX.width - GRID_WIDTH) / 2));
/** The stage list's heading line, above its tiles. */
export const STAGE_LIST_HEADING = { x: f32(STAGE_LIST_BOX.x + LIST_PAD), y: f32(STAGE_LIST_BOX.y - LIST_PAD), width: LIST_WIDTH, height: HEADING_HEIGHT } as const;
const GRID_TOP = f32(f32(STAGE_LIST_HEADING.y - HEADING_HEIGHT) - HEADING_GAP);
const tileIndex = (choice: number): number => choice === RANDOM_STAGE ? 0 : stageTileIndex(choice) + 1;

export function stageTileLeft(choice: number): number {
  return f32(GRID_LEFT + f32(floorMod(tileIndex(choice), TILE_COLUMNS) * f32(STAGE_TILE.width + TILE_GAP)));
}

export function stageTileTop(choice: number): number {
  return f32(GRID_TOP - f32(floorDiv(tileIndex(choice), TILE_COLUMNS) * f32(STAGE_TILE.height + TILE_GAP)));
}

export function stageTileAt(x: number, y: number): StageChoice | undefined {
  for (const stage of STAGE_CHOICES) {
    const left = stageTileLeft(stage.id);
    const top = stageTileTop(stage.id);
    if (x >= left && x <= f32(left + STAGE_TILE.width) && y <= top && y >= f32(top - STAGE_TILE.height)) return stage.id;
  }
  return undefined;
}


function onStageChip(choice: number, x: number, y: number): boolean {
  const dx = x - f32(stageTileLeft(choice) + f32(STAGE_TILE.width / 2));
  const dy = y - f32(stageTileTop(choice) - f32(STAGE_TILE.height / 2));
  return dx * dx + dy * dy <= 0.00039999998989515007;
}

export function stageDrag(): StageDrag {
  return { down: false, gesture: undefined };
}


export function clearStageDrag(drag: StageDrag): void {
  drag.down = false;
  drag.gesture = undefined;
}


export function updateStageDrag(drag: StageDrag, down: boolean, x: number, y: number, choice: number): StageChoice | undefined {
  let chosen: StageChoice | undefined;
  if (down && !drag.down) {
    const tile = stageTileAt(x, y);
    drag.gesture = onStageChip(choice, x, y) ? CARRY : tile === undefined ? undefined : { kind: "click", tile };
  } else if (!down && drag.down) {
    const tile = stageTileAt(x, y);
    const { gesture } = drag;
    if (gesture?.kind === "carry" || (gesture?.kind === "click" && gesture.tile === tile)) chosen = tile;
    drag.gesture = undefined;
  }
  drag.down = down;
  return chosen;
}
