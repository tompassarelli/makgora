



import { Character, SpecialAction } from "../sim/codes";
import { FIGHTER_ULTIMATES } from "../sim/ultimates";
import { PROJECTILE_CAPACITY, type Fighter } from "../sim/fighter";
import { heroDefinition } from "../roster/kits";
import { HERO_PROJECTILE_CAP } from "../sim/specials/heroProjectiles";
import { f32 } from "wisp/src/sim/f32";
import { PARKED_CUE_TIME_SCALE, type ParkedFlags, type WorldOrigin, parkCue } from "./effects";
import { PROJECTILE_DRAW_CUES, PROJECTILE_DRAW_OFFSETS, fighterProjectileModels, projectileModelOf, restartsStationaryField, RIBBON_PARK_SEQUENCES, ultimateProjectiles } from "../presentation/projectileArt";
import { projectedProjectile } from "../presentation/projectilePose";
import { opponentReflectedModels } from "../presentation/reflectedProjectileArt";
import { IMPACT_DEFILE_MODEL } from "../assets/impactAssetInfo";
import { heroProjectileArt } from "../presentation/projectileArt";
import { type DiscLook, discLook } from "../presentation/discLook";
import { carrierDrawsMark } from "../presentation/ultimateVoice";
import { cameraLift } from "./cameraLift";
import { tintProjectile } from "./projectileTint";
import { addPoolEffect, addPoolEffects } from "./projectilePoolEffects";
import { EyeBeamLine } from "./eyeBeamLine";

export const STATIONARY_PARTICLE_MODELS = [
  "Abilities\\Spells\\Human\\Blizzard\\BlizzardTarget.mdx",
  "Abilities\\Spells\\Undead\\DeathAndDecay\\DeathAndDecayTarget.mdx",
  "Abilities\\Spells\\Human\\MarkOfChaos\\MarkOfChaosTarget.mdx",
  "Abilities\\Spells\\Orc\\Voodoo\\VoodooAuraTarget.mdx",
  "Abilities\\Spells\\Human\\FlameStrike\\FlameStrike.mdx",
  "Abilities\\Spells\\Human\\FlameStrike\\FlameStrikeEmbers.mdx",
  "Abilities\\Spells\\Human\\FlameStrike\\FlameStrikeTarget.mdx",
  "Abilities\\Spells\\Human\\Avatar\\AvatarCaster.mdx",
  "Abilities\\Spells\\Other\\Stampede\\StampedeMissileDeath.mdx",
  "Abilities\\Spells\\Other\\BreathOfFire\\BreathOfFireDamage.mdx",
  "Abilities\\Spells\\Other\\ImmolationRed\\ImmolationRedDamage.mdx",
  "Abilities\\Spells\\Other\\Incinerate\\FireLordDeathExplode.mdx",
  "Doodads\\Cinematic\\TownBurningFireEmitter\\TownBurningFireEmitter.mdx",
  "Abilities\\Spells\\NightElf\\TargetArtLumber\\TargetArtLumber.mdx",
  "Objects\\Spawnmodels\\Other\\NeutralBuildingExplosion\\NeutralBuildingExplosion.mdx",
  "Abilities\\Spells\\Other\\CrushingWave\\CrushingWaveDamage.mdx",
  "Objects\\Spawnmodels\\Undead\\ImpaleTargetDust\\ImpaleTargetDust.mdx",
];

