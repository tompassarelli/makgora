import { f32 } from "wisp/src/sim/f32";
import { floorMod, idiv } from "wisp/src/sim/intMath";
import { at } from "wisp/src/runtime/lookup";
import { max, min } from "../core/numbers";
import { Character, SpecialAction } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import { FOLLOW_UP_FORM } from "../sim/specials/schema";
import { GOLD_SACK_CHARGE, GOLD_SACK_FIRST_ACTIVE } from "../fighters/peon/specials";
import { GOLD_SACK_BONK_CLIPS, GOLD_SACK_BONK_FRAMES, GOLD_SACK_CHARGE_CLIP, GOLD_SACK_STRIKE_FRAME } from "../fighters/peon/goldSackClips";
import { PEON_CLIPS } from "../fighters/peon/clips";
import { FRAME_SECONDS } from "./frameClock";

export const GOLD_SACK_GLOW = { red: 255, green: 190, blue: 30 } as const;
const CHARGE_FRAMES = GOLD_SACK_CHARGE.hold + GOLD_SACK_CHARGE.full;
const FULL_PULSE_FRAMES = 6;
const PEON_REST_JOLT_SECONDS = f32(0.2);
const PEON_REST_ASLEEP_SECONDS = f32(1.4);

export interface PeonSpecialPose {
  key: string;
  clip: number;
  time: number;
}

const scratch: PeonSpecialPose = { key: "", clip: 0, time: 0.0 };

const goldSackMove = (fighter: Readonly<Fighter>): boolean =>
  fighter.character === Character.peon && fighter.special.action === SpecialAction.heroNeutral && !fighter.status.out;

const bonkStage = (fighter: Readonly<Fighter>): number =>
  fighter.special.form >= FOLLOW_UP_FORM ? idiv(fighter.special.form, FOLLOW_UP_FORM) - 1 : -1;

const clipSeconds = (frames: number): number => f32(frames * FRAME_SECONDS);

export function goldSackBonkFrame(frame: number, first: number): number {
  if (frame <= first) return f32(f32(max(0, frame) * GOLD_SACK_STRIKE_FRAME) / first);
  return min(GOLD_SACK_BONK_FRAMES, GOLD_SACK_STRIKE_FRAME + frame - first);
}

export function goldSackClipTime(fighter: Readonly<Fighter>): number | undefined {
  if (!goldSackMove(fighter)) return undefined;
  const { frame, charge } = fighter.special;
  const stage = bonkStage(fighter);
  if (stage < 0) return clipSeconds(min(CHARGE_FRAMES, min(frame, GOLD_SACK_CHARGE.hold) + charge));
  if (stage > GOLD_SACK_CHARGE.stages) return undefined;
  return clipSeconds(goldSackBonkFrame(frame, GOLD_SACK_FIRST_ACTIVE[stage] ?? GOLD_SACK_STRIKE_FRAME));
}

export function goldSackGlowAlpha(fighter: Readonly<Fighter>): number {
  if (!goldSackMove(fighter)) return 0;
  const { frame, charge } = fighter.special;
  const stage = bonkStage(fighter);
  if (stage < 0) return charge >= GOLD_SACK_CHARGE.full ? floorMod(frame, FULL_PULSE_FRAMES) < FULL_PULSE_FRAMES / 2 ? 230 : 120 : 0;
  const first = GOLD_SACK_FIRST_ACTIVE[stage];
  return first !== undefined && frame >= first && frame < first + 3 ? 230 : 0;
}

export function peonRestClipTime(frame: number): number {
  return min(PEON_REST_ASLEEP_SECONDS, f32(PEON_REST_JOLT_SECONDS + f32(max(0, frame - 1) * FRAME_SECONDS)));
}

function scrubbed(key: string, clip: number, time: number): Readonly<PeonSpecialPose> {
  scratch.key = key;
  scratch.clip = clip;
  scratch.time = time;
  return scratch;
}

export function peonSpecialPose(fighter: Readonly<Fighter>): Readonly<PeonSpecialPose> | undefined {
  if (fighter.character !== Character.peon) return undefined;
  if (fighter.special.action === SpecialAction.heroDown) return scrubbed("rest", PEON_CLIPS.ko.index, peonRestClipTime(fighter.special.frame));
  const time = goldSackClipTime(fighter);
  const stage = bonkStage(fighter);
  return time === undefined ? undefined : stage < 0 ? scrubbed("special-gold-sack-charge", GOLD_SACK_CHARGE_CLIP.index, time) : scrubbed("special-gold-sack-bonk", at(GOLD_SACK_BONK_CLIPS, stage).index, time);
}
