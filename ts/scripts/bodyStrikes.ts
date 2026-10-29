import type { Fighter } from "../src/game/sim/fighter";
import { runningHeroSpecial } from "../src/game/sim/specials/engine";

export function specialBodyStrikes(f: Readonly<Fighter>): boolean {
  const move = runningHeroSpecial(f);
  if (move === undefined || move.commandGrab !== undefined) return true;
  const frame = f.special.frame - 1;
  for (const region of move.regions ?? []) if (frame >= region.firstFrame && frame <= region.lastFrame + 1) return true;
  return false;
}
