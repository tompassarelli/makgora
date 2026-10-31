import { f32 } from "wisp/src/sim/f32";
import { meleeAtan2 } from "../core/math/meleeScalarMath";
import { ORBIT_RINGS, ORBIT_RING_CAPACITY, orbitRingStep, orbitShardAngle } from "../presentation/orbitRings";
import type { Character } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import { CUE_FRONT } from "./hitAreaEffects";
import { PARKED_CUE_TIME_SCALE, type ParkedFlags, type WorldOrigin, parkCue } from "./effects";
import { createEffect, destroyEffect, setEffectAlpha, setEffectAnimation, setEffectPitch, setEffectPosition, setEffectScale, setEffectTimeScale, setEffectYaw } from "wisp/game/effects";

const HALF_TURN = f32(3.141592654);

export class OrbitRingEffects {
  private readonly models: effect[] = [];
  private readonly parked: ParkedFlags = [];

  constructor(private readonly character: Character, private readonly origin: WorldOrigin) {
    const ring = ORBIT_RINGS[character];
    if (ring !== undefined) for (let index = 0; index < ORBIT_RING_CAPACITY; index++) this.models.push(createEffect(ring.model, origin.x, origin.y));
    this.clear();
  }

  clear(): void {
    for (let index = 0; index < this.models.length; index++) this.park(index);
  }

  present(fighter: Readonly<Fighter> | undefined, playing: boolean, paused: boolean): void {
    const ring = ORBIT_RINGS[this.character];
    const step = fighter === undefined || !playing || ring === undefined ? undefined : orbitRingStep(fighter);
    if (fighter === undefined || ring === undefined || step === undefined) {
      this.clear();
      return;
    }
    const spun = f32(fighter.attack.frame * fighter.facing);
    for (let shard = 0; shard < this.models.length; shard++) {
      const model = this.models[shard];
      if (model === undefined) continue;
      if (shard >= ring.count) {
        this.park(shard);
        continue;
      }
      const angle = orbitShardAngle(ring, shard, spun);
      const cos = Math.cos(angle), sin = Math.sin(angle);
      const tangentX = f32(-sin * fighter.facing), tangentZ = f32(cos * fighter.facing);
      if (this.parked[shard] === true) setEffectAnimation(model, "stand");
      this.parked[shard] = false;
      setEffectPosition(model, this.origin.x + fighter.motion.x + f32(step.radius * cos), this.origin.y + CUE_FRONT, this.origin.z + fighter.motion.z + ring.centreZ + f32(step.radius * sin));
      setEffectYaw(model, tangentX >= 0.0 ? 0.0 : HALF_TURN);
      setEffectPitch(model, f32(-meleeAtan2(tangentZ, Math.abs(tangentX))));
      setEffectScale(model, f32(ring.shardScale * step.scale));
      setEffectAlpha(model, 255);
      setEffectTimeScale(model, paused ? 0.0 : 1.0);
    }
  }

  setPaused(paused: boolean): void {
    for (let index = 0; index < this.models.length; index++) {
      const model = this.models[index];
      if (model !== undefined) setEffectTimeScale(model, paused ? 0.0 : this.parked[index] === true ? PARKED_CUE_TIME_SCALE : 1.0);
    }
  }

  drawnEffects(into: effect[]): void {
    for (const model of this.models) into.push(model);
  }

  destroy(): void {
    this.clear();
    for (const model of this.models) destroyEffect(model);
    this.models.length = 0;
  }

  private park(index: number): void {
    const model = this.models[index];
    if (model !== undefined) parkCue(model, this.origin, this.parked, index);
  }
}
