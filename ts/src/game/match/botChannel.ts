import { f32 } from "wisp/src/sim/f32";
import type { Fighter } from "../sim/fighter";
import type { Controls } from "../sim/roster";
import { runningHeroSpecial } from "../sim/specials/engine";
import { decorates } from "../sim/specials/ownedProjectiles";

export function holdChannelOnFoe(f: Readonly<Fighter>, target: Readonly<Fighter> | undefined, input: Controls): void {
  const move = runningHeroSpecial(f);
  if (move?.channel === undefined || target === undefined) return;
  const ahead = f32(f32(target.motion.x - f.motion.x) * f.facing);
  for (const shot of move.projectiles ?? []) {
    if (decorates(shot)) continue;
    const landing = f32(shot.offsetX + f32(shot.velocityX * shot.life));
    if (Math.abs(f32(ahead - landing)) <= f32(shot.radius * 2.0)) {
      input.specialHeld = true;
      return;
    }
  }
}
