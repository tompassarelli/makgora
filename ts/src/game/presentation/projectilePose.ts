import { f32 } from "wisp/src/sim/f32";
import type { Fighter, Projectile } from "../sim/fighter";
import { heroProjectileRadius, projectileActive } from "../sim/projectiles";
import { ProjectileKind } from "../sim/codes";
import type { SpecialProjectile } from "../sim/specials/schema";
import { meleeAtan2 } from "../core/math/meleeScalarMath";
import { reflectsProjectiles } from "../sim/specials/reflector";
import { PROJECTILE_DRAW_OFFSETS } from "./projectileArt";

interface ProjectilePose {
  visible: boolean;
  x: number;
  z: number;
  yaw: number;
  pitch: number;

  poolRadius: number;
  dangerRadius: number;
  armed: boolean;
  poolPulse: number;
  poolSince: number;
  modelScale: number;
  modelZ: number;
  burning: number;
  animationSequence?: string | undefined;
  animationSeconds?: number | undefined;
  gait?: number | undefined;
}


const HIDDEN: Readonly<ProjectilePose> = { visible: false, x: 0.0, z: 0.0, yaw: 0.0, pitch: 0.0, poolRadius: 0.0, dangerRadius: 0.0, armed: false, poolPulse: 0.0, poolSince: -1, modelScale: 1.0, modelZ: 0.0, burning: 0.0 };


export const projectileModelScale = (radius: number, spec: Readonly<SpecialProjectile>): number => spec.modelRadius === undefined ? 1.0 : f32(radius / spec.modelRadius);

export function projectedProjectile(fighter: Readonly<Fighter> | undefined, index: number, playing: boolean): Readonly<ProjectilePose> {
  const projectile = fighter?.projectiles[index];
  if (!playing || fighter === undefined || projectile === undefined || fighter.status.out || !projectileActive(fighter, index)) {
    return HIDDEN;
  }
  const { velocityX, velocityZ } = projectile;
  const spec = projectile.kind === ProjectileKind.hero ? projectile.spec : undefined;
  if (spec?.model !== undefined && PROJECTILE_DRAW_OFFSETS[spec.model]?.whileReflecting === true && !reflectsProjectiles(fighter)) return HIDDEN;
  const radius = spec?.pool === undefined ? 0.0 : heroProjectileRadius(projectile, spec);
  const age = spec === undefined ? 0 : spec.life - projectile.life;
  const first = spec?.activeFrom ?? 0;
  const armed = spec !== undefined && age >= first;
  if (spec?.runs !== undefined) return runnerPose(projectile, spec, armed);
  const animation = spec?.modelAnimation;
  const animationSeconds = animation === undefined ? undefined : armed
    ? f32(animation.activeSeconds + f32(f32((age - first) / 60) * (animation.rate ?? 1.0)))
    : f32(animation.warningSeconds + f32(f32(Math.max(0, age - 1) / 60) * (animation.rate ?? 1.0)));
  return {
    visible: true,
    x: projectile.x,
    z: projectile.z,
    yaw: velocityX >= 0.0 ? 0.0 : f32(3.141592654),
    pitch: velocityX === 0.0 && velocityZ === 0.0 ? 0.0 : -meleeAtan2(velocityZ, Math.abs(velocityX)),
    poolRadius: radius,
    dangerRadius: spec === undefined ? 0.0 : heroProjectileRadius(projectile, spec),
    armed,
    poolPulse: spec?.pool === undefined || projectile.poolHits === 0 ? 0.0
      : f32(Math.max(0.0, f32((projectile.poolWait - (spec.pool.every - 13)) / 12.0))),
    poolSince: spec?.pool === undefined ? -1 : projectile.poolHits > 0 ? spec.pool.every - 1 - projectile.poolWait : age - first,
    modelScale: spec === undefined ? 1.0 : projectileModelScale(heroProjectileRadius(projectile, spec), spec),
    modelZ: f32(projectile.z + (spec?.modelOffsetZ ?? 0.0)),
    burning: spec?.expiresInto === undefined || (spec.activeFrom ?? 0) < spec.life ? 0.0 : f32(age / spec.life),
    animationSequence: animation?.sequence,
    animationSeconds,
  };
}

const BITE_SEQUENCE = "attack - 1";
const BITE_SECONDS = f32(0.667);
const RUN_SEQUENCE = "walk";

function runnerPose(projectile: Readonly<Projectile>, spec: Readonly<SpecialProjectile>, armed: boolean): Readonly<ProjectilePose> {
  const biting = projectile.poolWait > 0 && spec.bites !== undefined;
  const every = spec.bites?.every ?? 1;
  return {
    visible: true, x: projectile.x, z: projectile.z,
    yaw: projectile.direction >= 0 ? 0.0 : f32(3.141592654), pitch: 0.0,
    poolRadius: 0.0, dangerRadius: heroProjectileRadius(projectile, spec), armed, poolPulse: 0.0, poolSince: -1,
    modelScale: projectileModelScale(heroProjectileRadius(projectile, spec), spec),
    modelZ: f32(projectile.z + (spec.modelOffsetZ ?? 0.0)), burning: 0.0,
    animationSequence: biting ? BITE_SEQUENCE : RUN_SEQUENCE,
    animationSeconds: biting ? f32(f32(BITE_SECONDS * f32(every - projectile.poolWait)) / every) : undefined,
    gait: biting ? undefined : f32(Math.abs(projectile.velocityX) * 60.0),
  };
}
