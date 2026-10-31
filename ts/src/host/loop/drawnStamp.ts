


import { STAMP_CELL, STAMP_CELLS, type StampCell, stampCells } from "../../game/core/drawnStamp";
import { createBackdrop, gameUi, placeTopLeft } from "../../game/ui/frames";
import { f32 } from "wisp/src/sim/f32";
import { floorMod } from "wisp/src/sim/intMath";
import { Frame, setFrameLevel, setFrameSize, setFrameTexture } from "wisp/game/frames";

const TEXTURES: Readonly<Record<StampCell, string>> = {
  guard: "ReplaceableTextures\\TeamColor\\TeamColor06.blp",
  one: "ReplaceableTextures\\TeamColor\\TeamColor00.blp",
  zero: "ReplaceableTextures\\TeamColor\\TeamColor01.blp",
};

interface Stamp {
  readonly cells: Frame[];
  readonly shown: (StampCell | undefined)[];
}

declare global { var __smashcraftDrawnStamp: Stamp | undefined; }

function stamp(): Stamp {
  const existing = globalThis.__smashcraftDrawnStamp;
  if (existing !== undefined) return existing;
  const cells: Frame[] = [];
  for (let index = 0; index < 2 * STAMP_CELLS; index++) {
    const cell = createBackdrop("SmashcraftDrawnStamp", gameUi(), index);
    setFrameSize(cell, STAMP_CELL, STAMP_CELL);
    placeTopLeft(cell, f32(floorMod(index, STAMP_CELLS) * STAMP_CELL), index < STAMP_CELLS ? f32(0.6) : f32(STAMP_CELL));
    setFrameLevel(cell, 9);
    cells.push(cell);
  }
  const created: Stamp = { cells, shown: cells.map(() => undefined) };
  globalThis.__smashcraftDrawnStamp = created;
  return created;
}


export function paintDrawnStamp(script: number, frame: number): void {
  const { cells, shown } = stamp();
  const kinds = stampCells(script, frame);
  for (let index = 0; index < cells.length; index++) {
    const kind = kinds[floorMod(index, STAMP_CELLS)];
    const cell = cells[index];
    if (kind === undefined || cell === undefined || shown[index] === kind) continue;
    setFrameTexture(cell, TEXTURES[kind], 0, true);
    shown[index] = kind;
  }
}
