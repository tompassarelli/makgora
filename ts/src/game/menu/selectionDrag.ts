



import { f32 } from "wisp/src/sim/f32";
import { floorMod } from "wisp/src/sim/intMath";
import { PARTICIPANT_CAPACITY, participantActive } from "../input/participants";
import { type RosterGrid, type RosterTile, cellRect, nearestTile, tileAt } from "./selectionGrid";

export type { RosterTile };

export interface RosterChip {

  choice: number;

  placed: boolean;
}


export interface Roster {

  grid: RosterGrid;

  selectable: number;

  chips: readonly RosterChip[];
}

export interface SelectionDrag {

  held: number | undefined;

  hover: RosterTile | undefined;

  dragging: number | undefined;

  down: boolean;
}


export interface Placement {
  readonly slot: number;
  readonly tile: RosterTile;
}


export function decodeCpuPlacement(data: string, count: number): Placement | undefined {
  for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) {
    for (let tile = 0; tile < count; tile++) {
      if (data === `${slot}${tile}`) return { slot, tile };
    }
  }
  return undefined;
}


export function chipX(grid: RosterGrid, slot: number, choice: number): number {
  return cellRect(grid, choice).left + (f32(0.004) + floorMod(slot, 2) * f32(0.056)) * grid.scale;
}


export function chipY(grid: RosterGrid, slot: number, choice: number): number {
  return cellRect(grid, choice).top - (slot < 2 ? f32(0.01) : f32(0.066)) * grid.scale;
}

export const readyChipSize = (grid: RosterGrid): number => grid.cellWidth * f32(0.65);

export const CARD_SCALE = f32(0.86);
export const CARD_WIDTH = f32(f32(0.16) * CARD_SCALE);
export const CARD_HEIGHT = f32(f32(0.22) * CARD_SCALE);
export const CARD_TOP = f32(0.198);
const CARD_LEFT = f32(0.046);
const CARD_PITCH = f32(0.19);

export function cardX(slot: number): number {
  return f32(CARD_LEFT + f32(slot * CARD_PITCH));
}

export const cardRight = (slot: number, offset: number): number => f32(cardX(slot) + f32(offset * CARD_SCALE));

export const cardDown = (depth: number): number => f32(CARD_TOP - f32(depth * CARD_SCALE));

export const cardSize = (size: number): number => f32(size * CARD_SCALE);


function onChip(grid: RosterGrid, slot: number, choice: number, x: number, y: number): boolean {
  const radius = readyChipSize(grid) * f32(0.5);
  const dx = x - (chipX(grid, slot, choice) + radius);
  const dy = y - (chipY(grid, slot, choice) - radius);
  return dx * dx + dy * dy <= radius * radius;
}


export function cardSlot(x: number, y: number, selectable: number): number | undefined {
  if (y < cardDown(f32(0.165)) || y > cardDown(f32(0.05))) return undefined;
  for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) {
    const left = cardX(slot);
    if (x >= left && x <= f32(left + CARD_WIDTH) && participantActive(selectable, slot)) return slot;
  }
  return undefined;
}

export function selectionDrag(): SelectionDrag {
  return { held: undefined, hover: undefined, dragging: undefined, down: false };
}


export function clearSelectionDrag(drag: SelectionDrag): void {
  drag.held = undefined;
  drag.hover = undefined;
  drag.dragging = undefined;
  drag.down = false;
}






function pickUp(drag: SelectionDrag, { grid, selectable, chips }: Readonly<Roster>, x: number, y: number): number | undefined {
  let picked = cardSlot(x, y, selectable);
  if (picked === undefined) {
    for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) {
      const chip = chips[slot];
      if (chip?.placed === true && participantActive(selectable, slot) && onChip(grid, slot, chip.choice, x, y)) picked = slot;
    }
  }
  if (picked !== undefined) drag.held = picked;
  return picked ?? (drag.hover === undefined ? undefined : drag.held);
}


export function updateSelectionDrag(drag: SelectionDrag, roster: Readonly<Roster>, down: boolean, x: number, y: number): Placement | undefined {

  if (drag.held !== undefined && !participantActive(roster.selectable, drag.held)) drag.held = undefined;
  if (drag.dragging !== undefined && !participantActive(roster.selectable, drag.dragging)) drag.dragging = undefined;
  drag.hover = tileAt(roster.grid, x, y);
  let placement: Placement | undefined;
  if (down && !drag.down) {
    drag.dragging = pickUp(drag, roster, x, y);
  } else if (!down && drag.down) {
    const tile = nearestTile(roster.grid, x, y);
    if (drag.dragging !== undefined && tile !== undefined) placement = { slot: drag.dragging, tile };
    drag.dragging = undefined;
  }
  drag.down = down;
  return placement;
}


export function placeHovered({ held, hover }: Readonly<SelectionDrag>): Placement | undefined {
  return held === undefined || hover === undefined ? undefined : { slot: held, tile: hover };
}


export const HAND_WIDTH = f32(f32(0.025) * 32 / (f32(0.117924) * 256));
export const HAND_HEIGHT = f32(f32(0.0239) * 32 / (f32(0.23585) * 128));

// SelectionHandPinch is one 32x32 texture; its pinch point is the middle of the gap between thumb and index tips.
const PINCH_POINT_X = 4.25;
const PINCH_POINT_Y = 8.75;

// SelectionHandPoint is one 128x128 texture; its index fingertip is (4, 6).
export const handLeft = (x: number, pinching: boolean): number => x - f32(!pinching ? 4 / 128 : PINCH_POINT_X / 32) * HAND_WIDTH;

export const handTop = (y: number, pinching: boolean): number => y + f32(!pinching ? 6 / 128 : PINCH_POINT_Y / 32) * HAND_HEIGHT;

export const carriedChipLeft = (x: number, size: number): number => x - size * f32(0.5);

export const carriedChipTop = (y: number, size: number): number => y + size * f32(0.06);

// A chip not yet on a fighter parks centred on this point of its player card.
export const parkedChipCentre = (slot: number): { readonly x: number; readonly y: number } => ({ x: cardRight(slot, f32(0.126)), y: cardDown(f32(0.105)) });

export const parkedChipLeft = (slot: number, size: number): number => parkedChipCentre(slot).x - size * f32(0.5);

export const parkedChipTop = (size: number): number => cardDown(f32(0.105)) + size * f32(0.5);
