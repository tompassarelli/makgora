import { f32 } from "wisp/src/sim/f32";
import {
  BossSpell, COLUMN_FIRE_MODEL, COLUMN_FIRE_SCALE, FINGER_AIM_ALPHA, FINGER_CHARGE_MODEL, FINGER_CHARGE_SCALE, FINGER_CHARGE_Z, FINGER_IMPACT_FRAMES, FINGER_IMPACT_MODEL,
  FINGER_IMPACT_SCALE, FINGER_LIGHTNING, FINGER_LINGER_FRAMES, FIRE_BURST_FRAMES, FIRE_BURST_MODEL, FIRE_BURST_SCALE, RAIN_OF_FIRE_FRAMES, RAIN_OF_FIRE_LANDS, RAIN_OF_FIRE_MODEL, RAIN_OF_FIRE_SCALE,
  SHOCKWAVE_FRAMES, SHOCKWAVE_MODEL, SHOCKWAVE_PILLAR_SCALE, SHOCKWAVE_POINTS, SHOCKWAVE_TRAIL_MODEL, SHOCKWAVE_TRAIL_SCALE, BOSS_HAND_Z,
  growth, shockwaveIgnition, shockwavePointX,
} from "../presentation/bossSpellArt";
import { HIDDEN_EFFECT_DEPTH, FLOOR_HEIGHT } from "../presentation/arenaCamera";
import type { WorldOrigin } from "./effects";
import { Beam, createBeam, createEffect, destroyBeam, destroyEffect, Effect, moveBeam, setBeamColor, setEffectPosition, setEffectScale } from "wisp/game/effects";

export interface SpellZone { readonly x: number; readonly halfWidth: number; readonly bottom: number; readonly top: number }

export interface SpellCast {
  spell: BossSpell;
  strike: number;
  tell: number;
  active: number;
  into: number;
  zones: readonly SpellZone[];
  aimed: boolean;
  aimX: number;
  bossX: number;
  bossY: number;
  bossZ: number;
}

export const spellCast = (): SpellCast => ({ spell: BossSpell.rainOfFire, strike: -1, tell: 0, active: 0, into: 0, zones: [], aimed: false, aimX: 0.0, bossX: 0.0, bossY: 0.0, bossZ: 0.0 });

const centre = (cast: Readonly<SpellCast>, zone: Readonly<SpellZone>): number => cast.aimed ? f32(cast.aimX + zone.x) : zone.x;

interface Timed { readonly effect: Effect; readonly until: number }
interface Growing { readonly effect: Effect; readonly from: number; readonly to: number; readonly start: number; readonly end: number }

const FRONT = -40.0;
const COLUMN_TOP = 700.0;

export class BossSpells {
  private timed: Timed[] = [];
  private growing: Growing[] = [];
  private readonly aim: Beam;
  private readonly column: Beam;
  private strike = -1;
  private done = 0;
  private beamsUntil = -1;
  private frame = 0;

  constructor(private readonly origin: Readonly<WorldOrigin>) {
    const hidden = origin.z - FLOOR_HEIGHT - HIDDEN_EFFECT_DEPTH;
    this.aim = createBeam(FINGER_LIGHTNING, origin.x, origin.y, hidden, origin.x, origin.y, hidden);
    this.column = createBeam(FINGER_LIGHTNING, origin.x, origin.y, hidden, origin.x, origin.y, hidden);
    this.hideBeams();
  }

  present(cast: Readonly<SpellCast> | undefined): void {
    this.frame++;
    this.expire();
    if (cast === undefined) {
      this.endStrike();
      if (this.beamsUntil >= 0 && this.frame >= this.beamsUntil) this.hideBeams();
      return;
    }
    if (cast.strike !== this.strike) {
      this.endStrike();
      this.strike = cast.strike;
      this.done = 0;
    }
    if (cast.spell === BossSpell.rainOfFire) this.rainOfFire(cast);
    else if (cast.spell === BossSpell.fingerOfDeath) this.fingerOfDeath(cast);
    else this.shockwave(cast);
    for (const grown of this.growing) setEffectScale(grown.effect, growth(grown.from, grown.to, cast.into - grown.start, grown.end - grown.start));
    if (this.beamsUntil >= 0 && this.frame >= this.beamsUntil) this.hideBeams();
  }

  clear(): void {
    this.endStrike();
    for (const shown of this.timed) destroyEffect(shown.effect);
    this.timed = [];
    this.hideBeams();
    this.strike = -1;
  }

  private once(step: number, ready: boolean): boolean {
    const bit = 1 << step;
    if (!ready || (this.done & bit) !== 0) return false;
    this.done |= bit;
    return true;
  }

  private rainOfFire(cast: Readonly<SpellCast>): void {
    const activeEnd = cast.tell + cast.active;
    if (this.once(0, cast.into < cast.tell)) for (const zone of cast.zones) this.grow(COLUMN_FIRE_MODEL, centre(cast, zone), 0.0, COLUMN_FIRE_SCALE.from, COLUMN_FIRE_SCALE.to, 0, cast.tell, f32(zone.halfWidth / 90.0));
    if (this.once(1, cast.into >= cast.tell - RAIN_OF_FIRE_LANDS && cast.into < activeEnd)) {
      for (const zone of cast.zones) this.spawn(RAIN_OF_FIRE_MODEL, centre(cast, zone), 0.0, f32(RAIN_OF_FIRE_SCALE * f32(zone.halfWidth / 90.0)), RAIN_OF_FIRE_FRAMES - Math.max(0, cast.into - (cast.tell - RAIN_OF_FIRE_LANDS)));
    }
    if (this.once(2, cast.into >= cast.tell && cast.into < activeEnd)) {
      this.endGrowing();
      for (const zone of cast.zones) this.spawn(FIRE_BURST_MODEL, centre(cast, zone), 0.0, f32(FIRE_BURST_SCALE * f32(zone.halfWidth / 90.0)), FIRE_BURST_FRAMES);
    }
  }

