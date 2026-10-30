



import { cannonRising } from "../sim/stageHazards";
import { IMPACT_DUST_MODEL, IMPACT_ROLL_MODEL, IMPACT_TECH_MODEL } from "../assets/impactAssetInfo";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { type ImpactPresentationCursor, consumeImpactFrame, createImpactPresentationCursor, resetImpactPresentationCursor } from "../presentation/impactCursor";
import {
  STATIC_AURA,
  STATIC_DRAIN_FLASH,
  STATIC_WING_TRAIL,
  type SpecialEffectState,
  type StaticSpecialPose,
  createStaticSpecialPose,
  projectSpecialEffect,
} from "../presentation/specialEffectState";
import { SUMMON_BEAR } from "../presentation/summonClipInfo";
import { type SummonState, projectBear } from "../presentation/summonState";
import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, Character, HeroStatusKind, SpecialAction } from "../sim/codes";
import { attackActive, attackStartup } from "../sim/conditions";
import { min } from "../core/numbers";
import type { Fighter } from "../sim/fighter";
import { DEMONHUNTER_IMMOLATE_ACTIVE, DEMONHUNTER_IMMOLATE_STARTUP } from "../sim/specials";
import { type ParkedFlags, STOCK_MODELS, type WorldOrigin, facingYaw, parkOnce, placeEffect } from "./effects";
import { beamSegment } from "../sim/specials/heroContact";
import { runningHeroSpecial } from "../sim/specials/runningMove";
import { emptyCapsule } from "../sim/geometry/contactGeometry";
import { specialAreaRegion } from "../presentation/disjointCues";
import { emptyTrailLine, specialTrail } from "../presentation/specialTrail";
import { fighterModelScale } from "../presentation/fighterScale";
import { IMMOLATE_SOUNDS } from "../presentation/elementLooks";
import { SummonPresentation } from "./summonPresentation";
import { PoisonStackPresentation } from "./poisonStackPresentation";
import { SpellPassPresentation } from "./spellPassPresentation";
import { SoundBank, SoundKind } from "./soundBank";
import { bindPrototype } from "../../platform/rebind";

interface SpecialSlot {
  readonly bear: SummonPresentation;
  readonly aura: effect;
  readonly felFlames: effect;
  readonly cannonFlames: effect;
  readonly manaHand: effect;
  readonly wingTrail: effect;
  readonly drainFlash: effect;
  readonly silence: effect;
  readonly curse: effect;
  readonly frog: effect;
  readonly siphon: lightning;
  siphonShown: boolean;
  readonly laser: lightning;
  readonly chain: lightning;
  laserShown: boolean;
  lastX: number;
  lastZ: number;

  readonly cursor: ImpactPresentationCursor;
  previousSpecial: SpecialAction;
  previousSpecialFrame: number;

  readonly immolationLoop: sound;
}


const AURA = 1;
const FEL_FLAMES = 2;
const MANA_HAND = 3;
const WING_TRAIL = 4;
const DRAIN_FLASH = 5;
const FROG = 6;
export const HEX_FROG_MODEL = "units\\critters\\Frog\\Frog.mdx";
const SILENCE = 7;
const CURSE = 8;
const CANNON_FLAMES = 9;
const SLOT_EFFECTS = 10;
/** Warcraft's Drain Mana lightning, the Blood Mage's own Siphon Mana beam. */
const SIPHON_LIGHTNING = "DRAM";
const LASER_LIGHTNING = "AFOD";
const CHAIN_LIGHTNING = "CLPB";

export class SpecialEffects {
  private readonly slots: readonly SpecialSlot[];
  private readonly pose = createStaticSpecialPose();
  private parked: ParkedFlags | undefined;
  private readonly sounds = new SoundBank();
  private readonly stackPresentation: PoisonStackPresentation;
  private readonly spellPass: SpellPassPresentation;

  private readonly front: number;
  private readonly beamLine = emptyCapsule();
  private readonly trailLine = emptyTrailLine();