// Hidden bolts park below the floor, as hidden effects do: alpha alone left Aimed Shot's bolts on stage after the move (#457).
const PARKED_LINE_DEPTH = 4096.0;
const DEFILE_FROST = "Abilities\\Spells\\Undead\\FrostNova\\FrostNovaTarget.mdx";
const RISEN_FRONT = 56.0;
const RISEN_HEADROOM = 20.0;
const RISEN_BIRTH = 0.625;
const RISEN_DEPTH = 0.375;
export const RISEN_ALPHA = 150;
export const STATIONARY_SECONDS = f32(0.3);
export const BIRTH_MISSILES = ["FreezingBreathMissile", "WaterElementalMissile", "FrostWyrmMissile"];
const RAISED_SKELETON = "Units\\Undead\\Skeleton\\Skeleton.mdx";
const RAISED_BURST = "Abilities\\Spells\\Undead\\RaiseSkeletonWarrior\\RaiseSkeleton.mdx";
const RAISED_FRONT = 62.0;
const RAISED_LAYOUT = [{ x: f32(-0.6), yaw: f32(-1.2) }, { x: 0.0, yaw: f32(-1.5708) }, { x: f32(0.6), yaw: f32(-1.95) }];


interface Risen {
  readonly x: number;
  readonly z: number;
  readonly radius: number;
  readonly yaw: number;
  readonly scale: number;
  readonly draw: (typeof PROJECTILE_DRAW_OFFSETS)[string];
  readonly raised: readonly number[];
}

interface Pool {
  readonly path: string;
  readonly defile: boolean;
  readonly park: string | undefined;
  readonly effects: readonly number[];
  readonly boundaries: readonly (readonly number[])[];
  readonly raised: readonly (readonly number[])[];
}

export class ProjectilePresentation {
  readonly models: effect[] = [];
  private readonly visible: boolean[] = [];
  private readonly pools: Pool[] = [];

  private readonly assigned: number[] = [];

  private readonly taken: boolean[] = [];
  private readonly serials: number[] = [];
  private readonly specs: (Fighter["projectiles"][number]["spec"])[] = [];
  private readonly lives: number[] = [];
  private readonly reseek: boolean[] = [];
  private readonly birthLife: number[] = [];
  private readonly lingering: number[] = [];
  private readonly risen: (Risen | undefined)[] = [];
  private readonly risenAge: number[] = [];
  private parked: ParkedFlags | undefined;
  private readonly aimedShot: lightning[] = [];
  private readonly lineShown: boolean[] = [];
  private readonly eyeBeam: EyeBeamLine;
  private readonly disc: DiscLook = { lift: 0.0, radius: 0.0, red: 0, green: 0, blue: 0, alpha: 0 };
  private tracerFrame = 0;
  private tracerX = 0.0;
  private tracerZ = 0.0;
  private tracerEnd = 0.0;
  private tracerFacing = 1;

