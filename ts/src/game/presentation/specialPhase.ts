import { f32 } from "wisp/src/sim/f32";
import type { Fighter } from "../sim/fighter";
import type { HeroClip } from "../sim/heroes/hero";
import { runningHeroSpecial } from "../sim/specials/runningMove";
import { FOLLOW_UP_FORM, SpecialForm } from "../sim/specials/schema";
import { min } from "../core/numbers";

export const playsFollowUpPose = (f: Readonly<Fighter>): boolean => f.special.form >= FOLLOW_UP_FORM || f.special.form === SpecialForm.recall;

export function pinnedSpecialSeconds(f: Readonly<Fighter>, clip: Readonly<HeroClip>): number | undefined {
  if (playsFollowUpPose(f)) return undefined;
  const move = runningHeroSpecial(f);
  if (move?.channel !== undefined) return f32(f32(f.special.frame * clip.seconds) / move.endFrame);
  return move?.charge === undefined ? undefined : clip.held;
}

export function windUpRate(f: Readonly<Fighter>, clip: Readonly<HeroClip>): number | undefined {
  if (clip.windUpRate === undefined || playsFollowUpPose(f)) return undefined;
  const charge = runningHeroSpecial(f)?.charge;
  return charge === undefined ? undefined : f32(1.0 + f32(f32(clip.windUpRate - 1.0) * f32(min(f.special.charge, charge.full) / charge.full)));
}