  constructor(private readonly origin: WorldOrigin) {
    const { x, y } = origin;
    this.front = y - 8.0;
    this.sounds.prepare(SoundKind.label, [IMMOLATE_SOUNDS.start, IMMOLATE_SOUNDS.end]);
    this.stackPresentation = new PoisonStackPresentation(origin);
    this.spellPass = new SpellPassPresentation(origin);
    this.slots = PARTICIPANT_SLOTS.map((participant) => {
      const cursor = createImpactPresentationCursor();
      const bear = new SummonPresentation(SUMMON_BEAR, origin);
      const aura = AddSpecialEffect(IMPACT_ROLL_MODEL, x, y);
      const felFlames = AddSpecialEffect(STOCK_MODELS.immolationTarget, x, y);
      const cannonFlames = AddSpecialEffect(STOCK_MODELS.cannonFlames, x, y);
      const manaHand = AddSpecialEffect(STOCK_MODELS.manaBurnTarget, x, y);
      const wingTrail = AddSpecialEffect(IMPACT_DUST_MODEL, x, y);
      const drainFlash = AddSpecialEffect(IMPACT_TECH_MODEL, x, y);
      const silence = AddSpecialEffect(STOCK_MODELS.silenceTarget, x, y);
      const curse = AddSpecialEffect(STOCK_MODELS.doomTarget, x, y);
      const frog = AddSpecialEffect(HEX_FROG_MODEL, x, y);
      const siphon = AddLightningEx(SIPHON_LIGHTNING, false, x, y, origin.z - 4096.0, x, y, origin.z - 4096.0);
      SetLightningColor(siphon, 1.0, 1.0, 1.0, 0.0);
      const laser = AddLightningEx(LASER_LIGHTNING, false, x, y, origin.z - 4096.0, x, y, origin.z - 4096.0);
      SetLightningColor(laser, 1.0, 1.0, 1.0, 0.0);
      const chain = AddLightningEx(CHAIN_LIGHTNING, false, x, y, origin.z - 4096.0, x, y, origin.z - 4096.0);
      SetLightningColor(chain, 1.0, 1.0, 1.0, 0.0);
      BlzSetSpecialEffectTimeScale(aura, 0.0);
      BlzSetSpecialEffectTimeScale(wingTrail, 0.0);
      BlzSetSpecialEffectTimeScale(drainFlash, 0.0);
      const immolationLoop = CreateSoundFromLabel(IMMOLATE_SOUNDS.loop, true, true, true, 10000, 10000);
      return {
        bear, aura, felFlames, cannonFlames, manaHand, wingTrail, drainFlash, silence, curse, frog, siphon, siphonShown: false, laser, chain, laserShown: false, lastX: 0.0, lastZ: 0.0, cursor, immolationLoop,
        previousSpecial: SpecialAction.none, previousSpecialFrame: 0,
      };
    });
    this.clear();
  }


  bindNestedCode(): void {
    for (const slot of this.slots) bindPrototype(slot.bear, SummonPresentation.prototype);
    bindPrototype(this.stackPresentation, PoisonStackPresentation.prototype);
    bindPrototype(this.spellPass, SpellPassPresentation.prototype);
  }

  clear(): void {
    this.stackPresentation.clear();
    this.spellPass.clear();
    this.slots.forEach((slot, index) => {
      resetImpactPresentationCursor(slot.cursor);
      slot.bear.hide();
      this.park(slot.aura, index, AURA);
      this.park(slot.felFlames, index, FEL_FLAMES);
      this.park(slot.cannonFlames, index, CANNON_FLAMES);
      this.park(slot.manaHand, index, MANA_HAND);
      this.park(slot.wingTrail, index, WING_TRAIL);
      this.park(slot.drainFlash, index, DRAIN_FLASH);
      this.park(slot.silence, index, SILENCE);
      this.park(slot.curse, index, CURSE);
      this.park(slot.frog, index, FROG);
      this.hideSiphon(slot);
      this.hideLaser(slot);
      slot.previousSpecial = SpecialAction.none;
      slot.previousSpecialFrame = 0;
      this.releaseImmolationLoop(slot);
    });
  }

  private park(model: effect, slot: number, effect: number): void {
    parkOnce(model, this.origin, (this.parked ??= []), SLOT_EFFECTS * slot + effect);
  }

  private releaseImmolationLoop(slot: SpecialSlot): void {
    StopSound(slot.immolationLoop, false, false);
  }

  private placed(slot: number, effect: number): void {
    (this.parked ??= [])[SLOT_EFFECTS * slot + effect] = false;
  }

  slotEffects(slot: number, into: effect[]): void {
    const effects = this.slots[slot];
    if (effects === undefined) return;
    into.push(effects.aura, effects.felFlames, effects.cannonFlames, effects.manaHand, effects.wingTrail, effects.drainFlash, effects.silence, effects.curse, effects.frog);
  }

