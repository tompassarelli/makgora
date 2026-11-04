import type { SessionWinsFrames } from "./sessionWinsFrames";
import { f32 } from "wisp/src/sim/f32";
import { type RosterTile, cardDown, cardRight, cardSize } from "../menu/selectionDrag";
import { type RosterGrid, cellRect, laidOut, rosterLayout } from "../menu/selectionGrid";
import { TILE_PORTRAIT_SLOT, tilePortrait } from "./portraitFrames";
import { NATIVE_TEXT_BASE } from "./hudLayout";
import { PLAYABLE_CHARACTERS, fighterName, DEFAULT_FIGHTER } from "../roster/kits";
import { fighterPortrait } from "../roster/looks";
import { Character } from "../sim/codes";
import { createBackdrop, createText, placeTopLeft, sizeText } from "./frames";
import { SELECT_GRID_ORDER } from "./selectionLayout";
import { type MatchState, offeredMatchCharacter, selectableMatchCharacter } from "../lobby/lobbyState";
import { RANDOM_FIGHTER, randomFighterOffered } from "../lobby/characterChoice";
import { createFrame, Frame, setFrameAlpha, setFrameEnabled, setFrameSize, setFrameText, setFrameTextAlignment, setFrameTexture, setFrameVisible, TextAlignment } from "wisp/game/frames";
import { COMING_SOON, fighterShown, fighterStatus, isComingSoon } from "../roster/forge";
import { FORGE_ICON } from "./ruleText";
import { formatInt, parseInt, textLength, toReal } from "wisp/game/text";

export const titleCase = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

export const RANDOM_FIGHTER_TEXTURE = "war3mapImported\\SelectionRandom.tga";
export const portraitTexture = (choice: number | undefined, tile: boolean, slot?: number, costume = 0) => choice === RANDOM_FIGHTER ? RANDOM_FIGHTER_TEXTURE : fighterPortrait(choice ?? DEFAULT_FIGHTER, tile ? "Tile" : "Card", slot, costume);
export const nameText = (choice: number | undefined) => choice === RANDOM_FIGHTER ? "Random" : fighterName(choice ?? DEFAULT_FIGHTER);
export const TILE_NAMES: Readonly<Partial<Record<Character, string>>> = {
  [Character.mountainKing]: "Muradin",
  [Character.uther]: "Uther",
  [Character.shadowHunter]: "Rokhan",
  [Character.blademaster]: "Samuro",
  [Character.beastmaster]: "Rexxar",
  [Character.warden]: "Maiev",
  [Character.jaina]: "Jaina",
  [Character.sylvanas]: "Sylvanas",
  [Character.cairne]: "Cairne",
  [Character.chen]: "Chen",
  [Character.tinker]: "Gazlowe",
  [Character.kaelthas]: "Kael'thas",
  [Character.grom]: "Grom",
  [Character.malfurion]: "Malfurion",
  [Character.ladyVashj]: "Vashj",
};

export const TILE_NAME_INSET = f32(0.008);
export const TILE_NAME_SIZE = f32(0.0078);

/** Room for a name on one line of a roster tile, in font sizes. */
export const tileNameEms = (grid: Readonly<RosterGrid>): number => f32(f32(f32(grid.cellWidth) - f32(2 * f32(TILE_NAME_INSET * f32(grid.scale)))) / TILE_NAME_SIZE);

export function art(parent: Frame, name: string, texture: string, x: number, y: number, width: number, height: number): Frame {
  const frame = createBackdrop(name, parent, 0);
  setFrameTexture(frame, texture, 0, true);
  placeTopLeft(frame, x, y);
  setFrameSize(frame, width, height);
  setFrameEnabled(frame, false);
  return frame;
}

export function label(parent: Frame, name: string, x: number, y: number, width: number, height: number, size: number): Frame {
  const frame = createText(name, parent, 0);
  placeTopLeft(frame, x, y);
  sizeText(frame, size, width, height);
  setFrameTextAlignment(frame, TextAlignment.middle, TextAlignment.center);
  setFrameEnabled(frame, false);
  return frame;
}


export const TAG_SIZE = cardSize(f32(0.01));
export const TAG_SCALE = f32(TAG_SIZE / NATIVE_TEXT_BASE);
export const BOTTOM_BAR_TOP = cardDown(f32(0.198));
export const BAR_HEIGHT = cardSize(f32(0.012));
export const BAR_TEXT = cardSize(f32(0.009));
const BAR_COIN = cardSize(f32(0.011));
const BAR_GAP = cardSize(f32(0.003));
const BAR_LABEL_GAP = cardSize(f32(0.006));
const BAR_CHAR_WIDTH = cardSize(f32(0.0055));

