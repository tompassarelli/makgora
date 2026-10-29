import { f32 } from "wisp/src/sim/f32";
import type { Fighter } from "../sim/fighter";
import type { HeroClip } from "../sim/heroes/hero";
import { runningHeroSpecial } from "../sim/specials/runningMove";
import { FOLLOW_UP_FORM, SpecialForm } from "../sim/specials/schema";

export const playsFollowUpPose = (f: Readonly<Fighter>): boolean => f.special.form >= FOLLOW_UP_FORM || f.special.form === SpecialForm.recall;

export function pinnedSpecialSeconds(f: Readonly<Fighter>, clip: Readonly<HeroClip>): number | undefined {
  if (playsFollowUpPose(f)) return undefined;
  const move = runningHeroSpecial(f);
  if (move?.channel !== undefined) return f32(f32(f.special.frame * clip.seconds) / move.endFrame);
  return move?.charge === undefined ? undefined : clip.held;
}
