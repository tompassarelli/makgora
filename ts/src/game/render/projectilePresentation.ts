



import { Character, SpecialAction } from "../sim/codes";
import { FIGHTER_ULTIMATES } from "../sim/ultimates";
import { PROJECTILE_CAPACITY, type Fighter } from "../sim/fighter";
import { heroDefinition } from "../sim/heroes/registry";
import { HERO_PROJECTILE_CAP } from "../sim/heroSpecialRules";
import { f32 } from "wisp/src/sim/f32";
import { PARKED_CUE_TIME_SCALE, type ParkedFlags, type WorldOrigin, parkCue } from "./effects";
import { DEFINITIVE_ULTIMATE_MODELS, PROJECTILE_DRAW_CUES, PROJECTILE_DRAW_OFFSETS, fighterProjectileModels, projectileModelOf, ultimateProjectiles } from "../presentation/projectileArt";
import { projectedProjectile } from "../presentation/projectilePose";
import { IMPACT_DEFILE_MODEL } from "../assets/impactAssetInfo";
import { heroProjectileArt } from "../presentation/projectileArt";
import { definitiveCues } from "./specialCueEffects";

const STATIONARY_PARTICLE_MODELS = [
  "Abilities\\Spells\\Undead\\DeathAndDecay\\DeathAndDecayTarget.mdx",
  "Abilities\\Spells\\Other\\Stampede\\StampedeMissileDeath.mdx",
  "Abilities\\Spells\\Other\\BreathOfFire\\BreathOfFireDamage.mdx",
  "Abilities\\Spells\\NightElf\\TargetArtLumber\\TargetArtLumber.mdx",
  "Objects\\Spawnmodels\\Other\\NeutralBuildingExplosion\\NeutralBuildingExplosion.mdx",
  "Units\\Undead\\PlagueCloud\\PlagueCloud.mdx",
  "Abilities\\Spells\\Other\\CrushingWave\\CrushingWaveDamage.mdx",
  "Objects\\Spawnmodels\\Undead\\ImpaleTargetDust\\ImpaleTargetDust.mdx",
];

// Hidden bolts park below the floor, as hidden effects do: alpha alone left Aimed Shot's bolts on stage after the move (#457).
const PARKED_LINE_DEPTH = 4096.0;

interface Pool {
  readonly path: string;
  readonly drawn: string;

  readonly effects: readonly number[];
  readonly boundaries: readonly number[];
  readonly fills: readonly (readonly number[])[];
}

export class ProjectilePresentation {
  private readonly models: effect[] = [];
  private readonly visible: boolean[] = [];
  private readonly pools: Pool[] = [];

  private readonly assigned: number[] = [];

  private readonly taken: boolean[] = [];
  private readonly serials: number[] = [];
  private readonly specs: (Fighter["projectiles"][number]["spec"])[] = [];
  private readonly lives: number[] = [];
  private parked: ParkedFlags | undefined;
  private readonly definitive: boolean;
  private readonly aimedShot: lightning[] = [];
  private readonly lineShown: boolean[] = [];
  private tracerFrame = 0;
  private tracerX = 0.0;
  private tracerZ = 0.0;
  private tracerEnd = 0.0;
  private tracerFacing = 1;

