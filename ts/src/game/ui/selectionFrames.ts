import type { SessionWinsFrames } from "./sessionWinsFrames";
import { f32 } from "wisp/src/sim/f32";
import { type RosterTile, cardDown, cardRight, cardSize } from "../menu/selectionDrag";
import { NATIVE_TEXT_BASE } from "./hudLayout";
import { PLAYABLE_CHARACTERS, fighterName, DEFAULT_FIGHTER } from "../roster/kits";
import { fighterPortrait } from "../roster/looks";
import { Character } from "../sim/codes";
import { createBackdrop, createText, placeTopLeft, sizeText } from "./frames";
import { SELECT_GRID_ORDER } from "./selectionLayout";
import { type MatchState, RANDOM_FIGHTER, randomFighterOffered, selectableMatchCharacter } from "../lobby/lobbyState";

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
  [Character.tinker]: "Tinker",
  [Character.kaelthas]: "Kael'thas",
  [Character.grom]: "Grom",
  [Character.malfurion]: "Malfurion",
  [Character.ladyVashj]: "Vashj",
};

export function art(parent: framehandle, name: string, texture: string, x: number, y: number, width: number, height: number): framehandle {
  const frame = createBackdrop(name, parent, 0);
  BlzFrameSetTexture(frame, texture, 0, true);
  placeTopLeft(frame, x, y);
  BlzFrameSetSize(frame, width, height);
  BlzFrameSetEnable(frame, false);
  return frame;
}

export function label(parent: framehandle, name: string, x: number, y: number, width: number, height: number, size: number): framehandle {
  const frame = createText(name, parent, 0);
  placeTopLeft(frame, x, y);
  sizeText(frame, size, width, height);
  BlzFrameSetTextAlignment(frame, TEXT_JUSTIFY_MIDDLE, TEXT_JUSTIFY_CENTER);
  BlzFrameSetEnable(frame, false);
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

export function placeBottomBar(frames: { readonly status: framehandle; readonly wins: SessionWinsFrames }, slot: number, winsShown: boolean, statusText: string, countText: string): void {
  const left = cardRight(slot, f32(0.014));
  const width = cardSize(f32(0.132));
  if (!winsShown) {
    placeTopLeft(frames.status, left, BOTTOM_BAR_TOP);
    BlzFrameSetSize(frames.status, width, BAR_HEIGHT);
    BlzFrameSetTextAlignment(frames.status, TEXT_JUSTIFY_MIDDLE, TEXT_JUSTIFY_CENTER);
    return;
  }
  const statusWidth = f32(I2R(StringLength(statusText)) * BAR_CHAR_WIDTH);
  const countWidth = f32(I2R(StringLength(countText)) * BAR_CHAR_WIDTH);
  const group = f32(f32(f32(statusWidth + countWidth) + BAR_COIN) + f32(BAR_GAP + BAR_LABEL_GAP));
  const statusRight = f32(f32(cardRight(slot, f32(0.08)) - f32(group / 2)) + statusWidth);
  const coinLeft = f32(statusRight + BAR_LABEL_GAP);
  placeTopLeft(frames.status, left, BOTTOM_BAR_TOP);
  BlzFrameSetSize(frames.status, f32(statusRight - left), BAR_HEIGHT);
  BlzFrameSetTextAlignment(frames.status, TEXT_JUSTIFY_MIDDLE, TEXT_JUSTIFY_RIGHT);
  placeTopLeft(frames.wins.coin, coinLeft, f32(BOTTOM_BAR_TOP + f32(f32(BAR_COIN - BAR_HEIGHT) / 2)));
  BlzFrameSetSize(frames.wins.coin, BAR_COIN, BAR_COIN);
  placeTopLeft(frames.wins.count, f32(f32(coinLeft + BAR_COIN) + BAR_GAP), BOTTOM_BAR_TOP);
}

export function hotspot(parent: framehandle, x: number, y: number, width: number, height: number): framehandle {
  const frame = BlzCreateFrame("ScriptDialogButton", parent, 0, 0);
  placeTopLeft(frame, x, y);
  BlzFrameSetSize(frame, width, height);
  BlzFrameSetAlpha(frame, 0);
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
  const tile = S2I(data);
  return I2S(tile) === data && tile >= 0 && tile < ROSTER_TILES ? tile : undefined;
};
export const decodeSlot = (data: string): number | undefined => (data === "0" ? 0 : data === "1" ? 1 : data === "2" ? 2 : data === "3" ? 3 : undefined);

export const tileOffered = (game: Readonly<MatchState>, tile: RosterTile): boolean => tile === RANDOM_FIGHTER_TILE ? randomFighterOffered(game) : selectableMatchCharacter(game, characterOfTile(tile));

export function tileLabel(tile: RosterTile): string {
  const fighter = GRID_FIGHTERS[tile];
  return fighter === undefined ? nameText(RANDOM_FIGHTER) : TILE_NAMES[fighter] ?? nameText(fighter);
}
