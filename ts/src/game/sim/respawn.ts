import { respawnFighterFields } from "../../generated/state/fighterState";
import { restCannon, restFreezeTrap, restWater } from "./fighterRest";
import { setWorldMotionValue } from "./motion";
import { type Roster, fighterAt } from "./roster";
import { clearGrabLinks, clearSpecialOnStock } from "./transitions";

export function respawnFighter(world: Roster, slot: number, startX: number): void {
  const f = fighterAt(world, slot);
  clearGrabLinks(world, slot);
  clearSpecialOnStock(f);
  restCannon(f);
  restWater(f);
  restFreezeTrap(f);
  respawnFighterFields(f, startX);
  setWorldMotionValue(f.motion.meleeX, f.motion.x);
  setWorldMotionValue(f.motion.meleeZ, f.motion.z);
}