  setPaused(paused: boolean): void {
    const scale = paused ? 0.0 : 1.0;
    this.stackPresentation.setPaused(paused);
    this.spellPass.setPaused(paused);
    for (const { felFlames, cannonFlames, manaHand, silence } of this.slots) {
      BlzSetSpecialEffectTimeScale(felFlames, scale);
      BlzSetSpecialEffectTimeScale(cannonFlames, scale);
      BlzSetSpecialEffectTimeScale(manaHand, scale);
      BlzSetSpecialEffectTimeScale(silence, scale);
    }
  }


  private show(model: effect, slot: number, effect: number, fighter: Readonly<Fighter>, x: number, z: number, size: number): void {
    this.placed(slot, effect);
    const scale = fighterModelScale(fighter);
    placeEffect(model, this.origin.x + fighter.motion.x + x * scale, this.front, this.origin.z + fighter.motion.z + z * scale);
    BlzSetSpecialEffectScale(model, size * scale);
    BlzSetSpecialEffectAlpha(model, 255);
    BlzSetSpecialEffectTimeScale(model, fighter.launch.hitlag > 0 || fighter.status.frozenFrames > 0 ? 0.0 : 1.0);
  }


  private showCurse(fighter: Readonly<Fighter>, slot: SpecialSlot, index: number): void {
    if (!fighter.status.out && fighter.status.cursedBy !== undefined) this.show(slot.curse, index, CURSE, fighter, 0.0, 200.0, f32(0.8));
    else this.park(slot.curse, index, CURSE);
  }

  private showStun(fighter: Readonly<Fighter>, index: number, manaHand: effect): void {
    if (fighter.status.condition === HeroStatusKind.stun) this.show(manaHand, index, MANA_HAND, fighter, 0.0, 175.0, f32(0.6));
    else this.park(manaHand, index, MANA_HAND);
  }


  private presentImmolationSound(fighter: Readonly<Fighter>, slot: SpecialSlot, lit: boolean, out: boolean): void {
    const x = this.origin.x + fighter.motion.x;
    const z = this.origin.z + fighter.motion.z;
    const play = (label: string): void => {
      this.sounds.playAt(SoundKind.label, label, x, this.origin.y, z);
    };
    if (lit) {
      play(IMMOLATE_SOUNDS.start);
      SetSoundPosition(slot.immolationLoop, x, this.origin.y, z);
      StartSound(slot.immolationLoop);
    } else if (out) {
      StopSound(slot.immolationLoop, false, true);
      play(IMMOLATE_SOUNDS.end);
    } else if (fighter.special.action === SpecialAction.demonHunterImmolate) {
      SetSoundPosition(slot.immolationLoop, x, this.origin.y, z);
    }
  }

  private presentConfirmedParticles(fighter: Readonly<Fighter>, slot: SpecialSlot, index: number): void {
    const { action, frame } = fighter.special;
    const entered = action !== slot.previousSpecial || frame < slot.previousSpecialFrame;
    const { felFlames, manaHand } = slot;
    if (!fighter.status.out && fighter.status.condition === HeroStatusKind.silence) this.show(slot.silence, index, SILENCE, fighter, 0.0, 150.0, f32(0.7));
    else this.park(slot.silence, index, SILENCE);
    this.showCurse(fighter, slot, index);
    this.stackPresentation.present(fighter, index);
    this.spellPass.present(fighter, index);
    if (!fighter.status.out && fighter.status.condition === HeroStatusKind.hex) {
      this.show(slot.frog, index, FROG, fighter, 0.0, 0.0, f32(1.6));
      BlzSetSpecialEffectYaw(slot.frog, facingYaw(fighter.facing));
    } else this.park(slot.frog, index, FROG);
    if (fighter.character === Character.demonHunter && !fighter.status.out) {
      if (entered && action === SpecialAction.demonHunterImmolate) BlzSetSpecialEffectTime(felFlames, 0.0);

      const immolating = action === SpecialAction.demonHunterImmolate;

      const striking = immolating && frame >= DEMONHUNTER_IMMOLATE_STARTUP && frame < DEMONHUNTER_IMMOLATE_STARTUP + DEMONHUNTER_IMMOLATE_ACTIVE;
      this.presentImmolationSound(fighter, slot, entered && immolating, slot.previousSpecial === SpecialAction.demonHunterImmolate && !immolating);
      if (immolating) this.show(felFlames, index, FEL_FLAMES, fighter, 0.0, 25.0, striking ? f32(1.8) : f32(1.35));
      else this.park(felFlames, index, FEL_FLAMES);
      this.showStun(fighter, index, manaHand);
    } else {
      this.presentImmolationSound(fighter, slot, false, slot.previousSpecial === SpecialAction.demonHunterImmolate);
      this.park(felFlames, index, FEL_FLAMES);
      if (fighter.status.out) this.park(manaHand, index, MANA_HAND);
      else this.showStun(fighter, index, manaHand);
    }
    if (!fighter.status.out && cannonRising(fighter)) this.show(slot.cannonFlames, index, CANNON_FLAMES, fighter, 0.0, 60.0, f32(2.0));
    else this.park(slot.cannonFlames, index, CANNON_FLAMES);
    slot.previousSpecial = action;
    slot.previousSpecialFrame = frame;
  }

