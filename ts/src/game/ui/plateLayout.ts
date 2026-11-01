import { f32 } from "wisp/src/sim/f32";
import { toInt } from "wisp/src/sim/binary32";
import { idiv, imod } from "wisp/src/sim/intMath";
import { unitsForPixels } from "./portraitFrames";
import { RACE_FRAME_PX } from "./raceFrame";


export const PLATE_WIDTH_PX = 544;
export const PLATE_HEIGHT_PX = 334;

const PLATE_BOTTOM = f32(0.012);
export const PLATE_TOP = PLATE_BOTTOM + unitsForPixels(PLATE_HEIGHT_PX);

export interface PlateBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export const STOCK_ICON_PX = 64;
export const STOCK_ICONS_SHOWN = 5;
export const STOCK_SHOWN_PX = 40;
const STOCK_SHADOW_PX = 46;
const STOCK_STEP_PX = 52;
export const STOCK_FADE_FRAMES = 10;

export const NAME_FONT = f32(0.0105);
export const DAMAGE_FONT = f32(0.036);
export const CAP_HEIGHT = f32(0.7);
export const PING_FONT = f32(0.0062);
export const PING_BARS = 4;
export const PING_SIGNAL_TEXTURE_PX = { width: 68, height: 50 } as const;

export interface PanelLayout {
  readonly mirrored: boolean;
  readonly frame: PlateBox;
  readonly damage: PlateBox;
  readonly percent: PlateBox;
  readonly doom: PlateBox;
  readonly namePlate: PlateBox;
  readonly name: PlateBox;
  readonly ultimateBar: PlateBox;
  readonly stockShadows: readonly PlateBox[];
  readonly stocks: readonly PlateBox[];
  readonly stockCount: PlateBox;
  readonly pingSignal: PlateBox;
  readonly pingNumber: PlateBox;
}

const PING_COLUMN_PX = 68;
const FRAME: PlateBox = { x: PING_COLUMN_PX, y: 0, width: RACE_FRAME_PX.width, height: RACE_FRAME_PX.height };
// Warcraft wraps oversized frame text onto a hidden second line; reserve enough width for damage digits.
const DAMAGE: PlateBox = { x: 198, y: 96, width: 284, height: 124 };
const PERCENT: PlateBox = { x: 484, y: 134, width: 60, height: 70 };
const DOOM: PlateBox = { x: 492, y: 88, width: 44, height: 44 };
const ULTIMATE_BAR: PlateBox = { x: 226, y: 222, width: 286, height: 10 };
const NAME_PLATE: PlateBox = { x: 208, y: 236, width: 316, height: 42 };
const NAME: PlateBox = { x: 234, y: 236, width: 264, height: 42 };
const STOCK_LEFT_PX = 236;
const STOCK_TOP_PX = 285;
const PING_SIGNAL_WIDTH_PX = 24;
const PING_SIGNAL: PlateBox = { x: 0, y: 249, width: PING_SIGNAL_WIDTH_PX, height: (PING_SIGNAL_WIDTH_PX * PING_SIGNAL_TEXTURE_PX.height) / PING_SIGNAL_TEXTURE_PX.width };
const PING_NUMBER: PlateBox = { x: 26, y: 244, width: 42, height: 24 };

const flip = (box: PlateBox): PlateBox => ({ ...box, x: PLATE_WIDTH_PX - box.x - box.width });

const stockShadow = (index: number): PlateBox => ({ x: STOCK_LEFT_PX + index * STOCK_STEP_PX, y: STOCK_TOP_PX, width: STOCK_SHADOW_PX, height: STOCK_SHADOW_PX });
const stockIcon = (index: number): PlateBox => {
  const inset = (STOCK_SHADOW_PX - STOCK_SHOWN_PX) / 2;
  return { x: STOCK_LEFT_PX + index * STOCK_STEP_PX + inset, y: STOCK_TOP_PX + inset, width: STOCK_SHOWN_PX, height: STOCK_SHOWN_PX };
};

const ICON_INDEXES = [0, 1, 2, 3, 4];
const STOCK_SHADOWS: readonly PlateBox[] = ICON_INDEXES.map(index => stockShadow(index));
const STOCKS: readonly PlateBox[] = ICON_INDEXES.map(index => stockIcon(index));
const STOCK_COUNT: PlateBox = { x: STOCK_LEFT_PX + STOCK_STEP_PX, y: STOCK_TOP_PX, width: 120, height: STOCK_SHADOW_PX };

const LEFT_PANEL: PanelLayout = {
  mirrored: false, frame: FRAME, damage: DAMAGE, percent: PERCENT, doom: DOOM, namePlate: NAME_PLATE, name: NAME, ultimateBar: ULTIMATE_BAR,
  stockShadows: STOCK_SHADOWS, stocks: STOCKS, stockCount: STOCK_COUNT, pingSignal: PING_SIGNAL, pingNumber: PING_NUMBER,
};

