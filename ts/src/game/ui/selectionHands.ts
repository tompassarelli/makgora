import { f32 } from "wisp/src/sim/f32";
import { floorDiv } from "wisp/src/sim/intMath";
import { ALPHABET } from "../input/wire";
import { type MatchState, humanPresent } from "../lobby/lobbyState";
import { HAND_STATES, type HandState } from "../menu/selectionDrag";
import { PARTICIPANT_SLOTS, type Slots } from "../input/participants";
import { slotColor } from "./slotColors";

export interface HandPose {
  readonly state: HandState | undefined;
  readonly chip: number | undefined;
  readonly x: number;
  readonly y: number;
}

export interface DrawnHand {
  readonly slot: number;
  readonly pose: HandPose & { readonly state: HandState };
  readonly badge: string;
  readonly colour: number;
}

export const handBadge = (slot: number): string => `P${slot + 1}`;

export const HIDDEN_HAND: HandPose = { state: undefined, chip: undefined, x: 0.0, y: 0.0 };

export const HAND_UPDATES_PER_SECOND = 15;
export const HAND_SEND_INTERVAL = f32(1.0 / HAND_UPDATES_PER_SECOND);

const RANGE_MIN = f32(-0.4);
const RANGE_MAX = f32(1.2);
const STEP = 1000;
const NO_CHIP = 4;

const clamp = (value: number): number => Math.min(RANGE_MAX, Math.max(RANGE_MIN, value));
const quantised = (value: number): number => Math.floor((clamp(value) - RANGE_MIN) * STEP + 0.5);
const dequantised = (value: number): number => f32(f32(value / STEP) + RANGE_MIN);
const digits = (value: number): string => ALPHABET.charAt(value & 63) + ALPHABET.charAt(floorDiv(value, 64) & 63);
const digitsAt = (data: string, offset: number): number => ALPHABET.indexOf(data.charAt(offset)) + ALPHABET.indexOf(data.charAt(offset + 1)) * 64;

export function encodeHand(pose: HandPose): string {
  if (pose.state === undefined) return "00" + "0000";
  const state = HAND_STATES.indexOf(pose.state) + 1;
  return `${ALPHABET.charAt(state)}${ALPHABET.charAt(pose.chip ?? NO_CHIP)}${digits(quantised(pose.x))}${digits(quantised(pose.y))}`;
}

export function decodeHand(data: string): HandPose | undefined {
  if (data.length !== 6) return undefined;
  const state = ALPHABET.indexOf(data.charAt(0));
  const chip = ALPHABET.indexOf(data.charAt(1));
  if (state < 0 || state > HAND_STATES.length || chip < 0 || chip > NO_CHIP) return undefined;
  if (state === 0) return HIDDEN_HAND;
  const x = digitsAt(data, 2);
  const y = digitsAt(data, 4);
  if (x < 0 || y < 0) return undefined;
  const handState = HAND_STATES[state - 1];
  return handState === undefined ? undefined : { state: handState, chip: chip === NO_CHIP ? undefined : chip, x: dequantised(x), y: dequantised(y) };
}

// A hand's glide runs one send interval, so the next update arrives about as the last one settles.
interface Glide {
  from: HandPose;
  to: HandPose;
  since: number;
}

const glideAt = ({ from, to, since }: Readonly<Glide>, now: number): HandPose => {
  if (to.state === undefined || from.state === undefined) return to;
  const share = Math.min(1.0, Math.max(0.0, f32(f32(now - since) / HAND_SEND_INTERVAL)));
  return { state: to.state, chip: to.chip, x: f32(from.x + f32(f32(to.x - from.x) * share)), y: f32(from.y + f32(f32(to.y - from.y) * share)) };
};

// One client's view of the select hands: its own pose goes out through `send`, the others' come in through `receive`.
export class SelectionHands {
  private lastSent = encodeHand(HIDDEN_HAND);
  private sentAt = 0.0;
  private readonly glides: Glide[] = PARTICIPANT_SLOTS.map(() => ({ from: HIDDEN_HAND, to: HIDDEN_HAND, since: 0.0 }));

  constructor(private readonly localSlot: number) {}

  // The sync payload to send now, or undefined when the pose is unchanged or the last send is under one interval old.
  send(pose: HandPose, now: number): string | undefined {
    const data = encodeHand(pose);
    if (data === this.lastSent || now - this.sentAt < HAND_SEND_INTERVAL) return undefined;
    this.lastSent = data;
    this.sentAt = now;
    return data;
  }

  receive(sender: number, data: string, now: number): void {
    const glide = this.glides[sender];
    const pose = decodeHand(data);
    if (glide === undefined || pose === undefined || sender === this.localSlot) return;
    glide.from = glideAt(glide, now);
    glide.to = pose;
    glide.since = now;
  }

  // Where each connected human's hand is drawn; the local hand is the mouse's own pose with no glide.
  drawn(game: Readonly<MatchState>, local: HandPose, now: number): DrawnHand[] {
    const hands: DrawnHand[] = [];
    for (const slot of PARTICIPANT_SLOTS) {
      const glide = this.glides[slot];
      const pose = slot === this.localSlot ? local : glide === undefined ? HIDDEN_HAND : glideAt(glide, now);
      if (pose.state === undefined || !humanPresent(game, slot)) continue;
      hands.push({ slot, pose: { ...pose, state: pose.state }, badge: handBadge(slot), colour: slotColor(slot).rgb });
    }
    return hands;
  }

  // Remote hands carrying a chip, by the chip's slot, for the cards to draw it at the hand.
  carriedChips(game: Readonly<MatchState>, now: number): Slots<HandPose | undefined> {
    const carried: Slots<HandPose | undefined> = [undefined, undefined, undefined, undefined];
    for (const { slot, pose } of this.drawn(game, HIDDEN_HAND, now)) {
      if (slot !== this.localSlot && pose.state === "pinch" && pose.chip !== undefined) carried[pose.chip] = pose;
    }
    return carried;
  }
}
