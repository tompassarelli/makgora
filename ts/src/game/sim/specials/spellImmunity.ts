import type { Fighter } from "../fighter";
import { NO_HIT_REGION, type HitRegion } from "../hitRegions";
import { isHeroSpecialAction, runningHeroSpecial } from "./runningMove";

/** Whether opponents' specials pass through this fighter: the special it runs names a spell-immune window it is inside. */
export function spellImmune(f: Readonly<Fighter>): boolean {
  if (!isHeroSpecialAction(f.special.action)) return false;
  const window = runningHeroSpecial(f)?.spellImmune;
  return window !== undefined && f.special.frame >= window.first && f.special.frame <= window.last;
}

/** Lets an opponent's special pass through a spell-immune target, leaving a cue for the presentation; false when the target takes it normally. */
export function repelSpell(target: Fighter): boolean {
  if (!spellImmune(target)) return false;
  target.visuals.spellPass++;
  return true;
}

/** The region a special's owner lands on `target`: none when the target is spell-immune. */
export function regionAgainst(region: Readonly<HitRegion>, target: Fighter): Readonly<HitRegion> {
  return region.window > 0 && repelSpell(target) ? NO_HIT_REGION : region;
}
