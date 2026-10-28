import type { HeroPose } from "../../ts/src/game/sim/heroes/hero";

export interface Gesture {
  chest?: number; head?: number; hip?: number; waist?: number;
  staff?: number; staffYaw?: number; wrist?: number; palm?: number; palmYaw?: number; elbow?: number;
  front?: number; knee?: number; back?: number; backKnee?: number; lean?: number; turn?: number; hand?: number;
}
export interface Beat { at: number; g: Gesture; staff?: readonly [number, number]; foot?: readonly [number, number]; keg?: readonly [number, number, number]; kegScale?: number; legScale?: number }

const spin = (at: number, hand: number): Beat => ({at, g: {staff: -75, wrist: 10, palm: -35, chest: 12, front: -55, knee: 95, back: -25, backKnee: 85, lean: -8, hand}});
const kegLift: Gesture = {chest: -22, head: -15, staff: -165, palm: -165, elbow: -15, front: -55, knee: 90, back: -45, backKnee: 95};
const kegSlam: Gesture = {chest: 38, head: 22, staff: 125, wrist: 20, palm: 10, front: -100, knee: 125, back: -85, backKnee: 125};
const kickOut: Gesture = {lean: -28, chest: -12, head: -10, back: 50, backKnee: 90, staff: 115, wrist: 30, palm: 60};
const scoop: Gesture = {chest: -12, lean: -8, head: -15, front: -30, knee: 60, back: 15, backKnee: 55, palm: 20};
const dip: Gesture = {chest: 30, lean: 6, head: 10, front: -30, knee: 45, back: -20, backKnee: 45, palm: -30};
const settle: Gesture = {chest: 4, front: -5, knee: 10, back: 5, backKnee: 10};
const rise: Gesture = {chest: -10, head: -20, front: -10, knee: 15, back: 15, backKnee: 20, palm: 20};
export const CHEN_BEATS: Partial<Record<HeroPose, readonly Beat[]>> = {
  downAir: [
    {at: 4, g: {...kegLift, chest: -8, staff: -110, palm: -110}, keg: [-30, 0, 150], kegScale: 1.5},
    {at: 9, g: kegLift, keg: [-15, 0, 185], kegScale: 2.1},
    {at: 12, g: {...kegLift, chest: -28}, keg: [-5, 0, 195], kegScale: 2.2},
    {at: 13, g: kegSlam, keg: [11, 0, -12], kegScale: 2.3},
    {at: 17, g: kegSlam, keg: [11, 0, -16], kegScale: 2.3},
    {at: 24, g: {...kegSlam, chest: 30, front: -85, knee: 110, back: -70, backKnee: 110}, keg: [11, 0, -8], kegScale: 2.1},
    {at: 34, g: {chest: 12, front: -40, knee: 60, back: -30, backKnee: 60}, keg: [-20, 0, 70], kegScale: 1.3},
  ],
  forwardAir: [
    {at: 5, g: {chest: 15, lean: 5, front: -70, knee: 110, back: 20, backKnee: 50, staff: 50, wrist: 20, palm: 30}},
    {at: 10, g: {chest: 25, lean: 10, front: -115, knee: 145, back: 30, backKnee: 70, staff: 80, wrist: 25, palm: 45}},
    {at: 13, g: kickOut, foot: [90, 46], legScale: 1.5},
    {at: 14, g: kickOut, foot: [90, 46], legScale: 1.5},
    {at: 22, g: kickOut, foot: [86, 45], legScale: 1.45},
    {at: 29, g: kickOut, foot: [82, 44], legScale: 1.4},
    {at: 33, g: {chest: 15, front: -80, knee: 100, back: 20, backKnee: 50, staff: 60, palm: 30}},
  ],
  neutralAir: [
    {at: 2, g: {staff: -60, palm: -30, chest: 5, front: -30, knee: 55, back: -15, backKnee: 50, hand: -120}},
    ...Array.from({length: 15}, (_, i) => spin(i + 3, 42 + 47 * (i - 3))),
    {at: 20, g: {staff: -60, palm: -30, chest: 15, front: -55, knee: 95, back: -25, backKnee: 85, hand: 560}},
    {at: 26, g: {staff: -55, palm: -30, chest: 12, front: -50, knee: 85, back: -20, backKnee: 75, hand: 575}},
  ],
  upAir: [
    {at: 2, g: {chest: 28, lean: 10, front: -40, knee: 70, back: -20, backKnee: 60, palm: -30}, staff: [80, -15]},
    {at: 5, g: {...scoop, chest: 5, lean: 0}, staff: [104, 40]},
    {at: 6, g: {...scoop, chest: 0}, staff: [108, 103]},
    {at: 7, g: scoop, staff: [82, 150]},
    {at: 8, g: {...scoop, chest: -18, lean: -12}, staff: [34, 178]},
    {at: 9, g: {...scoop, chest: -22, lean: -15}, staff: [-12, 180]},
    {at: 10, g: {...scoop, chest: -26, lean: -20, head: -25}, staff: [-92, 112]},
    {at: 12, g: {...scoop, chest: -26, lean: -20, head: -25}, staff: [-100, 76]},
    {at: 19, g: {...scoop, chest: -22, lean: -16, head: -20}, staff: [-96, 70]},
    {at: 27, g: {chest: -8, front: -20, knee: 40, back: 10, backKnee: 35}},
  ],
  upTilt: [
    {at: 2, g: dip, staff: [64, 12]},
    {at: 3, g: {...dip, chest: 26}, staff: [84, 16]},
    {at: 4, g: {...dip, chest: 22}, staff: [100, 18]},
    {at: 5, g: {...dip, chest: 14, head: 0}, staff: [112, 22]},
    {at: 6, g: {...rise, chest: 4, head: -5}, staff: [118, 88]},
    {at: 7, g: {...rise, chest: -4}, staff: [92, 150]},
    {at: 8, g: rise, staff: [30, 186]},
    {at: 9, g: {...rise, chest: -16, head: -25}, staff: [-60, 170]},
    {at: 10, g: {...rise, chest: -20, head: -25}, staff: [-100, 104]},
    {at: 15, g: {...rise, chest: -16, head: -20}, staff: [-98, 92]},
    {at: 17, g: {...rise, chest: -10, head: -15}, staff: [-75, 40]},
    {at: 19, g: {...rise, chest: -6, head: -10}, staff: [-40, 20]},
    {at: 20, g: settle, staff: [-10, 16]},
    {at: 21, g: settle, staff: [25, 16]},
    {at: 22, g: settle, staff: [60, 20]},
    {at: 23, g: settle, staff: [95, 30]},
    {at: 24, g: settle, staff: [118, 58]},
    {at: 25, g: settle, staff: [128, 84]},
  ],
};