  private applyStatic(model: effect, slot: number, effect: number, pose: Readonly<StaticSpecialPose>): void {
    if (!pose.visible) {
      this.park(model, slot, effect);
      return;
    }
    this.placed(slot, effect);
    placeEffect(model, this.origin.x + pose.x, this.front, this.origin.z + pose.z);
    BlzSetSpecialEffectColor(model, pose.red, pose.green, pose.blue);
    BlzSetSpecialEffectScale(model, pose.scale);
    BlzSetSpecialEffectAlpha(model, pose.alpha);
  }


  presentStatic(state: Readonly<SpecialEffectState>, fighter: Readonly<Fighter> | undefined, slot: number): void {
    const effects = this.slots[slot];
    if (effects === undefined) return;
    if (fighter === undefined) {
      this.hideSiphon(effects);
      this.hideLaser(effects);
      this.park(effects.aura, slot, AURA);
      this.park(effects.wingTrail, slot, WING_TRAIL);
      this.park(effects.drainFlash, slot, DRAIN_FLASH);
      return;
    }
    effects.lastX = fighter.motion.x;
    effects.lastZ = fighter.motion.z;
    this.presentSiphon(effects, fighter);
    this.presentLaser(effects, fighter);
    this.applyStatic(effects.aura, slot, AURA, projectSpecialEffect(state, fighter, slot, STATIC_AURA, this.pose));
    this.applyStatic(effects.wingTrail, slot, WING_TRAIL, projectSpecialEffect(state, fighter, slot, STATIC_WING_TRAIL, this.pose));
    this.applyStatic(effects.drainFlash, slot, DRAIN_FLASH, projectSpecialEffect(state, fighter, slot, STATIC_DRAIN_FLASH, this.pose));
  }

  private hideSiphon(slot: SpecialSlot): void {
    if (!slot.siphonShown) return;
    SetLightningColor(slot.siphon, 1.0, 1.0, 1.0, 0.0);
    slot.siphonShown = false;
  }

  private hideLaser(slot: SpecialSlot): void {
    if (!slot.laserShown) return;
    SetLightningColor(slot.laser, 1.0, 1.0, 1.0, 0.0);
    SetLightningColor(slot.chain, 1.0, 1.0, 1.0, 0.0);
    slot.laserShown = false;
  }

  private presentLaser(effects: SpecialSlot, fighter: Readonly<Fighter>): void {
    const beam = runningHeroSpecial(fighter)?.beam;
    const region = specialAreaRegion(fighter, 0);
    if (beam === undefined || fighter.status.out || region.strike === undefined) {
      this.presentTrail(effects, fighter);
      return;
    }
    const line = beamSegment(this.beamLine, fighter, beam, region.strike.radius);
    const { x, z } = this.origin;
    const shown = beam.chain === true ? effects.chain : effects.laser;
    SetLightningColor(beam.chain === true ? effects.laser : effects.chain, 1.0, 1.0, 1.0, 0.0);
    MoveLightningEx(shown, false, x + line.x1, this.front, z + line.z1, x + line.x2, this.front, z + line.z2);
    if (beam.chain === true) SetLightningColor(shown, 1.0, 1.0, 1.0, 1.0);
    else SetLightningColor(shown, 1.0, f32(0.3), f32(0.15), 1.0);
    effects.laserShown = true;
  }

  private presentTrail(effects: SpecialSlot, fighter: Readonly<Fighter>): void {
    const line = this.trailLine;
    if (!specialTrail(fighter, line)) {
      this.hideLaser(effects);
      return;
    }
    const { x, z } = this.origin;
    SetLightningColor(effects.laser, 1.0, 1.0, 1.0, 0.0);
    MoveLightningEx(effects.chain, false, x + line.x1, this.front, z + line.z1, x + line.x2, this.front, z + line.z2);
    SetLightningColor(effects.chain, 1.0, 1.0, 1.0, 1.0);
    effects.laserShown = true;
  }

