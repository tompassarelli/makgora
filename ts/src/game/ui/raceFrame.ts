import { f32 } from "wisp/src/sim/f32";
import type { Race } from "../roster/races";

/** Edge length of a Classic race console tile (UI\Console\<Race>\<Race>UITile0N), the art the portrait frame is cut from. */
export const CONSOLE_TILE_PX = 512;

/** The portrait arch of the stock console, in tile 01 and tile 02 laid side by side; every race's console puts it at the same place, its opening centred on texel 506. */
export const CONSOLE_ARCH = { left: 400, top: 186, width: 212, height: 272 } as const;

/** The frame is drawn at its texels' own size on a 1920-tall display, never stretched past it. */
export const RACE_FRAME_PX = { width: CONSOLE_ARCH.width, height: CONSOLE_ARCH.height } as const;

export const BUST_TEXTURE_PX = 256;

export type FrameLayer = "BACKGROUND" | "ARTWORK";

/** One texture of the frame: where it sits in the frame (pixels at 1920 tall) and which texels it shows as [left, right, top, bottom]. */
export interface FramePart {
  readonly key: "portrait" | "archLeft" | "archMiddle" | "archRight";
  readonly layer: FrameLayer;
  readonly file?: string;
  readonly texels: number;
  readonly texCoord: readonly [number, number, number, number];
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const ARCH_SPLIT = CONSOLE_TILE_PX - CONSOLE_ARCH.left;
const ARCH_RIGHT_PX = CONSOLE_ARCH.width - ARCH_SPLIT;
const ARCH_MIDDLE_PX = CONSOLE_ARCH.width - 2 * ARCH_RIGHT_PX;
const tileU = (texel: number): number => f32(texel / CONSOLE_TILE_PX);
const ARCH_V_TOP = tileU(CONSOLE_ARCH.top);
const ARCH_V_BOTTOM = tileU(CONSOLE_ARCH.top + CONSOLE_ARCH.height);

/** The opening behind the arch, overlapped by the frame art so no edge of the portrait shows. */
const OPENING = { x: 28, y: 56, width: 156, height: 208 } as const;
const BUST_SHOWN_TEXELS = (OPENING.width * BUST_TEXTURE_PX) / OPENING.height;
const BUST_U_LEFT = f32((BUST_TEXTURE_PX - BUST_SHOWN_TEXELS) / 2 / BUST_TEXTURE_PX);
const OPENING_CROP = [BUST_U_LEFT, f32(1.0 - BUST_U_LEFT), 0.0, 1.0] as const;

export const consoleTile = (race: Race, tile: number): string => `UI\\Console\\${race}\\${race}UITile0${tile}.blp`;
/** Our radial glow in the race's colours, drawn into each fighter's bust at build time; the race frame shows the bust alone under the arch. */
export const raceBackingArt = (race: Race): string => `RaceBacking${race}`;

export function raceFrameParts(race: Race): readonly FramePart[] {
  return [
    { key: "portrait", layer: "BACKGROUND", texels: BUST_TEXTURE_PX, texCoord: OPENING_CROP, ...OPENING },
    { key: "archLeft", layer: "ARTWORK", file: consoleTile(race, 2), texels: CONSOLE_TILE_PX, texCoord: [tileU(ARCH_RIGHT_PX), 0.0, ARCH_V_TOP, ARCH_V_BOTTOM], x: 0, y: 0, width: ARCH_RIGHT_PX, height: CONSOLE_ARCH.height },
    { key: "archMiddle", layer: "ARTWORK", file: consoleTile(race, 1), texels: CONSOLE_TILE_PX, texCoord: [tileU(CONSOLE_TILE_PX - ARCH_MIDDLE_PX), 1.0, ARCH_V_TOP, ARCH_V_BOTTOM], x: ARCH_RIGHT_PX, y: 0, width: ARCH_MIDDLE_PX, height: CONSOLE_ARCH.height },
    { key: "archRight", layer: "ARTWORK", file: consoleTile(race, 2), texels: CONSOLE_TILE_PX, texCoord: [0.0, tileU(ARCH_RIGHT_PX), ARCH_V_TOP, ARCH_V_BOTTOM], x: ARCH_SPLIT, y: 0, width: ARCH_RIGHT_PX, height: CONSOLE_ARCH.height },
  ];
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
