import { f32 } from "wisp/src/sim/f32";
import { Character, ProjectileKind } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import { projectileActive } from "../sim/projectiles";
import { HOOK_MODEL, HOOK_REACH } from "../fighters/butcher/specials";

export const HOOK_LINK_MODEL = "Doodads\\Dungeon\\Props\\Chain\\Chain0.mdx";
export const HOOK_LINK_LENGTH = 71.5;
export const HOOK_LINK_PITCH = 1.0;
export const HOOK_LINK_SPACING = 48.0;
export const HOOK_LINK_SCALE = f32(HOOK_LINK_SPACING / HOOK_LINK_LENGTH);
export const HOOK_LINK_COUNT = Math.ceil(HOOK_REACH / HOOK_LINK_SPACING) + 2;
export const HOOK_HAND = { x: 40.0, z: 80.0 } as const;
const HELD_BODY_Z = 50.0;

export interface HookChainSpan {
  fromX: number;
  fromZ: number;
  toX: number;
  toZ: number;
}

export const emptyHookChainSpan = (): HookChainSpan => ({ fromX: 0.0, fromZ: 0.0, toX: 0.0, toZ: 0.0 });

/** The chain runs from his hand to the hook in flight, then to the foe it reels in; presentation only, read from the live fighters. */
export function hookChainSpan(owner: Readonly<Fighter> | undefined, held: Readonly<Fighter> | undefined, out: HookChainSpan): boolean {
  if (owner === undefined || owner.character !== Character.butcher || owner.status.out) return false;
  out.fromX = f32(owner.motion.x + f32(owner.facing * HOOK_HAND.x));
  out.fromZ = f32(owner.motion.z + HOOK_HAND.z);
  for (let index = 0; index < owner.projectiles.length; index++) {
    const projectile = owner.projectiles[index];
    if (projectile === undefined || projectile.kind !== ProjectileKind.hero || projectile.spec?.model !== HOOK_MODEL || !projectileActive(owner, index)) continue;
    out.toX = projectile.x;
    out.toZ = projectile.z;
    return true;
  }
  if (held === undefined || held.grab.owner === undefined || held.grab.reel <= 0) return false;
  out.toX = held.motion.x;
  out.toZ = f32(held.motion.z + HELD_BODY_Z);
  return true;
}