  private fingerOfDeath(cast: Readonly<SpellCast>): void {
    const target = cast.zones[0] === undefined ? cast.aimX : centre(cast, cast.zones[0]);
    const { origin } = this;
    const activeEnd = cast.tell + cast.active;
    if (this.once(0, cast.into < cast.tell)) this.grow(FINGER_CHARGE_MODEL, target, FINGER_CHARGE_Z, FINGER_CHARGE_SCALE.from, FINGER_CHARGE_SCALE.to, 0, cast.tell, 1.0);
    const front = origin.y + FRONT;
    if (cast.into < activeEnd) {
      moveBeam(this.aim, origin.x + cast.bossX, cast.bossY, cast.bossZ + BOSS_HAND_Z, origin.x + target, front, origin.z + FINGER_CHARGE_Z);
      const alpha = cast.into < cast.tell ? growth(FINGER_AIM_ALPHA.from, FINGER_AIM_ALPHA.to, cast.into, cast.tell) : 1.0;
      setBeamColor(this.aim, 1.0, 1.0, 1.0, alpha);
      this.beamsUntil = -1;
    }
    if (this.once(1, cast.into >= cast.tell && cast.into < activeEnd)) {
      this.endGrowing();
      moveBeam(this.column, origin.x + target, front, origin.z + COLUMN_TOP, origin.x + target, front, origin.z);
      setBeamColor(this.column, 1.0, 1.0, 1.0, 1.0);
      this.spawn(FINGER_IMPACT_MODEL, target, 0.0, FINGER_IMPACT_SCALE, FINGER_IMPACT_FRAMES);
    }
    if (cast.into >= activeEnd && this.beamsUntil < 0 && (this.done & 2) !== 0) this.beamsUntil = this.frame + FINGER_LINGER_FRAMES;
  }

  private shockwave(cast: Readonly<SpellCast>): void {
    const activeEnd = cast.tell + cast.active;
    for (let index = 0; index < SHOCKWAVE_POINTS; index++) {
      const lit = shockwaveIgnition(index, cast.bossX, cast.tell);
      if (this.once(index, cast.into >= lit && cast.into < cast.tell)) this.grow(SHOCKWAVE_TRAIL_MODEL, shockwavePointX(index), 0.0, SHOCKWAVE_TRAIL_SCALE.from, SHOCKWAVE_TRAIL_SCALE.to, lit, cast.tell, 1.0);
    }
    if (this.once(SHOCKWAVE_POINTS, cast.into >= cast.tell && cast.into < activeEnd)) {
      for (let index = 0; index < SHOCKWAVE_POINTS; index++) this.spawn(SHOCKWAVE_MODEL, shockwavePointX(index), 0.0, SHOCKWAVE_PILLAR_SCALE, SHOCKWAVE_FRAMES);
    }
    if (cast.into >= activeEnd) this.endGrowing();
  }

  private place(model: string, x: number, z: number, scale: number): Effect {
    const { origin } = this;
    const effect = createEffect(model, origin.x + x, origin.y + FRONT);
    setEffectScale(effect, scale);
    setEffectPosition(effect, origin.x + x, origin.y + FRONT, origin.z + z);
    return effect;
  }

  private spawn(model: string, x: number, z: number, scale: number, frames: number): void {
    this.timed.push({ effect: this.place(model, x, z, scale), until: this.frame + Math.max(1, frames) });
  }

  private grow(model: string, x: number, z: number, from: number, to: number, start: number, end: number, width: number): void {
    const scaledFrom = f32(from * width), scaledTo = f32(to * width);
    this.growing.push({ effect: this.place(model, x, z, scaledFrom), from: scaledFrom, to: scaledTo, start, end });
  }

  private expire(): void {
    if (this.timed.length === 0) return;
    const kept: Timed[] = [];
    for (const shown of this.timed) {
      if (this.frame >= shown.until) destroyEffect(shown.effect);
      else kept.push(shown);
    }
    this.timed = kept;
  }

  private endGrowing(): void {
    for (const grown of this.growing) destroyEffect(grown.effect);
    this.growing = [];
  }

  private endStrike(): void {
    this.endGrowing();
    if (this.beamsUntil < 0 && (this.done & 2) !== 0 && this.strike >= 0) this.beamsUntil = this.frame + FINGER_LINGER_FRAMES;
  }

  private hideBeams(): void {
    const { origin } = this;
    const hidden = origin.z - FLOOR_HEIGHT - HIDDEN_EFFECT_DEPTH;
    for (const beam of [this.aim, this.column]) {
      moveBeam(beam, origin.x, origin.y, hidden, origin.x, origin.y, hidden);
      setBeamColor(beam, 1.0, 1.0, 1.0, 0.0);
    }
    this.beamsUntil = -1;
  }

  destroy(): void {
    this.clear();
    destroyBeam(this.aim);
    destroyBeam(this.column);
  }
}
