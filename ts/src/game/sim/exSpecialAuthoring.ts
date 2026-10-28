import { f32 } from "wisp/src/sim/f32";
import type { HitEffect } from "./hitRegions";
import type { AuthoredSpecial, SpecialKit, SpecialProjectile } from "./specials/schema";

export function shieldSafeEffect(effect: Readonly<HitEffect>): HitEffect {
  return { ...effect, shieldSafe: true };
}

export interface ExUpgrade {
  readonly damage?: number;
  readonly reach?: number;
  readonly travel?: number;
  readonly durability?: number;
  readonly armorDamage?: number;
  readonly range?: number;
  readonly shieldSafe?: true;
  readonly guardFrames?: number;
}


function upgrader(upgrade: ExUpgrade): (move: AuthoredSpecial) => AuthoredSpecial {
  const damage = upgrade.damage ?? 1.0;
  const reach = upgrade.reach ?? 1.0;
  const travel = upgrade.travel ?? 1.0;
  const range = upgrade.range ?? 1.0;
  const originals: SpecialProjectile[] = [];
  const upgraded: SpecialProjectile[] = [];
  const hit = (effect: Readonly<HitEffect>): HitEffect => ({ ...effect, damage: f32(effect.damage * damage) });
  const safe = (effect: HitEffect): HitEffect => upgrade.shieldSafe === true ? shieldSafeEffect(effect) : effect;
  const projectile = (spec: SpecialProjectile): SpecialProjectile => {
    for (let index = 0; index < originals.length; index++) {
      if (originals[index] === spec) return upgraded[index] ?? spec;
    }
    const result: SpecialProjectile = {
      ...spec, life: Math.round(spec.life * range), radius: f32(spec.radius * reach), modelRadius: spec.modelRadius ?? (reach === 1.0 ? undefined : spec.radius), effect: hit(spec.effect),
      returnEffect: spec.returnEffect === undefined ? undefined : hit(spec.returnEffect),
      pool: spec.pool === undefined ? undefined : { ...spec.pool, growth: f32(spec.pool.growth * reach), maxRadius: f32(spec.pool.maxRadius * reach) },
      burstInto: spec.burstInto === undefined ? undefined : projectile(spec.burstInto),
      expiresInto: spec.expiresInto === undefined ? undefined : projectile(spec.expiresInto),
    };
    originals.push(spec);
    upgraded.push(result);
    return result;
  };
  const exMove = (move: AuthoredSpecial): AuthoredSpecial => {
    const placement = move.placement;
    return {
      ...move,
      regions: move.regions?.map(region => ({ ...region, hit: { ...region.hit,
        minX: f32(region.hit.minX * reach), maxX: f32(region.hit.maxX * reach),
        minZ: f32(region.hit.minZ - f32((region.hit.strike?.radius ?? 0.0) * f32(reach - 1.0))),
        maxZ: f32(region.hit.maxZ + f32((region.hit.strike?.radius ?? 0.0) * f32(reach - 1.0))),
        strike: region.hit.strike === undefined ? undefined : { ...region.hit.strike,
          x1: f32(region.hit.strike.x1 * reach), x2: f32(region.hit.strike.x2 * reach), radius: f32(region.hit.strike.radius * reach) },
        effect: safe(hit(region.hit.effect)), groundedEffect: region.hit.groundedEffect === undefined ? undefined : safe(hit(region.hit.groundedEffect)),
      } })),
      motion: move.motion?.map(motion => ({ ...motion,
        velocityX: f32(motion.velocityX * travel), velocityZ: f32(motion.velocityZ * travel),
        aimedSpeed: motion.aimedSpeed === undefined ? undefined : f32(motion.aimedSpeed * travel),
        driftSpeed: motion.driftSpeed === undefined ? undefined : f32(motion.driftSpeed * travel),
        liftSpeed: motion.liftSpeed === undefined ? undefined : f32(motion.liftSpeed * travel),
        steer: motion.steer === undefined ? undefined : { ...motion.steer,
          launchSpeed: f32(motion.steer.launchSpeed * travel), speed: f32(motion.steer.speed * travel), acceleration: f32(motion.steer.acceleration * travel) },
        relocateReach: motion.relocateReach === undefined ? undefined : f32(motion.relocateReach * travel),
      })),
      projectiles: move.projectiles?.map((each) => projectile(each)),
      beam: move.beam === undefined ? undefined : { ...move.beam, range: f32(f32(move.beam.range * reach) * range) },
      burst: move.burst === undefined ? undefined : { ...move.burst, from: projectile(move.burst.from), into: projectile(move.burst.into) },
      armor: move.armor?.maxDamage === undefined ? move.armor : { ...move.armor, maxDamage: f32(move.armor.maxDamage * (upgrade.armorDamage ?? 1.0)) },
      guard: move.guard === undefined ? undefined : { ...move.guard, last: move.guard.last + (upgrade.guardFrames ?? 0) },
      commandGrab: move.commandGrab === undefined ? undefined : { ...move.commandGrab, effect: hit(move.commandGrab.effect),
        strike: { ...move.commandGrab.strike, x1: f32(move.commandGrab.strike.x1 * reach), x2: f32(move.commandGrab.strike.x2 * reach), radius: f32(move.commandGrab.strike.radius * reach) } },
      placement: placement === undefined ? undefined : { ...placement,
        durability: f32(placement.durability * (upgrade.durability ?? 1.0)),
        shot: placement.shot === undefined ? undefined : projectile(placement.shot),
        companion: placement.companion === undefined ? undefined : { ...placement.companion, biteEffect: hit(placement.companion.biteEffect) },
      },
      followUps: move.followUps?.map(branch => ({ ...branch, special: exMove(branch.special) })),
    };
  };
  return exMove;
}


export function upgradeSpecial(move: AuthoredSpecial, upgrade: ExUpgrade): AuthoredSpecial {
  return upgrader(upgrade)(move);
}


export function withExKit(kit: SpecialKit, upgrade: ExUpgrade): SpecialKit {
  const exMove = upgrader(upgrade);
  const withEx = (move: AuthoredSpecial): AuthoredSpecial => {
    const base = { ...move };
    base.variants = undefined;
    return move.variants === undefined
      ? { ...move, ex: exMove(base) }
      : { ...move, ex: exMove(base), variants: move.variants.map(variant => ({ ...variant, ex: exMove(variant) })) };
  };
  const form = (move: AuthoredSpecial | undefined): AuthoredSpecial | undefined =>
    move === undefined ? undefined : withEx(move);
  return {
    ...kit, ground: withEx(kit.ground),
    air: form(kit.air), recall: form(kit.recall),
  };
}