const MIRRORED_PERCENT_X = 216;
const GROUP_LEFT = MIRRORED_PERCENT_X - PERCENT.x + DAMAGE.x;

const RIGHT_PANEL: PanelLayout = {
  mirrored: true,
  frame: flip(FRAME),
  damage: { ...DAMAGE, x: GROUP_LEFT },
  percent: { ...PERCENT, x: MIRRORED_PERCENT_X },
  doom: { ...DOOM, x: MIRRORED_PERCENT_X + DOOM.x - PERCENT.x },
  namePlate: flip(NAME_PLATE),
  name: flip(NAME),
  ultimateBar: flip(ULTIMATE_BAR),
  stockShadows: STOCK_SHADOWS.map(box => flip(box)),
  stocks: STOCKS.map(box => flip(box)),
  stockCount: flip(STOCK_COUNT),
  pingSignal: flip(PING_SIGNAL),
  pingNumber: flip(PING_NUMBER),
};

/** The bottom row: how many plates, how many of them sit left of the input preview (the rest face them, mirrored), and whether the preview is shown between them. */
export interface PlateRow {
  readonly count: number;
  readonly split: number;
  readonly preview: boolean;
}

const evenSplit = (count: number): number => count - idiv(count, 2);

export const plateRow = (count: number, preview = false, split = evenSplit(count)): PlateRow => ({ count, split: Math.max(0, Math.min(count, split)), preview });

export const panelMirrored = (position: number, row: PlateRow): boolean => row.count > 1 && position >= row.split;

export const panelLayout = (position: number, row: PlateRow): PanelLayout => panelMirrored(position, row) ? RIGHT_PANEL : LEFT_PANEL;

/** The fighters in plate order and the row's split: in Team Battle each team keeps its plates together and the split falls on the team boundary nearest the middle, so with two teams one sits left of the preview and the other right. */
export function plateOrder(active: readonly number[], teamBattle: boolean, teamOf: (slot: number) => number): { readonly slots: readonly number[]; readonly split: number } {
  const count = active.length;
  if (!teamBattle) return { slots: active, split: evenSplit(count) };
  const slots = active.slice().sort((first, second) => teamOf(first) !== teamOf(second) ? teamOf(first) - teamOf(second) : first - second);
  let split = evenSplit(count);
  let best = count + 1;
  for (let at = 1; at < count; at++) {
    const boundary = teamOf(slots[at - 1] ?? 0) !== teamOf(slots[at] ?? 0);
    const distance = Math.abs(2 * at - count);
    if (boundary && distance < best) { best = distance; split = at; }
  }
  return { slots, split };
}


/** Rivals-style signal bars: 4 under 60 ms, 3 under 100, 2 under 150, 1 above; 0 hides the readout (no measurement). */
export const PING_THRESHOLDS_MS = [60, 100, 150] as const;

export function pingBars(roundTripMs: number): number {
  if (roundTripMs < 0) return 0;
  let bars = PING_BARS;
  for (const limit of PING_THRESHOLDS_MS) {
    if (roundTripMs < limit) return bars;
    bars--;
  }
  return bars;
}

/** A lost stock's icon alpha, frame by frame after the loss: full, then gone after STOCK_FADE_FRAMES. */
export const stockFadeAlpha = (framesSinceLoss: number): number =>
  framesSinceLoss <= 0 ? 255 : framesSinceLoss >= STOCK_FADE_FRAMES ? 0 : idiv(255 * (STOCK_FADE_FRAMES - framesSinceLoss), STOCK_FADE_FRAMES);


const ROW_LEFT = f32(0.02);
const ROW_WIDTH = f32(0.76);
const PREVIEW_ROW_LEFT = f32(0.005);
const PREVIEW_ROW_WIDTH = f32(0.79);
export const PREVIEW_CELL = f32(0.12);

const rowLeft = (row: PlateRow): number => row.preview ? PREVIEW_ROW_LEFT : ROW_LEFT;

const cellWidth = (row: PlateRow): number => row.preview ? (PREVIEW_ROW_WIDTH - PREVIEW_CELL) / row.count : ROW_WIDTH / row.count;

// The preview's cell sits between the left-facing panels and the mirrored ones: p1 [keys] p2, p1 p2 [keys] p3, p1 p2 [keys] p3 p4.
export function plateLeft(position: number, row: PlateRow): number {
  const gap = row.preview && position >= row.split ? PREVIEW_CELL : 0.0;
  return rowLeft(row) + cellWidth(row) * (position + 0.5) + gap - unitsForPixels(PLATE_WIDTH_PX) / 2;
}

export const previewCellLeft = (row: PlateRow): number => PREVIEW_ROW_LEFT + cellWidth(row) * row.split;


export const boxLeft = (left: number, box: PlateBox): number => left + unitsForPixels(box.x);
export const boxTop = (box: PlateBox): number => PLATE_TOP - unitsForPixels(box.y);

export interface PlateRect {
  readonly left: number;
  readonly centerY: number;
  readonly width: number;
  readonly height: number;
}