  /** While Siphon Mana reaches out or holds its victim, a drain beam joins Kael's hand to the victim's chest. */
  private presentSiphon(effects: SpecialSlot, fighter: Readonly<Fighter>): void {
    if (fighter.character === Character.sylvanas) {
      const move = runningHeroSpecial(fighter);
      const target = fighter.grab.target;
      const victim = target === undefined ? undefined : this.slots[target];
      const drain = fighter.special.action === SpecialAction.heroDown;
      const held = drain && fighter.special.grabFrame > 0 && victim !== undefined;
      const grab = move?.commandGrab;
      const strike = fighter.special.action === SpecialAction.heroSide ? specialAreaRegion(fighter, 0).strike
        : drain && grab !== undefined && fighter.special.frame >= grab.first && fighter.special.frame <= grab.last ? grab.strike : undefined;
      if (fighter.status.out || (!held && strike === undefined)) {
        this.hideSiphon(effects);
        return;
      }
      const startX = strike?.x1 ?? 38.0;
      const startZ = strike?.z1 ?? 54.0;
      const endX = held && victim !== undefined ? victim.lastX : fighter.motion.x + fighter.facing * (strike?.x2 ?? 68.0);
      const endZ = held && victim !== undefined ? victim.lastZ + 54.0 : fighter.motion.z + (strike?.z2 ?? 54.0);
      MoveLightningEx(effects.siphon, false, this.origin.x + fighter.motion.x + fighter.facing * startX, this.front, this.origin.z + fighter.motion.z + startZ,
        this.origin.x + endX, this.front, this.origin.z + endZ);
      SetLightningColor(effects.siphon, drain ? f32(0.8) : f32(0.65), drain ? f32(0.2) : f32(0.35), drain ? f32(0.5) : 1.0, 1.0);
      effects.siphonShown = true;
      return;
    }
    const target = fighter.grab.target;
    const victim = target === undefined ? undefined : this.slots[target];
    const tether = fighter.attack.style === AttackStyle.grab ? fighter.tuning.moves?.grabRegion?.strike : undefined;
    const reaching = tether !== undefined && fighter.attack.frame < attackStartup(fighter, AttackStyle.grab) + attackActive(fighter, AttackStyle.grab);
    if (fighter.character !== Character.kaelthas || fighter.status.out || (victim === undefined && !reaching)) {
      this.hideSiphon(effects);
      return;
    }
    const scale = fighterModelScale(fighter);
    const { x, z } = this.origin;
    const reach = tether === undefined ? 0.0 : min(1.0, f32(f32(fighter.attack.frame + 1) / f32(attackStartup(fighter, AttackStyle.grab) + 1)));
    const endX = victim !== undefined ? victim.lastX : fighter.motion.x + fighter.facing * f32((tether?.x2 ?? 0.0) * reach);
    const endZ = victim !== undefined ? victim.lastZ + 55.0 : fighter.motion.z + (tether?.z2 ?? 0.0);
    MoveLightningEx(effects.siphon, false, x + fighter.motion.x + fighter.facing * 40.0 * scale, this.front, z + fighter.motion.z + 65.0 * scale,
      x + endX, this.front, z + endZ);
    SetLightningColor(effects.siphon, 1.0, 1.0, 1.0, 1.0);
    effects.siphonShown = true;
  }

  presentSummons(state: Readonly<SummonState>, fighter: Readonly<Fighter> | undefined, slot: number): void {
    this.slots[slot]?.bear.present(projectBear(state, fighter, slot));
  }


  presentConfirmedAnimated(frame: number, fighter: Readonly<Fighter>, slot: number): void {
    const effects = this.slots[slot];
    if (effects === undefined || !consumeImpactFrame(effects.cursor, frame)) return;
    this.presentConfirmedParticles(fighter, effects, slot);
  }

  destroy(): void {
    this.stackPresentation.destroy();
    this.spellPass.destroy();
    for (const slot of this.slots) {
      this.releaseImmolationLoop(slot);
      KillSoundWhenDone(slot.immolationLoop);
      slot.bear.destroy();
      for (const model of [slot.aura, slot.felFlames, slot.cannonFlames, slot.manaHand, slot.wingTrail, slot.drainFlash, slot.silence, slot.frog]) DestroyEffect(model);
      DestroyLightning(slot.siphon);
      DestroyLightning(slot.laser);
      DestroyLightning(slot.chain);
    }
  }
}
