import { f32 } from "wisp/src/sim/f32";
import { HAND_STATES, type HandState, handLeft, handSize, handTop, readyChipSize } from "../menu/selectionDrag";
import { HAND_TEXELS } from "../core/handArt";
import type { RosterGrid } from "../menu/selectionGrid";
import { SELECT_LEVELS } from "./selectLevels";
import { art } from "./selectionFrames";
import { consoleUi, gameUi, placeTopLeft } from "./frames";
import type { DrawnHand } from "./selectionHands";
import { destroyFrame, Frame, setFrameLevel, setFrameTexture, setFrameVisible } from "wisp/game/frames";
import { handLabelName } from "./handLabelArt";
import { formatInt } from "wisp/game/text";

interface HandLayer {
  readonly states: Readonly<Record<HandState, Frame>>;
  readonly badge: Frame;
  badgePalette: number | undefined;
  readonly slot: number;
}

// Engine: Warcraft squeezes a game-UI child whose frame crosses the edge of the 4:3 area, but draws a ConsoleUIBackdrop child under every game-UI child; so the hand is drawn in the game UI, over the roster, until it crosses an edge, and then in the console layer, at full size, running off the edge like an OS cursor.
export interface HandFrames {
  readonly inside: HandLayer;
  readonly edge: HandLayer;
}

// The player label is the chip's own "P1" lettering, drawn without the disc, at the same texel scale as the chip's text: its 128x96 canvas is half the chip's width and 3/8 of its height, centred on this texel of the hand's 256 canvas (the middle of the back-of-hand plate, which every state draws in the same place).
const LABEL_CENTRE_X = 135;
const LABEL_CENTRE_Y = 119;
const LABEL_CHIP_WIDTH = f32(0.5);
const LABEL_CHIP_HEIGHT = f32(0.375);

const UI_WIDTH = f32(0.8);
const UI_HEIGHT = f32(0.6);

const badgeTexture = (slot: number, palette: number): string => `war3mapImported\\${handLabelName(slot, palette)}.tga`;

const TEXTURE_NAMES: Readonly<Record<HandState, string>> = { point: "Point", fan: "Fan", pinch: "Pinch" };

export function handBadgeBox(left: number, top: number, size: number, chip: number): { readonly left: number; readonly top: number; readonly width: number; readonly height: number } {
  const unit = f32(size / HAND_TEXELS);
  const width = f32(chip * LABEL_CHIP_WIDTH);
  const height = f32(chip * LABEL_CHIP_HEIGHT);
  return { left: f32(left + f32(LABEL_CENTRE_X * unit) - width / 2), top: f32(top - f32(LABEL_CENTRE_Y * unit) + height / 2), width, height };
}

export const handCrossesEdge = (left: number, top: number, size: number): boolean => left < 0 || top > UI_HEIGHT || f32(left + size) > UI_WIDTH || f32(top - size) < 0;

function createLayer(parent: Frame, grid: RosterGrid, tag: string, suffix: string, slot: number): HandLayer {
  const size = handSize(grid);
  const state = (hand: HandState) => {
    const frame = art(parent, `MeleeHand${TEXTURE_NAMES[hand]}${tag}${suffix}_${formatInt(slot)}`, `war3mapImported\\SelectionHand${TEXTURE_NAMES[hand]}.tga`, 0.0, 0.0, size, size);
    setFrameLevel(frame, SELECT_LEVELS.hand);
    setFrameVisible(frame, false);
    return frame;
  };
  const { width, height } = handBadgeBox(0.0, 0.0, size, readyChipSize(grid));
  const badge = art(parent, `MeleeHandBadge${tag}${suffix}_${formatInt(slot)}`, badgeTexture(slot, slot), 0.0, 0.0, width, height);
  setFrameLevel(badge, SELECT_LEVELS.handBadge);
  setFrameVisible(badge, false);
  return { states: { point: state("point"), fan: state("fan"), pinch: state("pinch") }, badge, badgePalette: slot, slot };
}

export function createHandFrames(grid: RosterGrid, suffix: string, slot: number): HandFrames {
  return { inside: createLayer(gameUi(), grid, "", suffix, slot), edge: createLayer(consoleUi(), grid, "Edge", suffix, slot) };
}

function presentLayer(layer: HandLayer, hand: DrawnHand | undefined, left: number, top: number, size: number, chip: number): void {
  for (const state of HAND_STATES) setFrameVisible(layer.states[state], hand?.pose.state === state);
  setFrameVisible(layer.badge, hand !== undefined);
  if (hand === undefined) return;
  if (layer.badgePalette !== hand.palette) {
    layer.badgePalette = hand.palette;
    setFrameTexture(layer.badge, badgeTexture(layer.slot, hand.palette), 0, true);
  }
  placeTopLeft(layer.states[hand.pose.state], left, top);
  const badge = handBadgeBox(left, top, size, chip);
  placeTopLeft(layer.badge, badge.left, badge.top);
}

export function presentHand(frames: HandFrames, hand: DrawnHand | undefined, grid: RosterGrid): void {
  const size = handSize(grid);
  const left = hand === undefined ? 0.0 : handLeft(hand.pose.x, hand.pose.state, size);
  const top = hand === undefined ? 0.0 : handTop(hand.pose.y, hand.pose.state, size);
  const crossing = hand !== undefined && handCrossesEdge(left, top, size);
  const chip = readyChipSize(grid);
  presentLayer(frames.inside, crossing ? undefined : hand, left, top, size, chip);
  presentLayer(frames.edge, crossing ? hand : undefined, left, top, size, chip);
}

function destroyLayer(layer: HandLayer): void {
  for (const state of HAND_STATES) destroyFrame(layer.states[state]);
  destroyFrame(layer.badge);
}

export function destroyHandFrames(frames: HandFrames): void {
  destroyLayer(frames.inside);
  destroyLayer(frames.edge);
}
