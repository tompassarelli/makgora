import { f32 } from "wisp/src/sim/f32";
import { toInt } from "wisp/src/sim/binary32";
import { idiv, imod } from "wisp/src/sim/intMath";
import { unitsForPixels } from "./portraitFrames";


export const PLATE_WIDTH_PX = 544;
export const PLATE_HEIGHT_PX = 236;

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
const STOCK_SHOWN_PX = 38;
const STOCK_STEP_PX = 44;

export interface PanelLayout {
  readonly mirrored: boolean;
  readonly bust: PlateBox;
  readonly damage: PlateBox;
  readonly percent: PlateBox;
  readonly doom: PlateBox;
  readonly name: PlateBox;
  readonly slot: PlateBox;
  readonly exCell: PlateBox;
  readonly ultimateBar: PlateBox;
  readonly stocks: readonly PlateBox[];
  readonly stockCount: PlateBox;
}

const BUST: PlateBox = { x: -12, y: -96, width: 256, height: 256 };
// Warcraft wraps oversized frame text onto a hidden second line; reserve enough width for damage digits.
const DAMAGE: PlateBox = { x: 150, y: -4, width: 284, height: 124 };
const PERCENT: PlateBox = { x: 436, y: 34, width: 60, height: 70 };
const DOOM: PlateBox = { x: 444, y: -8, width: 44, height: 44 };
const NAME: PlateBox = { x: 244, y: 148, width: 228, height: 30 };
const SLOT: PlateBox = { x: 472, y: 148, width: 40, height: 30 };
const EX_CELL: PlateBox = { x: 466, y: 68, width: 34, height: 34 };
const ULTIMATE_BAR: PlateBox = { x: 260, y: 123, width: 262, height: 10 };
const STOCK_LEFT_PX = 246;
const STOCK_TOP_PX = 186;

const flip = (box: PlateBox): PlateBox => ({ ...box, x: PLATE_WIDTH_PX - box.x - box.width });

function stockBox(index: number): PlateBox {
  return { x: STOCK_LEFT_PX + index * STOCK_STEP_PX, y: STOCK_TOP_PX, width: STOCK_SHOWN_PX, height: STOCK_SHOWN_PX };
}

const STOCKS: readonly PlateBox[] = [0, 1, 2, 3, 4].map(index => stockBox(index));
const STOCK_COUNT: PlateBox = { x: STOCK_LEFT_PX + STOCK_STEP_PX, y: STOCK_TOP_PX, width: 120, height: STOCK_SHOWN_PX };

const LEFT_PANEL: PanelLayout = { mirrored: false, bust: BUST, damage: DAMAGE, percent: PERCENT, doom: DOOM, name: NAME, slot: SLOT, exCell: EX_CELL, ultimateBar: ULTIMATE_BAR, stocks: STOCKS, stockCount: STOCK_COUNT };

const MIRRORED_PERCENT_X = 236;
const GROUP_LEFT = MIRRORED_PERCENT_X - PERCENT.x + DAMAGE.x;

const RIGHT_PANEL: PanelLayout = {
  mirrored: true,
  bust: flip(BUST),
  damage: { ...DAMAGE, x: GROUP_LEFT },
  percent: { ...PERCENT, x: MIRRORED_PERCENT_X },
  doom: { ...DOOM, x: MIRRORED_PERCENT_X + DOOM.x - PERCENT.x },
  name: flip(NAME),
  slot: flip(SLOT),
  exCell: { ...EX_CELL, x: MIRRORED_PERCENT_X + EX_CELL.x - PERCENT.x },
  ultimateBar: flip(ULTIMATE_BAR),
  stocks: STOCKS.map(box => flip(box)),
  stockCount: flip(STOCK_COUNT),
};

export const panelMirrored = (position: number, count: number): boolean => count > 1 && 2 * position >= count;

export const panelLayout = (position: number, count: number): PanelLayout => panelMirrored(position, count) ? RIGHT_PANEL : LEFT_PANEL;


export function plateLeft(position: number, count: number): number {
  const spacing = f32(0.76) / count;
  return f32(0.02) + spacing * (position + 0.5) - unitsForPixels(PLATE_WIDTH_PX) / 2;
}


export const boxLeft = (left: number, box: PlateBox): number => left + unitsForPixels(box.x);
export const boxTop = (box: PlateBox): number => PLATE_TOP - unitsForPixels(box.y);

export interface PlateRect {
  readonly left: number;
  readonly centerY: number;
  readonly width: number;
  readonly height: number;
}

const plateRect = (left: number, box: PlateBox): PlateRect => ({ left: boxLeft(left, box), centerY: boxTop(box) - unitsForPixels(box.height) / 2, width: unitsForPixels(box.width), height: unitsForPixels(box.height) });

export function meterPlacement(position: number, count: number): { readonly exCell: PlateRect; readonly ultimateBar: PlateRect } {
  const { exCell, ultimateBar } = panelLayout(position, count);
  const left = plateLeft(position, count);
  return { exCell: plateRect(left, exCell), ultimateBar: plateRect(left, ultimateBar) };
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
