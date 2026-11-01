import { f32 } from "wisp/src/sim/f32";
import { max } from "../core/numbers";
import type { Projectile } from "./fighter";
import type { SpecialProjectile } from "./specials/schema";
import { floorBelow } from "./stage";

const STANDING_TOLERANCE = 1.0;

const footOf = (projectile: Readonly<Projectile>, spec: Readonly<SpecialProjectile>): number => f32(projectile.z - spec.radius);

export function runnerStanding(projectile: Readonly<Projectile>, spec: Readonly<SpecialProjectile>, stage: number, matchFrame: number): boolean {
  const foot = footOf(projectile, spec);
  const floor = floorBelow(stage, matchFrame, projectile.x, f32(foot + STANDING_TOLERANCE));
  return floor !== undefined && floor >= f32(foot - STANDING_TOLERANCE);
}

export function startRunnerStep(projectile: Projectile, spec: Readonly<SpecialProjectile>, stage: number, matchFrame: number): boolean {
  const run = spec.runs;
  if (run === undefined) return false;
  projectile.velocityX = projectile.poolWait > 0 ? 0.0 : f32(projectile.direction * Math.abs(spec.velocityX));
  const standing = runnerStanding(projectile, spec, stage, matchFrame);
  projectile.velocityZ = standing ? 0.0 : max(-run.maxFall, f32(projectile.velocityZ - run.gravity));
  return standing;
}

export function finishRunnerStep(projectile: Projectile, spec: Readonly<SpecialProjectile>, stage: number, matchFrame: number, oldZ: number, standing: boolean): void {
  const climb = Math.abs(projectile.velocityX);
  const oldFoot = f32(oldZ - spec.radius);
  const foot = footOf(projectile, spec);
  const floor = floorBelow(stage, matchFrame, projectile.x, f32(max(oldFoot, foot) + climb));
  if (floor === undefined) return;
  const reach = standing ? f32(foot - climb - STANDING_TOLERANCE) : foot;
  if (floor < reach) return;
  projectile.z = f32(floor + spec.radius);
  projectile.velocityZ = 0.0;
}
