import { f32 } from "wisp/src/sim/f32";
import { floorMod, idiv } from "wisp/src/sim/intMath";
import { max, min } from "../core/numbers";
import { Character, SpecialAction } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import { FOLLOW_UP_FORM } from "../sim/specials/schema";
import { GOLD_SACK_CHARGE, GOLD_SACK_FIRST_ACTIVE } from "../fighters/peon/specials";
import { PEON_CLIPS } from "../fighters/peon/clips";
import { FRAME_SECONDS } from "./frameClock";

export const GOLD_SACK_WINDUP_SECONDS = f32(0.25);
export const GOLD_SACK_STRIKE_SECONDS = f32(0.283);
export const GOLD_SACK_GLOW = { red: 255, green: 190, blue: 30 } as const;
const GOLD_SACK_END_SECONDS = PEON_CLIPS.neutralSpecial.seconds;
const WINDUP_FRAMES = GOLD_SACK_CHARGE.hold + GOLD_SACK_CHARGE.full;
const HANDFUL_FRAMES = idiv(GOLD_SACK_CHARGE.full, GOLD_SACK_CHARGE.stages);
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

const windup = (frames: number): number =>
  f32(GOLD_SACK_WINDUP_SECONDS * min(1.0, f32(frames / WINDUP_FRAMES)));

const between = (from: number, to: number, done: number, total: number): number =>
  f32(from + f32(f32(to - from) * min(1.0, f32(max(0, done) / max(1, total)))));

export function goldSackClipTime(fighter: Readonly<Fighter>): number | undefined {
  if (!goldSackMove(fighter)) return undefined;
  const { frame, charge, duration } = fighter.special;
  const stage = bonkStage(fighter);
  if (stage < 0) return windup(min(frame, GOLD_SACK_CHARGE.hold) + charge);
  if (stage > GOLD_SACK_CHARGE.stages) return undefined;
  const first = GOLD_SACK_FIRST_ACTIVE[stage] ?? 12;
  const start = windup(GOLD_SACK_CHARGE.hold + stage * HANDFUL_FRAMES);
  if (frame <= first) return between(start, GOLD_SACK_STRIKE_SECONDS, frame - 1, first - 1);
  return between(GOLD_SACK_STRIKE_SECONDS, GOLD_SACK_END_SECONDS, frame - first, duration - first);
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
  return time === undefined ? undefined : scrubbed(bonkStage(fighter) < 0 ? "gold-sack-charge" : "gold-sack-bonk", PEON_CLIPS.neutralSpecial.index, time);
}