  constructor(
    character: Character,
    private readonly origin: WorldOrigin,
    opponents: readonly Character[] = [],
  ) {
    if (character === Character.rifleman) for (let index = 0; index < 2; index++) {
      const line = AddLightningEx("LEAS", false, origin.x, origin.y, origin.z - PARKED_LINE_DEPTH, origin.x, origin.y, origin.z - PARKED_LINE_DEPTH);
      SetLightningColor(line, 1.0, 0.0, 0.0, 0.0);
      this.aimedShot.push(line);
      this.lineShown.push(false);
    }
    this.eyeBeam = new EyeBeamLine(origin);
    const hero = heroDefinition(character) !== undefined;
    const paths = fighterProjectileModels(character);
    const ultimateOnly = paths.filter((path, index) => index > 0 && !hero && ultimateProjectiles(character).some((spec) => spec.model === path));
    paths.forEach((path, index) => {
      const size = hero ? HERO_PROJECTILE_CAP + 1 : index === 0 ? PROJECTILE_CAPACITY - 4 * ultimateOnly.length : 4;
      const effects: number[] = [];
      const boundaries: number[][] = [];
      const raised: number[][] = [];
      const specials = heroDefinition(character)?.specials;

      const defilePool = character === Character.lichKing && specials !== undefined && heroProjectileArt(specials).some(({ spec }) => spec.model === path && spec.pool !== undefined);
      const groundPool = (specials !== undefined && heroProjectileArt(specials).some(({ spec }) => spec.model === path && spec.pool !== undefined && spec.pool.growth > 0.0)) || PROJECTILE_DRAW_OFFSETS[path]?.disc !== undefined;
      for (let slot = 0; slot < size; slot++) {
        effects.push(addPoolEffect(this.models, this.visible, path, this.origin));
        const crowd: number[] = [];
        if (character === Character.lichKing && path.includes("ImpaleHitTarget")) {
          for (let layer = 0; layer <= RAISED_LAYOUT.length; layer++) {
            crowd.push(this.models.length);
            const raisedModel = AddSpecialEffect(layer < RAISED_LAYOUT.length ? RAISED_SKELETON : RAISED_BURST, origin.x, origin.y);
            BlzSetSpecialEffectAnimationBlendTime(raisedModel, 0.0);
            BlzSetSpecialEffectAnimation(raisedModel, "birth");
            this.models.push(raisedModel);
            this.visible.push(false);
          }
        }
        raised.push(crowd);
        if (groundPool) {
          const layers: number[] = [];
          for (let layer = 0; layer < (character === Character.lichKing ? 2 : 1); layer++) {
            layers.push(this.models.length);
            const boundary = AddSpecialEffect(defilePool && layer > 0 ? DEFILE_FROST : IMPACT_DEFILE_MODEL, origin.x, origin.y);
            BlzSetSpecialEffectAnimationBlendTime(boundary, 0.0);
            BlzSetSpecialEffectAnimation(boundary, "stand");
            BlzSetSpecialEffectTime(boundary, 0.0);
            this.models.push(boundary);
            this.visible.push(false);
          }
          boundaries.push(layers);
        }
      }
      this.pools.push({ path, defile: defilePool, park: RIBBON_PARK_SEQUENCES[path] ?? undefined, effects, boundaries, raised });
    });
    for (const path of opponentReflectedModels(opponents, this.pools.map((pool) => pool.path))) this.pools.push({ path, defile: false, park: RIBBON_PARK_SEQUENCES[path] ?? undefined, effects: addPoolEffects(this.models, this.visible, path, this.origin, HERO_PROJECTILE_CAP + 1), boundaries: [], raised: [] });
    for (let index = 0; index < PROJECTILE_CAPACITY; index++) this.assigned.push(-1);
    this.clear();
  }


