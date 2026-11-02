import { f32 } from "wisp/src/sim/f32";
import type { Race } from "../roster/races";

/** The box the bust stands in, pixels on a 1920-tall display; it keeps the size the console arch had so the plate around it stays put. */
export const RACE_FRAME_PX = { width: 212, height: 272 } as const;

export const BUST_TEXTURE_PX = 256;

export type FrameLayer = "BACKGROUND" | "ARTWORK";

/** One texture of the frame: where it sits in the frame (pixels at 1920 tall) and which texels it shows as [left, right, top, bottom]. */
export interface FramePart {
  readonly key: "portrait";
  readonly layer: FrameLayer;
  readonly file?: string;
  readonly texels: number;
  readonly texCoord: readonly [number, number, number, number];
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Where the bust stands in its box. */
export const OPENING = { x: 28, y: 56, width: 156, height: 208 } as const;
const BUST_SHOWN_TEXELS = (OPENING.width * BUST_TEXTURE_PX) / OPENING.height;
const BUST_U_LEFT = f32((BUST_TEXTURE_PX - BUST_SHOWN_TEXELS) / 2 / BUST_TEXTURE_PX);
const OPENING_CROP = [BUST_U_LEFT, f32(1.0 - BUST_U_LEFT), 0.0, 1.0] as const;

export function raceFrameParts(): readonly FramePart[] {
  return [{ key: "portrait", layer: "BACKGROUND", texels: BUST_TEXTURE_PX, texCoord: OPENING_CROP, ...OPENING }];
}

/** Drawn pixels per texel along each axis on a 1920-tall display: at most 1 means never stretched, equal means not distorted. */
export function partScale(part: FramePart): { readonly x: number; readonly y: number } {
  const [left, right, top, bottom] = part.texCoord;
  return { x: part.width / (Math.abs(right - left) * part.texels), y: part.height / ((bottom - top) * part.texels) };
}

export const raceFrameName = (race: Race): string => `SmashcraftRaceFrame${race}`;

/** Each race's colour for the nameplate's thin inner edge. */
export const RACE_COLOURS: { readonly [R in Race]: { readonly tint: number } } = {
  Human: { tint: 0xe8b83a },
  NightElf: { tint: 0x4a8fe0 },
  Orc: { tint: 0xd0582a },
  Undead: { tint: 0x9b6bd6 },
};

export const namePlateTexture = (race: Race, mirrored: boolean): string => `war3mapImported\\NamePlate${mirrored ? "Mirror" : ""}${race}.tga`;
export const STOCK_SHADOW_TEXTURE = "war3mapImported\\StockShadow.tga";
export const pingSignalTexture = (bars: number): string => `war3mapImported\\PingSignal${bars}.tga`;