  constructor(
    character: Character,
    private readonly origin: WorldOrigin,
  ) {
    if (character === Character.rifleman) for (let index = 0; index < 2; index++) {
      const line = AddLightningEx("LEAS", false, origin.x, origin.y, origin.z - PARKED_LINE_DEPTH, origin.x, origin.y, origin.z - PARKED_LINE_DEPTH);
      SetLightningColor(line, 1.0, 0.0, 0.0, 0.0);
      this.aimedShot.push(line);
      this.lineShown.push(false);
    }
    const hero = heroDefinition(character) !== undefined;
    const paths = fighterProjectileModels(character);
    this.definitive = definitiveCues();
    const swaps = this.definitive ? DEFINITIVE_ULTIMATE_MODELS[character] : undefined;
    const ultimateOnly = paths.filter((path, index) => index > 0 && !hero && ultimateProjectiles(character).some((spec) => spec.model === path));
    paths.forEach((path, index) => {

      const trail = ultimateProjectiles(character).some((spec) => spec.model === path && spec.trail !== undefined);
      const size = trail ? PROJECTILE_CAPACITY - HERO_PROJECTILE_CAP : hero ? HERO_PROJECTILE_CAP + 1 : index === 0 ? PROJECTILE_CAPACITY - 4 * ultimateOnly.length : 4;
      const effects: number[] = [];
      const boundaries: number[] = [];
      const fills: number[][] = [];
      const specials = heroDefinition(character)?.specials;

      const drawn = swaps?.[path] ?? path;
      const groundPool = specials !== undefined && heroProjectileArt(specials).some(({ spec }) => spec.model === path && spec.pool !== undefined && spec.pool.growth > 0.0);
      for (let slot = 0; slot < size; slot++) {
        effects.push(this.models.length);
        this.models.push(AddSpecialEffect(drawn, origin.x, origin.y));
        const draw = PROJECTILE_DRAW_OFFSETS[drawn];
        const model = this.models[this.models.length - 1];
        if (model !== undefined && draw?.sequence !== undefined) {
          BlzSetSpecialEffectAnimation(model, draw.sequence);
          BlzSetSpecialEffectTime(model, draw.seconds ?? 0.0);
        }
        this.visible.push(false);
        const fill: number[] = [];
        for (let layer = 0; layer < (draw?.fill?.length ?? 0); layer++) {
          fill.push(this.models.length);
          this.models.push(AddSpecialEffect(drawn, origin.x, origin.y));
          this.visible.push(false);
        }
        fills.push(fill);
        if (groundPool) {
          boundaries.push(this.models.length);
          const boundary = AddSpecialEffect(IMPACT_DEFILE_MODEL, origin.x, origin.y);
          BlzSetSpecialEffectAnimationBlendTime(boundary, 0.0);
          BlzSetSpecialEffectAnimation(boundary, "stand");
          BlzSetSpecialEffectTime(boundary, 0.0);
          this.models.push(boundary);
          this.visible.push(false);
        }
      }
      this.pools.push({ path, drawn, effects, boundaries, fills });
    });
    for (let index = 0; index < PROJECTILE_CAPACITY; index++) this.assigned.push(-1);
    this.clear();
  }


  private hide(model: effect, parked: ParkedFlags, index: number): void {
    parkCue(model, this.origin, parked, index);
  }

  clear(): void {
    this.tracerFrame = 0;
    for (let index = 0; index < this.aimedShot.length; index++) {
      this.lineShown[index] = true;
      this.parkLine(index);
    }
    const parked = (this.parked ??= []);
    for (let index = 0; index < this.models.length; index++) {
      const model = this.models[index];
      if (model === undefined) continue;
      this.visible[index] = false;
      this.hide(model, parked, index);
    }
    for (let index = 0; index < this.assigned.length; index++) this.assigned[index] = -1;
  }





  private poolOf(fighter: Readonly<Fighter>, index: number): Pool | undefined {
    const projectile = fighter.projectiles[index];
    const path = projectile === undefined ? undefined : projectileModelOf(projectile);
    return this.pools.find((pool) => pool.path === path) ?? this.pools[0];
  }


  private effectFor(pool: Pool, index: number, taken: readonly boolean[]): number {
    const kept = this.assigned[index] ?? -1;
    if (kept >= 0 && pool.effects.includes(kept) && taken[kept] !== true) return kept;
    for (const candidate of pool.effects) if (taken[candidate] !== true && !this.assigned.includes(candidate)) return candidate;
    for (const candidate of pool.effects) if (taken[candidate] !== true) return candidate;
    return -1;
  }

