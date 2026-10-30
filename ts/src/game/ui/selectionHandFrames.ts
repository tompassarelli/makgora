import { f32 } from "wisp/src/sim/f32";
import { HAND_STATES, type HandState, handLeft, handSize, handTop } from "../menu/selectionDrag";
import { HAND_TEXELS } from "../core/handArt";
import type { RosterGrid } from "../menu/selectionGrid";
import { SELECT_LEVELS } from "./selectLevels";
import { art } from "./selectionFrames";
import { consoleUi, createBackdrop, createText, gameUi, placeTopLeft, setFrameText, sizeText } from "./frames";
import { type DrawnHand, handBadge } from "./selectionHands";
import { slotColor } from "./slotColors";

interface HandLayer {
  readonly states: Readonly<Record<HandState, framehandle>>;
  readonly badge: framehandle;
  readonly badgeText: framehandle;
}

// Engine: Warcraft squeezes a game-UI child whose frame crosses the edge of the 4:3 area, but draws a ConsoleUIBackdrop child under every game-UI child; so the hand is drawn in the game UI, over the roster, until it crosses an edge, and then in the console layer, at full size, running off the edge like an OS cursor.
export interface HandFrames {
  readonly inside: HandLayer;
  readonly edge: HandLayer;
}

// The badge sits on the gauntlet's cuff, which is the same place in all three hand textures (texels, from the top left of the 256 canvas).
const BADGE_LEFT = 35;
const BADGE_TOP = 198;
const BADGE_WIDTH = 80;
const BADGE_HEIGHT = 36;
const BADGE_TEXT_SHARE = f32(0.6);

const UI_WIDTH = f32(0.8);
const UI_HEIGHT = f32(0.6);

const TEXTURE_NAMES: Readonly<Record<HandState, string>> = { point: "Point", fan: "Fan", pinch: "Pinch" };

export function handBadgeBox(left: number, top: number, size: number): { readonly left: number; readonly top: number; readonly width: number; readonly height: number } {
  const unit = f32(size / HAND_TEXELS);
  return { left: f32(left + f32(BADGE_LEFT * unit)), top: f32(top - f32(BADGE_TOP * unit)), width: f32(BADGE_WIDTH * unit), height: f32(BADGE_HEIGHT * unit) };
}

export const handCrossesEdge = (left: number, top: number, size: number): boolean => left < 0 || top > UI_HEIGHT || f32(left + size) > UI_WIDTH || f32(top - size) < 0;

function createLayer(parent: framehandle, grid: RosterGrid, tag: string, suffix: string, slot: number): HandLayer {
  const size = handSize(grid);
  const state = (hand: HandState) => {
    const frame = art(parent, `MeleeHand${TEXTURE_NAMES[hand]}${tag}${suffix}_${I2S(slot)}`, `war3mapImported\\SelectionHand${TEXTURE_NAMES[hand]}.tga`, 0.0, 0.0, size, size);
    BlzFrameSetLevel(frame, SELECT_LEVELS.hand);
    BlzFrameSetVisible(frame, false);
    return frame;
  };
  const badge = createBackdrop(`MeleeHandBadge${tag}${suffix}_${I2S(slot)}`, parent, 0);
  BlzFrameSetTexture(badge, slotColor(slot).texture, 0, true);
  BlzFrameSetLevel(badge, SELECT_LEVELS.handBadge);
  BlzFrameSetEnable(badge, false);
  BlzFrameSetVisible(badge, false);
  const { width, height } = handBadgeBox(0.0, 0.0, size);
  BlzFrameSetSize(badge, width, height);
  const badgeText = createText(`MeleeHandBadgeText${tag}${suffix}_${I2S(slot)}`, badge, 0);
  BlzFrameSetEnable(badgeText, false);
  sizeText(badgeText, f32(height * BADGE_TEXT_SHARE), width, height);
  BlzFrameSetPoint(badgeText, FRAMEPOINT_CENTER, badge, FRAMEPOINT_CENTER, 0.0, 0.0);
  BlzFrameSetTextAlignment(badgeText, TEXT_JUSTIFY_MIDDLE, TEXT_JUSTIFY_CENTER);
  setFrameText(badgeText, handBadge(slot));
  return { states: { point: state("point"), fan: state("fan"), pinch: state("pinch") }, badge, badgeText };
}

export function createHandFrames(grid: RosterGrid, suffix: string, slot: number): HandFrames {
  return { inside: createLayer(gameUi(), grid, "", suffix, slot), edge: createLayer(consoleUi(), grid, "Edge", suffix, slot) };
}

function presentLayer(layer: HandLayer, hand: DrawnHand | undefined, left: number, top: number, size: number): void {
  for (const state of HAND_STATES) BlzFrameSetVisible(layer.states[state], hand?.pose.state === state);
  BlzFrameSetVisible(layer.badge, hand !== undefined);
  if (hand === undefined) return;
  placeTopLeft(layer.states[hand.pose.state], left, top);
  const badge = handBadgeBox(left, top, size);
  placeTopLeft(layer.badge, badge.left, badge.top);
}

export function presentHand(frames: HandFrames, hand: DrawnHand | undefined, grid: RosterGrid): void {
  const size = handSize(grid);
  const left = hand === undefined ? 0.0 : handLeft(hand.pose.x, hand.pose.state, size);
  const top = hand === undefined ? 0.0 : handTop(hand.pose.y, hand.pose.state, size);
  const crossing = hand !== undefined && handCrossesEdge(left, top, size);
  presentLayer(frames.inside, crossing ? undefined : hand, left, top, size);
  presentLayer(frames.edge, crossing ? hand : undefined, left, top, size);
}

function destroyLayer(layer: HandLayer): void {
  for (const state of HAND_STATES) BlzDestroyFrame(layer.states[state]);
  BlzDestroyFrame(layer.badgeText);
  BlzDestroyFrame(layer.badge);
}

export function destroyHandFrames(frames: HandFrames): void {
  destroyLayer(frames.inside);
  destroyLayer(frames.edge);
}
