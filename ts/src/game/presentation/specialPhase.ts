import type { Fighter } from "../sim/fighter";
import type { HeroClip } from "../sim/heroes/hero";
import { runningHeroSpecial } from "../sim/specials/engine";
import { FOLLOW_UP_FORM, SpecialForm } from "../sim/specials/schema";

export const playsFollowUpPose = (f: Readonly<Fighter>): boolean => f.special.form >= FOLLOW_UP_FORM || f.special.form === SpecialForm.recall;

export const heldStanceSeconds = (f: Readonly<Fighter>, clip: Readonly<HeroClip>): number | undefined =>
  playsFollowUpPose(f) || runningHeroSpecial(f)?.charge === undefined ? undefined : clip.held;
