import { f32 } from "wisp/src/sim/f32";
import { PARTICIPANT_SLOTS } from "../../game/input/participants";
import { PROJECTILE_DRAW_OFFSETS, projectileModelOf } from "../../game/presentation/projectileArt";
import { PROJECTILE_CAPACITY } from "../../game/sim/fighter";
import { fighterAt, isActive } from "../../game/sim/roster";
import { presentedMatch } from "./presentedMatch";
import type { ShellState } from "./state";
import { views } from "./ui";


export function holdAgeSeekedEffects(s: ShellState): void {
  const { world } = presentedMatch(s);
  for (const slot of PARTICIPANT_SLOTS) {
    const presentation = views(s).fighters[slot]?.projectiles;
    if (presentation === undefined || !isActive(world, slot)) continue;
    const { projectiles } = fighterAt(world, slot);
    for (let index = 0; index < PROJECTILE_CAPACITY; index++) {
      const projectile = projectiles[index];
      const model = presentation.drawnModel(index);
      const path = projectile === undefined ? undefined : projectileModelOf(projectile);
      const draw = path === undefined ? undefined : PROJECTILE_DRAW_OFFSETS[path];
      if (projectile?.spec === undefined || model === undefined || draw?.reseek !== true) continue;
      // Warcraft discards an animation seek in the callback selecting its sequence, so each held callback seeks again.
      BlzSetSpecialEffectTime(model, f32((draw.seconds ?? 0.0) + f32((projectile.spec.life - projectile.life) / 60.0)));
      BlzSetSpecialEffectTimeScale(model, 0.0);
    }
  }
}