  private hide(model: effect, parked: ParkedFlags, index: number): void {
    if (!parkCue(model, this.origin, parked, index)) return;
    for (const pool of this.pools) if (pool.park !== undefined && pool.effects.includes(index)) BlzSetSpecialEffectAnimation(model, pool.park);
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
      this.lingering[index] = 0;
      this.hide(model, parked, index);
    }
    for (let index = 0; index < this.assigned.length; index++) this.assigned[index] = -1;
  }

  drawnModel(index: number): effect | undefined {
    return this.models[this.assigned[index] ?? -1];
  }


  private placeRisen(slot: number, born: boolean): void {
    const model = this.models[slot], placed = this.risen[slot];
    if (model === undefined || placed === undefined) return;
    const draw = placed.draw;
    const width = f32(37.988001);
    const height = f32(636.061981);
    const centerX = f32(-0.3387);
    const centerZ = f32(-389.412987);
    const { eyeX, eyeZ, lift, front } = cameraLift(RISEN_FRONT);
    const y = this.origin.y - front;
    const scaleX = f32(f32(f32(2.0 * placed.radius) / width) * (draw?.width ?? 1.0));
    const grown = f32(f32(f32(placed.z + placed.radius) + RISEN_HEADROOM) * (born ? RISEN_BIRTH : 1.0));
    const scaleZ = f32(grown / height);
    const x = this.origin.x + f32(placed.x - f32(centerX * scaleX));
    const z = this.origin.z + f32(f32(grown * 0.5) - f32(centerZ * scaleZ));
    BlzResetSpecialEffectMatrix(model);
    BlzSetSpecialEffectMatrixScale(model, scaleX * (1.0 - lift), RISEN_DEPTH * (1.0 - lift), scaleZ * (1.0 - lift));
    BlzSetSpecialEffectPosition(model, x + (eyeX - x) * lift, y, z + (eyeZ - z) * lift);
    BlzSetSpecialEffectAlpha(model, RISEN_ALPHA);
    BlzSetSpecialEffectAnimation(model, "birth");
    BlzSetSpecialEffectColor(model, 120, 95, 70);
  }

  private placeRaised(slot: number): void {
    const placed = this.risen[slot];
    if (placed === undefined || placed.raised.length === 0) return;
    const age = this.risenAge[slot] ?? 0;
    const { eyeX, eyeZ, lift, front } = cameraLift(RAISED_FRONT);
    const y = this.origin.y - front;
    const z = this.origin.z;
    for (let index = 0; index < placed.raised.length; index++) {
      const raisedSlot = placed.raised[index];
      const raisedModel = raisedSlot === undefined ? undefined : this.models[raisedSlot];
      if (raisedModel === undefined) continue;
      const layout = RAISED_LAYOUT[index];
      const x = this.origin.x + placed.x + f32((layout?.x ?? 0.0) * placed.radius);
      BlzResetSpecialEffectMatrix(raisedModel);
      BlzSetSpecialEffectYaw(raisedModel, layout?.yaw ?? 0.0);
      BlzSetSpecialEffectPosition(raisedModel, x + (eyeX - x) * lift, y, z + (eyeZ - z) * lift);
      BlzSetSpecialEffectScale(raisedModel, f32((layout === undefined ? 1.5 : index === 1 ? 1.25 : f32(1.1)) * (1.0 - lift)));
      BlzSetSpecialEffectAlpha(raisedModel, age === 0 && layout !== undefined ? 0 : 255);
      BlzSetSpecialEffectTime(raisedModel, layout === undefined ? f32(f32(0.2) + f32(f32(0.3) * age)) : f32(f32(1.35) + f32(f32(0.3) * age)));
      BlzSetSpecialEffectTimeScale(raisedModel, 0.0);
    }
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
    this.eyeBeam.present(fighter, playing);
    const parked = (this.parked ??= []);
    const taken = this.taken;
    for (let index = 0; index < this.models.length; index++) taken[index] = false;
    for (let index = 0; index < PROJECTILE_CAPACITY; index++) {
      if (this.aimedShot.length > 0 && fighter?.projectiles[index]?.spec === FIGHTER_ULTIMATES[Character.rifleman]?.projectiles?.[0]) {
        this.assigned[index] = -1;
        continue;
      }
      if (carrierDrawsMark(fighter?.projectiles[index]?.spec)) {
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
      this.lingering[slot] = 0;
      parked[slot] = false;
      const projectile = fighter?.projectiles[index];
      const draw = pool === undefined ? undefined : PROJECTILE_DRAW_OFFSETS[pool.path];
      const cue = pool === undefined ? undefined : PROJECTILE_DRAW_CUES[pool.path];
      const lichKing = fighter?.character === Character.lichKing;
      const risen = lichKing && pool?.path.includes("ImpaleHitTarget") === true;
      const tell = lichKing && pool?.path.includes("AnimateDeadTarget") === true;
      const defile = lichKing && pool?.defile === true;
      const born = projectile !== undefined && (this.serials[slot] !== projectile.serial || this.specs[slot] !== projectile.spec || !this.visible[slot]);
      const rebirth = projectile !== undefined && cue?.birth !== undefined && !paused && (born || (cue.birth.eachFrame && this.lives[slot] !== projectile.life));
      if (born && projectile !== undefined && !risen && !tell && !defile) {
        const birth = BIRTH_MISSILES.some((name) => pool?.path.includes(name) === true);
        if (cue?.birth === undefined) {
          if (draw?.seconds === undefined) BlzSetSpecialEffectAnimation(model, draw?.sequence ?? pose.animationSequence ?? (birth ? "birth" : "stand"));
          BlzSetSpecialEffectTime(model, draw?.seconds ?? 0.0);
          this.reseek[slot] = draw?.reseek === true;
          this.birthLife[slot] = projectile.life;
        }
        this.serials[slot] = projectile.serial;
        this.specs[slot] = projectile.spec;
      } else if (this.reseek[slot] === true && !paused && projectile !== undefined && projectile.life < (this.birthLife[slot] ?? projectile.life)) {
        // Warcraft discards an animation seek in the callback selecting its sequence (#58 native rulers).
        const elapsed = f32(((this.birthLife[slot] ?? projectile.life) - projectile.life) / 60.0);
        BlzSetSpecialEffectTime(model, f32((draw?.seconds ?? 0.0) + elapsed));
        this.reseek[slot] = false;
      }
      BlzSetSpecialEffectYaw(model, pose.yaw);
      BlzSetSpecialEffectPitch(model, pose.pitch);
      BlzSetSpecialEffectRoll(model, draw?.roll ?? 0.0);
      BlzSetSpecialEffectPosition(model, this.origin.x + pose.x + (pose.yaw === 0.0 ? 1 : -1) * (draw?.x ?? 0.0), this.origin.y, this.origin.z + pose.modelZ + (draw?.z ?? 0.0));
      BlzSetSpecialEffectScale(model, pose.modelScale * (cue?.scale ?? 1.0));
      tintProjectile(model, cue);
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
        this.lingering[slot] = 4;
        this.risen[slot] = { x: pose.x, z: pose.z, radius: pose.dangerRadius, yaw: pose.yaw, scale: pose.modelScale * (cue?.scale ?? 1.0), draw, raised: pool?.raised[pool.effects.indexOf(slot)] ?? [] };
        this.risenAge[slot] = born ? 0 : (this.risenAge[slot] ?? 0) + (paused ? 0 : 1);
        this.placeRisen(slot, born);
        this.placeRaised(slot);
        for (const raisedSlot of this.risen[slot]?.raised ?? []) {
          taken[raisedSlot] = true;
          this.lingering[raisedSlot] = 4;
          parked[raisedSlot] = false;
        }
      }
      if (born && projectile !== undefined && (risen || tell || defile)) {
        BlzSetSpecialEffectAnimation(model, defile ? "stand" : "birth");
        this.serials[slot] = projectile.serial;
        this.specs[slot] = projectile.spec;
      }
      if (risen) {
        BlzSetSpecialEffectTime(model, STATIONARY_SECONDS);
        BlzSetSpecialEffectTimeScale(model, 0.0);
      } else if (tell && projectile?.spec !== undefined) {
        BlzSetSpecialEffectTime(model, f32((projectile.spec.life - projectile.life) / 60));
      } else if (cue?.birth === undefined && pose.animationSeconds !== undefined) {
        if (!this.visible[slot] && pose.animationSequence !== undefined) BlzSetSpecialEffectAnimation(model, pose.animationSequence);
        BlzSetSpecialEffectTime(model, pose.animationSeconds);
        BlzSetSpecialEffectTimeScale(model, 0.0);
      } else if (cue?.birth === undefined && projectile?.spec !== undefined && projectile.velocityX === 0.0 && projectile.velocityZ === 0.0) {

        if (pool !== undefined && STATIONARY_PARTICLE_MODELS.includes(pool.path)) {
          if ((born || !paused) && restartsStationaryField(pool.path, projectile.spec.life - projectile.life, born)) BlzSetSpecialEffectTime(model, STATIONARY_SECONDS);
        } else {
          BlzSetSpecialEffectTime(model, STATIONARY_SECONDS);
          BlzSetSpecialEffectTimeScale(model, 0.0);
        }
      }
      if (defile && projectile?.spec !== undefined) {
        const age = projectile.spec.life - projectile.life;
        BlzSetSpecialEffectScale(model, f32(pose.dangerRadius / 180.0));
        BlzSetSpecialEffectTime(model, f32(Math.max(0, age - (projectile.spec.activeFrom ?? 0)) / 60));
        BlzSetSpecialEffectTimeScale(model, paused ? 0.0 : 1.0);
        if (!pose.armed) taken[slot] = false;
        else this.lingering[slot] = 1;
      }
      const boundaries = pool?.boundaries[pool.effects.indexOf(slot)] ?? [];
      for (let layer = 0; layer < boundaries.length; layer++) {
        const boundarySlot = boundaries[layer];
        const boundary = boundarySlot === undefined ? undefined : this.models[boundarySlot];
        if (boundary === undefined || boundarySlot === undefined || pose.dangerRadius <= 0.0) continue;
        taken[boundarySlot] = true;
        parked[boundarySlot] = false;
        if (defile && layer > 0) {
          const pulseFrame = pose.poolSince;
          if (!pose.armed || pulseFrame < 0 || pulseFrame > 12) {
            taken[boundarySlot] = false;
            continue;
          }
          BlzResetSpecialEffectMatrix(boundary);
          BlzSetSpecialEffectRoll(boundary, f32(Math.PI * 0.5));
          BlzSetSpecialEffectPosition(boundary, this.origin.x + pose.x, this.origin.y - 12.0, this.origin.z + pose.z + f32(pose.dangerRadius * f32(0.45)));
          BlzSetSpecialEffectScale(boundary, f32(pose.dangerRadius / 720.0));
          BlzSetSpecialEffectColor(boundary, 155, 210, 255);
          BlzSetSpecialEffectAlpha(boundary, 255);
          if (!this.visible[boundarySlot]) BlzSetSpecialEffectAnimation(boundary, "birth");
          BlzSetSpecialEffectTime(boundary, f32(pulseFrame / 60));
          BlzSetSpecialEffectTimeScale(boundary, paused ? 0.0 : 1.0);
        } else {
          const look = discLook(this.disc, draw, pose, defile, fighter?.character === Character.lich, defile && projectile?.spec?.pool !== undefined ? projectile.spec.life - projectile.life : -1);
          BlzSetSpecialEffectPosition(boundary, this.origin.x + pose.x, this.origin.y - 8.0, this.origin.z + pose.z + look.lift);
          BlzSetSpecialEffectScale(boundary, look.radius);
          if (defile || draw?.discVertical === true) {
            BlzResetSpecialEffectMatrix(boundary);
            BlzSetSpecialEffectRoll(boundary, f32(Math.PI * 0.5));
            // Warcraft may apply matrix scale before or after the roll, so the rim's 0.6 height is stretched on Y and Z alike.
            BlzSetSpecialEffectMatrixScale(boundary, 1.0, f32(1.0 / f32(0.6)), f32(1.0 / f32(0.6)));
          }
          BlzSetSpecialEffectColor(boundary, look.red, look.green, look.blue);
          BlzSetSpecialEffectAlpha(boundary, look.alpha);
          if (!this.visible[boundarySlot]) BlzSetSpecialEffectTime(boundary, 0.0);
          BlzSetSpecialEffectTimeScale(boundary, 0.0);
          if (defile && pose.armed) this.lingering[boundarySlot] = 1;
        }
      }
    }
    for (let index = 0; index < this.models.length; index++) {
      const model = this.models[index];
      const remaining = this.lingering[index] ?? 0;
      if (!playing || fighter === undefined || fighter.status.out) this.lingering[index] = 0;
      else if (taken[index] !== true && remaining > 0) {
        taken[index] = true;
        if (!paused && remaining === 4 && this.risen[index] !== undefined) this.placeRisen(index, false);
        if (!paused && this.risen[index] !== undefined) {
          this.risenAge[index] = (this.risenAge[index] ?? 0) + 1;
          this.placeRaised(index);
        }
        if (!paused) this.lingering[index] = remaining - 1;
      }
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
    this.eyeBeam.destroy();
    this.aimedShot.length = 0;
    this.lineShown.length = 0;
    this.models.length = 0;
    this.visible.length = 0;
    this.pools.length = 0;
  }
}
