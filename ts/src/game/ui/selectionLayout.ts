import { f32 } from "wisp/src/sim/f32";
import type { TextBox } from "./hudLayout";
import { Character } from "../sim/codes";

export const HEADER_BUTTON_TOP = f32(0.588);
export const HEADER_BUTTON_HEIGHT = f32(0.023);
export const SELECT_LEFT = f32(0.055);
export const SELECT_RIGHT = f32(0.786);
export const SELECT_GAP = f32(0.006);

const headerBox = (x: number, width: number) => ({ x, y: HEADER_BUTTON_TOP, width, height: HEADER_BUTTON_HEIGHT }) as const;
const after = (box: { readonly x: number; readonly width: number }): number => f32(f32(box.x + box.width) + SELECT_GAP);

export const START_BUTTON = headerBox(SELECT_LEFT, f32(0.18));

export const SETTINGS_BOX = headerBox(after(START_BUTTON), f32(0.115));

export const MOVES_BOX = headerBox(after(SETTINGS_BOX), f32(0.085));

const PANEL_BUTTON_WIDTH = f32(0.107);

export const TUTORIAL_BOX = headerBox(after(MOVES_BOX), PANEL_BUTTON_WIDTH);

export const CREDITS_BOX = headerBox(after(TUTORIAL_BOX), PANEL_BUTTON_WIDTH);

export const COMMUNITY_BOX = headerBox(f32(SELECT_RIGHT - PANEL_BUTTON_WIDTH), PANEL_BUTTON_WIDTH);

export const boxContains = (box: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }, x: number, y: number): boolean =>
  x >= box.x && x <= f32(box.x + box.width) && y <= box.y && y >= f32(box.y - box.height);

export const startButtonContains = (x: number, y: number): boolean => boxContains(START_BUTTON, x, y);

export function selectionTitleBox(_aspect: number): TextBox {
  return { left: f32(0.055), top: f32(0.536), width: f32(0.285), height: f32(0.023) };
}


export const MOVES_TITLE_BOX: TextBox = { left: f32(0.12), top: f32(0.44), width: f32(0.56), height: f32(0.03) };
export const MOVES_BODY_BOX: TextBox = { left: f32(0.12), top: f32(0.4), width: f32(0.56), height: f32(0.3) };
export const MOVES_BUTTON_TOP = f32(0.075);
export const MOVES_BUTTON_HEIGHT = f32(0.032);

/** The select grid's fighters in reading order, grouped by faction (Human, Orc, Undead, Night Elf, Burning Legion, Neutral); the Random tile follows them. */
export const SELECT_GRID_ORDER: readonly Character[] = [
  Character.uther, Character.jaina, Character.mountainKing, Character.medivh, Character.kaelthas, Character.thrall, Character.grom,
  Character.cairne, Character.beastmaster, Character.blademaster, Character.shadowHunter, Character.peon, Character.lichKing, Character.lich, Character.sylvanas,
  Character.dreadlord, Character.anubarak, Character.butcher, Character.malfurion, Character.tyrande, Character.demonHunter, Character.warden, Character.archimonde, Character.pitLord,
  Character.ladyVashj, Character.akama, Character.chen, Character.firelord, Character.tinker, Character.alchemist, Character.murloc,
];