  private presentAimedShot(fighter: Readonly<Fighter> | undefined, playing: boolean): void {
    const aim = this.aimedShot[0], trace = this.aimedShot[1];
    if (aim === undefined || trace === undefined) return;
    const ultimate = fighter !== undefined && playing && !fighter.status.out && fighter.special.action === SpecialAction.heroUltimate;
    const frame = ultimate && fighter !== undefined ? fighter.special.frame : 0;
    const shot = FIGHTER_ULTIMATES[Character.rifleman]?.projectiles?.[1];
    if (fighter !== undefined && ultimate && shot !== undefined) {
      const x = fighter.motion.x + fighter.facing * shot.offsetX;
      const z = fighter.motion.z + shot.offsetZ;
      if (frame >= 4 && frame <= 32) {
        MoveLightningEx(aim, false, this.origin.x + x, this.origin.y - 12.0, this.origin.z + z, this.origin.x + x + fighter.facing * 1200.0, this.origin.y - 12.0, this.origin.z + z);
      }
      if (frame >= shot.spawnFrame && frame < shot.spawnFrame + 6) {
        if (this.tracerFrame < shot.spawnFrame || frame < this.tracerFrame) {
          this.tracerX = x;
          this.tracerZ = z;
          this.tracerFacing = fighter.facing;
          this.tracerEnd = Math.abs(shot.velocityX);
        }
        const projectile = fighter.projectiles.find(entry => entry.spec === shot && entry.life > 0);
        if (projectile !== undefined) this.tracerEnd = Math.max(this.tracerEnd, Math.min(360.0, (projectile.x - this.tracerX) * this.tracerFacing));
        MoveLightningEx(trace, false, this.origin.x + this.tracerX, this.origin.y - 12.0, this.origin.z + this.tracerZ, this.origin.x + this.tracerX + this.tracerFacing * this.tracerEnd, this.origin.y - 12.0, this.origin.z + this.tracerZ);
      }
    }
    if (frame >= 4 && frame <= 32) this.showLine(0, 1.0, 0.0, 0.0);
    else this.parkLine(0);
    if (shot !== undefined && frame >= shot.spawnFrame && frame < shot.spawnFrame + 6) this.showLine(1, 1.0, f32(0.75), f32(0.25));
    else this.parkLine(1);
    this.tracerFrame = frame;
  }

  private showLine(index: number, red: number, green: number, blue: number): void {
    const line = this.aimedShot[index];
    if (line === undefined) return;
    SetLightningColor(line, red, green, blue, 1.0);
    this.lineShown[index] = true;
  }

  private parkLine(index: number): void {
    const line = this.aimedShot[index];
    if (line === undefined || this.lineShown[index] !== true) return;
    const { x, y, z } = this.origin;
    MoveLightningEx(line, false, x, y, z - PARKED_LINE_DEPTH, x, y, z - PARKED_LINE_DEPTH);
    SetLightningColor(line, 1.0, 0.0, 0.0, 0.0);
    this.lineShown[index] = false;
  }

