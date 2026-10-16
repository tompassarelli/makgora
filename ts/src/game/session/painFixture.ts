import { mutableProjectile } from "../sim/fighterProjectiles";
import { f32 } from "wisp/src/sim/f32";
import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import { at } from "wisp/src/runtime/lookup";
import { type HurtPart, fighterHurtParts, fighterHurtboxes } from "../sim/hurtboxes";
import { hurtCapsule } from "../sim/geometry/contactGeometry";
import { AttackStyle, ProjectileKind } from "../sim/codes";
import { type Roster, fighterAt, isActive } from "../sim/roster";
import type { Scenario } from "./build";

export const PAIN_SCENARIOS: readonly Scenario[] = [
  "pain-low-small", "pain-low-medium", "pain-low-large", "pain-middle-small", "pain-middle-medium", "pain-middle-large", "pain-high-small", "pain-high-medium", "pain-high-large",
];


const LOW_CUT = 0.375, HIGH_CUT = 0.75;


function extents(parts: readonly HurtPart[]): { bottom: number; top: number } {
  let bottom = 0.0, top = 0.0;
  for (const part of parts) {
    bottom = Math.min(bottom, f32(Math.min(part.z1, part.z2) - part.radius));
    top = Math.max(top, f32(Math.max(part.z1, part.z2) + part.radius));
  }
  return { bottom, top };
}


function contactHeight(target: Parameters<typeof fighterHurtParts>[0], height: number): number {
  const stand = extents(fighterHurtParts(target));
  const fallback = f32(stand.bottom + f32(f32(stand.top - stand.bottom) * at([0.1875, 0.5625, 0.875], height)));
  let lo = stand.bottom, hi = stand.top;
  const sets = [fighterHurtParts(target), ...(fighterHurtboxes(target).attacks[AttackStyle.jab] ?? []).map(pose => pose.parts)];
  for (const parts of sets) {
    const { bottom, top } = extents(parts), span = top - bottom;
    const low = bottom + span * LOW_CUT, high = bottom + span * HIGH_CUT;
    if (height === 0) hi = Math.min(hi, low);
    else if (height === 1) { lo = Math.max(lo, low); hi = Math.min(hi, high); }
    else { lo = Math.max(lo, high); hi = Math.min(hi, top); }
  }
  return fallback >= lo && fallback < hi || lo >= hi ? fallback : f32((lo + hi) * 0.5);
}


export function initializePainScenario(scenario: Scenario, world: Roster): boolean {
  const category = PAIN_SCENARIOS.indexOf(scenario);
  if (category < 0) return false;
  if (!isActive(world, 0) || !isActive(world, 1)) return true;
  const height = floorDiv(category, 3);
  const strength = floorMod(category, 3);
  for (const owner of [0, 1]) {
    const target = fighterAt(world, 1 - owner);
    const contact = contactHeight(target, height);

    const body = hurtCapsule(target.character);
    const radius = f32(Math.max(1.0, f32(contact - f32(body.z2 + body.radius)) + 1.0, f32(f32(body.z1 - body.radius) - contact) + 1.0));
    const projectile = mutableProjectile(fighterAt(world, owner), 0);
    projectile.kind = ProjectileKind.hero;
    projectile.visualFamily = fighterAt(world, owner).character;
    projectile.life = 180;
    projectile.x = target.motion.x;
    projectile.z = f32(target.motion.z + contact);
    projectile.direction = owner === 0 ? 1 : -1;
    projectile.serial = 1;
    projectile.damageMultiplier = 1.0;
    projectile.spec = {
      spawnFrame: 0, offsetX: 0.0, offsetZ: 0.0, velocityX: 0.0, velocityZ: 0.0,
      life: 180, radius, activeFrom: 150, reflectable: false, limit: 1,
      effect: { damage: 8.0, growth: 0.0, base: at([20.0, 100.0, 240.0], strength), launchX: 0.0, launchZ: 1.0, electric: false },
    };
  }
  return true;
}