export function placeBottomBar(frames: { readonly status: Frame; readonly wins: SessionWinsFrames }, slot: number, winsShown: boolean, statusText: string, countText: string): void {
  const left = cardRight(slot, f32(0.014));
  const width = cardSize(f32(0.132));
  if (!winsShown) {
    placeTopLeft(frames.status, left, BOTTOM_BAR_TOP);
    setFrameSize(frames.status, width, BAR_HEIGHT);
    setFrameTextAlignment(frames.status, TextAlignment.middle, TextAlignment.center);
    return;
  }
  const statusWidth = f32(toReal(textLength(statusText)) * BAR_CHAR_WIDTH);
  const countWidth = f32(toReal(textLength(countText)) * BAR_CHAR_WIDTH);
  const group = f32(f32(f32(statusWidth + countWidth) + BAR_COIN) + f32(BAR_GAP + BAR_LABEL_GAP));
  const statusRight = f32(f32(cardRight(slot, f32(0.08)) - f32(group / 2)) + statusWidth);
  const coinLeft = f32(statusRight + BAR_LABEL_GAP);
  placeTopLeft(frames.status, left, BOTTOM_BAR_TOP);
  setFrameSize(frames.status, f32(statusRight - left), BAR_HEIGHT);
  setFrameTextAlignment(frames.status, TextAlignment.middle, TextAlignment.right);
  placeTopLeft(frames.wins.coin, coinLeft, f32(BOTTOM_BAR_TOP + f32(f32(BAR_COIN - BAR_HEIGHT) / 2)));
  setFrameSize(frames.wins.coin, BAR_COIN, BAR_COIN);
  placeTopLeft(frames.wins.count, f32(f32(coinLeft + BAR_COIN) + BAR_GAP), BOTTOM_BAR_TOP);
}

export function hotspot(parent: Frame, x: number, y: number, width: number, height: number): Frame {
  const frame = createFrame("ScriptDialogButton", parent, 0, 0);
  placeTopLeft(frame, x, y);
  setFrameSize(frame, width, height);
  setFrameAlpha(frame, 0);
  return frame;
}


export const modeBox = (slot: number) => ({ x: cardRight(slot, f32(0.014)), y: cardDown(f32(0.005)), width: cardSize(f32(0.132)), height: cardSize(f32(0.027)) });

export const GRID_FIGHTERS: readonly Character[] = SELECT_GRID_ORDER.filter(character => PLAYABLE_CHARACTERS.includes(character));
export const RANDOM_FIGHTER_TILE: RosterTile = GRID_FIGHTERS.length;
export const ROSTER_TILES = GRID_FIGHTERS.length + 1;
export const characterOfTile = (tile: RosterTile): number => tile === RANDOM_FIGHTER_TILE ? RANDOM_FIGHTER : GRID_FIGHTERS[tile] ?? DEFAULT_FIGHTER;
export function tileOfCharacter(character: number): RosterTile {
  if (character === RANDOM_FIGHTER) return RANDOM_FIGHTER_TILE;
  for (let tile = 0; tile < GRID_FIGHTERS.length; tile++) if (GRID_FIGHTERS[tile] === character) return tile;
  return 0;
}

export const decodeTile = (data: string): RosterTile | undefined => {
  const tile = parseInt(data);
  return formatInt(tile) === data && tile >= 0 && tile < ROSTER_TILES ? tile : undefined;
};
export const decodeSlot = (data: string): number | undefined => (data === "0" ? 0 : data === "1" ? 1 : data === "2" ? 2 : data === "3" ? 3 : undefined);

export function shownTiles(forgeShown: boolean): RosterTile[] {
  const tiles: RosterTile[] = [];
  for (let tile = 0; tile < GRID_FIGHTERS.length; tile++) if (fighterShown(characterOfTile(tile), forgeShown)) tiles.push(tile);
  tiles.push(RANDOM_FIGHTER_TILE);
  return tiles;
}

export const selectGrid = (forgeShown: boolean): RosterGrid => rosterLayout(shownTiles(forgeShown));

export const tileOffered = (game: Readonly<MatchState>, tile: RosterTile): boolean => tile === RANDOM_FIGHTER_TILE ? randomFighterOffered(game) : selectableMatchCharacter(game, characterOfTile(tile));

