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

/** Our radial glow in the race's colours, drawn into each fighter's bust at build time. */
export const raceBackingArt = (race: Race): string => `RaceBacking${race}`;

export function raceFrameParts(): readonly FramePart[] {
  return [{ key: "portrait", layer: "BACKGROUND", texels: BUST_TEXTURE_PX, texCoord: OPENING_CROP, ...OPENING }];
}

/** Drawn pixels per texel along each axis on a 1920-tall display: at most 1 means never stretched, equal means not distorted. */
export function partScale(part: FramePart): { readonly x: number; readonly y: number } {
  const [left, right, top, bottom] = part.texCoord;
  return { x: part.width / (Math.abs(right - left) * part.texels), y: part.height / ((bottom - top) * part.texels) };
}

export const raceFrameName = (race: Race): string => `SmashcraftRaceFrame${race}`;

/** Each race's colours for its own HUD art: the nameplate's thin inner edge and the radial backing behind the portrait. */
export const RACE_COLOURS: { readonly [R in Race]: { readonly tint: number; readonly light: number; readonly mid: number; readonly dark: number } } = {
  Human: { tint: 0xe8b83a, light: 0x9a1c14, mid: 0x5a0c0a, dark: 0x160404 },
  NightElf: { tint: 0x4a8fe0, light: 0x2a54b8, mid: 0x122a6a, dark: 0x040a1c },
  Orc: { tint: 0xd0582a, light: 0x8e3c12, mid: 0x4e1c08, dark: 0x140604 },
  Undead: { tint: 0x9b6bd6, light: 0x4c2a72, mid: 0x261440, dark: 0x08040f },
};

export const namePlateTexture = (race: Race, mirrored: boolean): string => `war3mapImported\\NamePlate${mirrored ? "Mirror" : ""}${race}.tga`;
export const STOCK_SHADOW_TEXTURE = "war3mapImported\\StockShadow.tga";
export const pingSignalTexture = (bars: number): string => `war3mapImported\\PingSignal${bars}.tga`;
