import { f32 } from "wisp/src/sim/f32";
import { PARTICIPANT_CAPACITY } from "../input/participants";
import type { Capsule } from "../sim/geometry/contactGeometry";
import type { Fighter } from "../sim/fighter";
import { type Roster, fighterAt, isActive } from "../sim/roster";
import type { SpecialBeam } from "../sim/specials/specialBeam";
import { BEAM_TARGET_HEIGHT, beamSegment } from "../sim/specials/heroContact";

/** Chain Lightning's drawn bolt: his hand to the farthest body the cast has hit, so it ends on what it struck; with no hit it keeps the beam's full reach. Presentation only, read from the live fighters. */
export function chainBoltSegment(out: Capsule, owner: Readonly<Fighter>, world: Roster, beam: Readonly<SpecialBeam>, radius: number): Capsule {
  beamSegment(out, owner, beam, radius);
  let farthest = -1.0;
  for (let entry = 0; entry < PARTICIPANT_CAPACITY; entry++) {
    const slot = owner.special.hitTargets[entry];
    if (slot === undefined || !isActive(world, slot)) continue;
    const target = fighterAt(world, slot);
    const dx = f32(target.motion.x - out.x1);
    const dz = f32(f32(target.motion.z + BEAM_TARGET_HEIGHT) - out.z1);
    const squared = f32(f32(dx * dx) + f32(dz * dz));
    if (squared <= farthest) continue;
    farthest = squared;
    out.x2 = target.motion.x;
    out.z2 = f32(target.motion.z + BEAM_TARGET_HEIGHT);
  }
  return out;
}
