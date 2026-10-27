import { f32 } from "wisp/src/sim/f32";
import { min } from "../core/numbers";
import { inGrabContext, isIntangible } from "./conditions";
import { placedObject } from "./fighter";
import { type Roster, fighterAt, isActive } from "./roster";
import { canHit } from "./teams";
import { PARTICIPANT_CAPACITY } from "../input/participants";


/** How far foes' taunting objects draw this fighter this frame; a launched, grabbed or intangible fighter is not drawn. */
export function tauntPull(world: Roster, slot: number): number {
  const f = fighterAt(world, slot);
  if (f.status.out || f.launch.hitstun > 0 || f.launch.hitlag > 0 || inGrabContext(f) || isIntangible(f)) return 0.0;
  let pull = 0.0;
  for (let ownerSlot = 0; ownerSlot < PARTICIPANT_CAPACITY; ownerSlot++) {
    if (!canHit(world, ownerSlot, slot) || !isActive(world, ownerSlot)) continue;
    const owner = fighterAt(world, ownerSlot);
    if (owner.status.out) continue;
    for (let animal = 0; animal <= owner.pack.length; animal++) {
      const placed = placedObject(owner, animal);
      const spec = placed.spec;
      const taunt = spec?.taunt;
      if (taunt === undefined || placed.life <= (spec?.crumble ?? 0)) continue;
      const dx = f32(placed.x - f.motion.x);
      if (Math.abs(dx) > taunt.radius || Math.abs(f32(f.motion.z - placed.z)) > taunt.radius) continue;
      const step = min(taunt.pull, Math.abs(dx));
      pull = f32(pull + (dx < 0.0 ? -step : step));
    }
  }
  return pull;
}
