import type { Fighter } from "../fighter";
import { isHeroSpecialAction, runningHeroSpecial } from "./engine";

export function reflectsProjectiles(f: Readonly<Fighter>): boolean {
  if (!isHeroSpecialAction(f.special.action)) return false;
  const window = runningHeroSpecial(f)?.reflects;
  return window !== undefined && f.special.frame >= window.first && f.special.frame <= window.last;
}