  present(fighter: Readonly<Fighter> | undefined, playing: boolean, paused: boolean): void {
    this.presentAimedShot(fighter, playing);
    const parked = (this.parked ??= []);
    const taken = this.taken;
    for (let index = 0; index < this.models.length; index++) taken[index] = false;
    for (let index = 0; index < PROJECTILE_CAPACITY; index++) {
      if (this.aimedShot.length > 0 && fighter?.projectiles[index]?.spec === FIGHTER_ULTIMATES[Character.rifleman]?.projectiles?.[0]) {
        this.assigned[index] = -1;
        continue;
      }
      const pose = projectedProjectile(fighter, index, playing);
      const pool = fighter === undefined || !pose.visible ? undefined : this.poolOf(fighter, index);
      const slot = pool === undefined ? -1 : this.effectFor(pool, index, taken);
      this.assigned[index] = slot;
      const model = this.models[slot];
      if (model === undefined) continue;
      taken[slot] = true;
      parked[slot] = false;
      const projectile = fighter?.projectiles[index];
      const draw = pool === undefined ? undefined : PROJECTILE_DRAW_OFFSETS[pool.drawn];
      const cue = pool === undefined ? undefined : PROJECTILE_DRAW_CUES[pool.drawn];
      const lichKing = fighter?.character === Character.lichKing;
      const risen = lichKing && pool?.path.includes("ImpaleHitTarget") === true;
      const tell = lichKing && pool?.path.includes("AnimateDeadTarget") === true;
      const defile = lichKing && projectile?.spec?.pool !== undefined;
      const born = projectile !== undefined && (this.serials[slot] !== projectile.serial || this.specs[slot] !== projectile.spec || !this.visible[slot]);
      const rebirth = projectile !== undefined && cue?.birth !== undefined && !paused && (born || (cue.birth.eachFrame && this.lives[slot] !== projectile.life));
      if (born && projectile !== undefined && !risen && !tell && !defile) {
        const birth = pool?.path.includes("FreezingBreathMissile") === true || pool?.path.includes("WaterElementalMissile") === true || pool?.path.includes("FrostWyrmMissile") === true;
        if (cue?.birth === undefined) {
          if (draw?.seconds === undefined) BlzSetSpecialEffectAnimation(model, draw?.sequence ?? pose.animationSequence ?? (birth ? "birth" : "stand"));
          BlzSetSpecialEffectTime(model, draw?.seconds ?? 0.0);
        }
        this.serials[slot] = projectile.serial;
        this.specs[slot] = projectile.spec;
      }
      BlzSetSpecialEffectYaw(model, pose.yaw);
      BlzSetSpecialEffectPitch(model, pose.pitch);
      BlzSetSpecialEffectPosition(model, this.origin.x + pose.x + (pose.yaw === 0.0 ? 1 : -1) * (draw?.x ?? 0.0), this.origin.y, this.origin.z + pose.z + (draw?.z ?? 0.0));
      BlzSetSpecialEffectScale(model, pose.modelScale * (cue?.scale ?? 1.0));
      if (draw?.width !== undefined || draw?.height !== undefined) BlzSetSpecialEffectMatrixScale(model, draw.width ?? 1.0, 1.0, draw.height ?? 1.0);
      BlzSetSpecialEffectAlpha(model, 255);
      BlzSetSpecialEffectTimeScale(model, paused ? 0.0 : 1.0);
      if (draw?.seconds !== undefined) {
        BlzSetSpecialEffectTime(model, draw.seconds);
        BlzSetSpecialEffectTimeScale(model, 0.0);
      }
      if (rebirth) {
        BlzSpecialEffectClearSubAnimations(model);
        BlzPlaySpecialEffect(model, ANIM_TYPE_BIRTH);
      }
      if (!paused && projectile !== undefined) this.lives[slot] = projectile.life;
      if (risen) {
        const width = this.definitive ? f32(87.606247) : f32(37.988001);
        const height = this.definitive ? f32(353.993782) : f32(636.061981);
        const centerX = this.definitive ? f32(0.337811) : f32(-0.3387);
        const centerZ = this.definitive
          ? born ? paused ? f32(-198.454501) : f32(-146.291377) : f32(133.889278)
          : born ? f32(-389.412987) : f32(29.882828);
        const scaleX = f32(f32(f32(2.0 * pose.dangerRadius) / width) * (draw?.width ?? 1.0));
        const scaleZ = f32(f32(f32(2.0 * pose.dangerRadius) / height) * (draw?.height ?? 1.0));
        const x = this.origin.x + f32(pose.x - f32(centerX * scaleX));
        const z = this.origin.z + f32(pose.z - f32(centerZ * scaleZ)) + (draw?.z ?? 0.0);
        BlzResetSpecialEffectMatrix(model);
        BlzSetSpecialEffectMatrixScale(model, scaleX, 1.0, scaleZ);
        BlzSetSpecialEffectPosition(model, x, this.origin.y, z);
        const fills = pool?.fills[pool.effects.indexOf(slot)] ?? [];
        for (let index = 0; index < fills.length; index++) {
          const fillSlot = fills[index];
          const fill = fillSlot === undefined ? undefined : this.models[fillSlot];
          const offset = draw?.fill?.[index];
          if (fill === undefined || fillSlot === undefined || offset === undefined) continue;
          taken[fillSlot] = true;
          parked[fillSlot] = false;
          BlzResetSpecialEffectMatrix(fill);
          BlzSetSpecialEffectYaw(fill, pose.yaw);
          BlzSetSpecialEffectMatrixScale(fill, scaleX, 1.0, scaleZ);
          BlzSetSpecialEffectPosition(fill, x + f32(offset.x * pose.dangerRadius), this.origin.y, z + f32(offset.z * pose.dangerRadius));
          BlzSetSpecialEffectScale(fill, pose.modelScale * (cue?.scale ?? 1.0));
          BlzSetSpecialEffectAlpha(fill, 255);
          if (born) BlzSetSpecialEffectAnimation(fill, "birth");
          BlzSetSpecialEffectTime(fill, f32(0.3));
          BlzSetSpecialEffectTimeScale(fill, paused ? 0.0 : this.definitive ? 1.0 : 0.0);
        }
      }
      if (born && projectile !== undefined && (risen || tell || defile)) {
        BlzSetSpecialEffectAnimation(model, "birth");
        this.serials[slot] = projectile.serial;
        this.specs[slot] = projectile.spec;
      }
      if (risen || defile) {
        BlzSetSpecialEffectTime(model, f32(0.3));
        BlzSetSpecialEffectTimeScale(model, paused ? 0.0 : this.definitive ? 1.0 : 0.0);
      } else if (tell && projectile?.spec !== undefined) {
        BlzSetSpecialEffectTime(model, f32((projectile.spec.life - projectile.life) / 60));
      } else if (cue?.birth === undefined && pose.animationSeconds !== undefined) {
        if (!this.visible[slot] && pose.animationSequence !== undefined) BlzSetSpecialEffectAnimation(model, pose.animationSequence);
        BlzSetSpecialEffectTime(model, pose.animationSeconds);
        BlzSetSpecialEffectTimeScale(model, 0.0);
      } else if (cue?.birth === undefined && projectile?.spec !== undefined && projectile.velocityX === 0.0 && projectile.velocityZ === 0.0) {

        if (pool !== undefined && STATIONARY_PARTICLE_MODELS.includes(pool.drawn)) {
          if (born) BlzSetSpecialEffectTime(model, f32(0.3));
        } else {
          BlzSetSpecialEffectTime(model, f32(0.3));
          BlzSetSpecialEffectTimeScale(model, 0.0);
        }
      }
      const boundarySlot = pool?.boundaries[pool.effects.indexOf(slot)];
      const boundary = boundarySlot === undefined ? undefined : this.models[boundarySlot];
      if (boundary !== undefined && boundarySlot !== undefined && pose.dangerRadius > 0.0) {
        taken[boundarySlot] = true;
        parked[boundarySlot] = false;
        BlzSetSpecialEffectPosition(boundary, this.origin.x + pose.x, this.origin.y - 8.0, this.origin.z + pose.z);
        BlzSetSpecialEffectScale(boundary, pose.dangerRadius);
        if (defile) {
          BlzResetSpecialEffectMatrix(boundary);
          BlzSetSpecialEffectMatrixScale(boundary, 1.0, 3.0, 1.0);
          BlzSetSpecialEffectRoll(boundary, f32(Math.PI * 0.5));
        }
        const frost = fighter?.character === Character.lich;
        BlzSetSpecialEffectColor(boundary, frost ? 155 : pose.armed ? 170 + 85 * pose.poolPulse : 70, frost ? 210 : pose.armed ? 75 + 180 * pose.poolPulse : 65, frost ? 255 : pose.armed ? 255 : 100);
        BlzSetSpecialEffectAlpha(boundary, pose.armed ? 255 : 160);
        if (!this.visible[boundarySlot]) BlzSetSpecialEffectTime(boundary, 0.0);
        BlzSetSpecialEffectTimeScale(boundary, 0.0);
      }
    }
    for (let index = 0; index < this.models.length; index++) {
      const model = this.models[index];
      this.visible[index] = taken[index] === true;
      if (model !== undefined && taken[index] !== true) this.hide(model, parked, index);
    }
  }

  setPaused(paused: boolean): void {
    for (let index = 0; index < this.models.length; index++) {
      const model = this.models[index];
      if (model !== undefined) BlzSetSpecialEffectTimeScale(model, paused ? 0.0 : this.visible[index] === true ? 1.0 : PARKED_CUE_TIME_SCALE);
    }
  }

  destroy(): void {
    this.clear();
    for (const model of this.models) DestroyEffect(model);
    for (const line of this.aimedShot) DestroyLightning(line);
    this.aimedShot.length = 0;
    this.lineShown.length = 0;
    this.models.length = 0;
    this.visible.length = 0;
    this.pools.length = 0;
  }
}