export function tileLabel(tile: RosterTile): string {
  const fighter = GRID_FIGHTERS[tile];
  return fighter === undefined ? nameText(RANDOM_FIGHTER) : isComingSoon(fighter) ? COMING_SOON : TILE_NAMES[fighter] ?? nameText(fighter);
}

export function placeTile(grid: Readonly<RosterGrid>, tile: RosterTile, frames: readonly Frame[] | undefined, mark: Frame | undefined, button: Frame | undefined): void {
  const [tileFrame, portraitFrame, name] = frames ?? [];
  if (tileFrame === undefined || portraitFrame === undefined || name === undefined || button === undefined || !laidOut(grid, tile)) return;
  const scale = f32(grid.scale);
  const portrait = tilePortrait(scale);
  const inset = (TILE_PORTRAIT_SLOT * scale - portrait) / 2;
  const { left, top } = cellRect(grid, tile);
  const x = f32(left);
  const y = f32(top);
  placeTopLeft(tileFrame, x, y);
  setFrameSize(tileFrame, f32(grid.cellWidth), f32(grid.cellHeight));
  placeTopLeft(portraitFrame, x + f32(0.0125) * scale + inset, y - f32(0.013) * scale - inset);
  setFrameSize(portraitFrame, portrait, portrait);
  placeTopLeft(name, x + TILE_NAME_INSET * scale, y - f32(0.106) * scale);
  sizeText(name, TILE_NAME_SIZE, f32(grid.cellWidth) - 2 * TILE_NAME_INSET * scale, f32(0.023) * scale);
  if (mark !== undefined) placeForgeMark(mark, x, y, grid);
  placeTopLeft(button, x, y);
  setFrameSize(button, f32(grid.cellWidth), f32(grid.cellHeight));
}

export const FORGE_MARK = "|cffff8c1aFORGE|r";

const tileListed = (game: Readonly<MatchState>, tile: RosterTile): boolean => tile === RANDOM_FIGHTER_TILE ? randomFighterOffered(game) : offeredMatchCharacter(game, characterOfTile(tile));

export const tileShown = (game: Readonly<MatchState>, tile: RosterTile, forgeShown: boolean): boolean => tileListed(game, tile) && fighterShown(characterOfTile(tile), forgeShown);

export const tileMarked = (game: Readonly<MatchState>, tile: RosterTile, forgeShown: boolean): boolean => tileShown(game, tile, forgeShown) && fighterStatus(characterOfTile(tile)) === "forge";

const FORGE_BADGE_SIZE = f32(0.032);
const FORGE_BADGE_INSET = f32(0.004);

export function placeForgeMark(mark: Frame, x: number, y: number, grid: Readonly<RosterGrid>): void {
  const scale = f32(grid.scale);
  const size = f32(FORGE_BADGE_SIZE * scale);
  placeTopLeft(mark, f32(f32(x + f32(grid.cellWidth)) - f32(size + f32(FORGE_BADGE_INSET * scale))), f32(y - f32(FORGE_BADGE_INSET * scale)));
  setFrameSize(mark, size, size);
}

export function showTile(game: Readonly<MatchState>, tile: RosterTile, forgeShown: boolean, frames: readonly Frame[] | undefined, mark: Frame | undefined, button: Frame | undefined): void {
  const selectable = tileShown(game, tile, forgeShown);
  if (mark !== undefined) setFrameVisible(mark, tileMarked(game, tile, forgeShown));
  for (const frame of frames ?? []) setFrameVisible(frame, selectable);
  if (button !== undefined) setFrameVisible(button, selectable);
}

export function forgeMark(parent: Frame, name: string, tile: RosterTile, grid: Readonly<RosterGrid>): Frame | undefined {
  if (fighterStatus(characterOfTile(tile)) !== "forge") return undefined;
  const size = f32(FORGE_BADGE_SIZE * f32(grid.scale));
  const mark = art(parent, name, FORGE_ICON, 0.0, 0.0, size, size);
  setFrameVisible(mark, false);
  return mark;
}

export const COMING_SOON_ALPHA = 90;

export function dimComingSoon(portrait: Frame, tile: RosterTile): void {
  if (tile !== RANDOM_FIGHTER_TILE && isComingSoon(characterOfTile(tile))) setFrameAlpha(portrait, COMING_SOON_ALPHA);
}