const plateRect = (left: number, box: PlateBox): PlateRect => ({ left: boxLeft(left, box), centerY: boxTop(box) - unitsForPixels(box.height) / 2, width: unitsForPixels(box.width), height: unitsForPixels(box.height) });

export function meterPlacement(position: number, row: PlateRow): PlateRect {
  return plateRect(plateLeft(position, row), panelLayout(position, row).ultimateBar);
}


export const shownPercent = (damage: number): number => toInt(damage);

export const DAMAGE_DARK_FROM = 150;
const RAMP_DAMAGE = [0, 50, 100, DAMAGE_DARK_FROM] as const;
const RAMP_COLOUR = [0xffffff, 0xffe23a, 0xf0281e, 0x8c0a10] as const;

const channel = (colour: number, shift: number) => imod(idiv(colour, shift), 256);
const lerp = (from: number, to: number, step: number, steps: number) => from + idiv((to - from) * step, steps);


export function damageColour(damage: number): number {
  const whole = shownPercent(damage);
  for (let index = 1; index < RAMP_DAMAGE.length; index++) {
    const high = RAMP_DAMAGE[index] ?? 0;
    if (whole < high) {
      const low = RAMP_DAMAGE[index - 1] ?? 0;
      const from = RAMP_COLOUR[index - 1] ?? 0;
      const to = RAMP_COLOUR[index] ?? 0;
      const step = Math.max(0, whole - low);
      const steps = high - low;
      return lerp(channel(from, 65536), channel(to, 65536), step, steps) * 65536
        + lerp(channel(from, 256), channel(to, 256), step, steps) * 256
        + lerp(channel(from, 1), channel(to, 1), step, steps);
    }
  }
  return RAMP_COLOUR[RAMP_COLOUR.length - 1] ?? 0;
}

const HEX = "0123456789abcdef";
const hexByte = (value: number) => `${HEX.charAt(idiv(value, 16))}${HEX.charAt(imod(value, 16))}`;

export const colourCode = (colour: number): string => `|cff${hexByte(channel(colour, 65536))}${hexByte(channel(colour, 256))}${hexByte(channel(colour, 1))}`;

export const damageText = (damage: number): string => `${colourCode(damageColour(damage))}${shownPercent(damage)}|r`;

export const DOOM_MARK_TEXTURE = "ReplaceableTextures\\CommandButtons\\BTNDoom.blp";

export const percentText = (damage: number): string => `${colourCode(damageColour(damage))}%|r`;

const OUTLINE_DARK = 0x0a0608;
const OUTLINE_LIGHT = 0xffe8d8;

export const damageOutline = (damage: number): number => shownPercent(damage) >= DAMAGE_DARK_FROM ? OUTLINE_LIGHT : OUTLINE_DARK;

export const damageOutlineText = (damage: number): string => `${colourCode(damageOutline(damage))}${shownPercent(damage)}|r`;

export const percentOutlineText = (damage: number): string => `${colourCode(damageOutline(damage))}%|r`;


export const SHAKE_FRAMES = 14;

export const SHAKE_MAX_PX = 14;
const SHAKE_X = [1, -1, 0.75, -0.5, 1, -0.75, 0.5, -1, 0.25, -0.5, 0.5, -0.25, 0.25, 0] as const;
const SHAKE_Y = [-0.5, 0.75, -1, 0.5, -0.25, 1, -0.75, 0.25, -0.5, 0.75, -0.25, 0.5, -0.25, 0] as const;


export const shakeStrength = (damageAdded: number): number => Math.min(SHAKE_MAX_PX, 4 + damageAdded * f32(0.5));

const shake = (pattern: readonly number[], strength: number, frame: number): number =>
  frame < 0 || frame >= SHAKE_FRAMES ? 0.0 : (strength * (SHAKE_FRAMES - frame) * (pattern[frame] ?? 0)) / SHAKE_FRAMES;

export const shakeX = (strength: number, frame: number): number => shake(SHAKE_X, strength, frame);
export const shakeY = (strength: number, frame: number): number => shake(SHAKE_Y, strength, frame);


export interface NumberJolt {
  damage: number;
  shakeFrame: number;
  shakeStrength: number;
  dx: number;
  dy: number;
}

export const numberJolt = (): NumberJolt => ({ damage: 0.0, shakeFrame: SHAKE_FRAMES, shakeStrength: 0.0, dx: 0.0, dy: 0.0 });


export function stepJolt(jolt: NumberJolt, visible: boolean, damage: number): boolean {
  const added = damage - jolt.damage;
  jolt.damage = damage;
  if (visible && added > 0.0) {
    jolt.shakeFrame = 0;
    jolt.shakeStrength = shakeStrength(added);
  } else if (jolt.shakeFrame >= SHAKE_FRAMES) return false;
  else jolt.shakeFrame++;
  jolt.dx = shakeX(jolt.shakeStrength, jolt.shakeFrame);
  jolt.dy = shakeY(jolt.shakeStrength, jolt.shakeFrame);
  return true;
}
