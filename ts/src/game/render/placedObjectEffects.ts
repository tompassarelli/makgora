


import { f32 } from "wisp/src/sim/f32";
import { idiv } from "wisp/src/sim/intMath";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { type Fighter, PACK_CAPACITY, type PlacedObject, placedObject } from "../sim/fighter";
import type { Resting } from "../sim/fighterRest";
import { type AuthoredSpecial, CompanionMode, type SpecialPlacement } from "../sim/specials/schema";
import { specialPlacements } from "../sim/specials/placements";
import { Character } from "../sim/codes";
import { authoredTuning } from "../sim/tuning";
import { heroLook } from "../roster/looks";
import { type ParkedFlags, type WorldOrigin, parkOnce, placeEffect } from "./effects";
import { bearState } from "../presentation/bearFeedback";
import { BearFeedback } from "./bearFeedback";
import { bindPrototype } from "../../platform/rebind";
import { createEffect, destroyEffect, Effect, EffectAnimation, playEffectAnimation, setEffectAlpha, setEffectBlendTime, setEffectPitch, setEffectScale, setEffectTeamColor, setEffectTime, setEffectTimeScale, setEffectYaw } from "wisp/game/effects";
import { player } from "wisp/game/players";


const PLACED_OBJECT_MODEL = "Units\\Orc\\SerpentWard\\SerpentWard.mdx";
const MODEL_HEIGHT = 105.0;
const MODEL_TURN = f32(0.785398185);
interface PlacedLook { readonly path: string; readonly height: number; readonly alpha: number; readonly finished?: true; readonly casts?: true; readonly turn?: number }
const DEFAULT_LOOK: PlacedLook = { path: PLACED_OBJECT_MODEL, height: MODEL_HEIGHT, alpha: 255, turn: MODEL_TURN };
const ANIMALS = PACK_CAPACITY + 1;
const BIRTH_SECONDS = 60.0;
const DEATH_SECONDS = f32(2.333);
const SPIRIT_BIRTH_FRAMES = 30;
const SPIRIT_BIRTH_SECONDS = f32(0.5);
const SPIRIT_CAST_FRAMES = 30;
const VANISHED_ALPHA = 40;

function placementPaths(character: Character): string[] {
  const paths = [heroLook(character)?.placedModel?.path ?? PLACED_OBJECT_MODEL];
  const visit = (special: AuthoredSpecial | undefined): void => {
    if (special === undefined) return;
    for (const placement of specialPlacements(special)) {
      const path = placement.model?.path;
      if (path !== undefined && !paths.includes(path)) paths.push(path);
    }
    const summoned = special.targetedStrike?.curse?.summon.model?.path;
    if (summoned !== undefined && !paths.includes(summoned)) paths.push(summoned);
    for (const followUp of special.followUps ?? []) visit(followUp.special);
    for (const variant of special.variants ?? []) visit(variant);
  };
  const tuning = authoredTuning(character);
  const specials = tuning.specials;
  if (specials !== undefined) for (const kit of [specials.neutral, specials.side, specials.up, specials.down]) {
    visit(kit.ground);
    visit(kit.air);
    visit(kit.recall);
  }
  visit(tuning.ultimate);
  return paths;
}

function placedAlpha(placed: Resting<PlacedObject>, spec: Readonly<SpecialPlacement>, look: PlacedLook): number {
  if (placed.mode === CompanionMode.vanished) return VANISHED_ALPHA;
  const left = f32(Math.max(0.0, placed.durability) / spec.durability);
  const half = idiv(look.alpha, 2);
  return half + Math.floor(f32((look.alpha - half) * left));
}

export class PlacedObjectEffects {
  private readonly models: Effect[];
  private readonly paths: string[];

  private readonly anims: number[] = [];
  private attackStarts: number[] | undefined;
  private readonly lastX: number[] = [];
  private parked: ParkedFlags | undefined;
  private feedback: BearFeedback;
  private prepared: ({ [path: string]: Effect | undefined } | undefined)[] | undefined;

  constructor(private readonly origin: WorldOrigin) {
    this.feedback = new BearFeedback(origin);
    this.models = [];
    this.paths = [];
    for (const slot of PARTICIPANT_SLOTS) for (let animal = 0; animal < ANIMALS; animal++) {
      this.models.push(createEffect(PLACED_OBJECT_MODEL, origin.x, origin.y));
      this.paths.push(PLACED_OBJECT_MODEL);
    }
    this.clear();
  }


  // A match start is synchronized, so every client makes each fighter's placed-object looks there rather than on a confirmed frame.
  prepareFighter(slot: number, character: Character): void {
    const prepared = (this.prepared ??= []);
    const parked = (this.parked ??= []);
    const paths = placementPaths(character);
    const imagePath = character === Character.blademaster ? heroLook(character)?.placedModel?.path : undefined;
    for (let animal = 0; animal < ANIMALS; animal++) {
      const index = slot * ANIMALS + animal;
      const current = this.models[index];
      for (const model of Object.values(prepared[index] ?? {})) if (model !== undefined && model !== current) destroyEffect(model);
      const looks: { [path: string]: Effect | undefined } = {};
      if (current !== undefined) looks[this.paths[index] ?? PLACED_OBJECT_MODEL] = current;
      for (const path of paths) {
        let model = looks[path];
        if (model === undefined) {
          model = createEffect(path, this.origin.x, this.origin.y);
          setEffectBlendTime(model, 0.0);
          parkOnce(model, this.origin, [], 0);
          looks[path] = model;
        }
        if (path === imagePath) setEffectTeamColor(model, player(slot));
      }
      prepared[index] = looks;
      parked[index] = false;
      if (current !== undefined) parkOnce(current, this.origin, parked, index);
    }
  }

  private modelFor(slot: number, path: string): Effect | undefined {
    const current = this.models[slot];
    if (current === undefined || this.paths[slot] === path) return current;
    const model = this.prepared?.[slot]?.[path];
    if (model === undefined) return current;
    const parked = (this.parked ??= []);
    parked[slot] = false;
    parkOnce(current, this.origin, parked, slot);
    this.models[slot] = model;
    this.paths[slot] = path;
    return model;
  }

  slotEffects(slot: number, into: Effect[]): void {
    for (let animal = 0; animal < ANIMALS; animal++) {
      const model = this.models[slot * ANIMALS + animal];
      if (model !== undefined) into.push(model);
    }
  }

  clear(): void {
    for (let slot = 0; slot < this.models.length; slot++) this.hideModel(slot);
    this.feedback.clear();
  }

  bindNestedCode(): void {
    this.feedback ??= new BearFeedback(this.origin);
    bindPrototype(this.feedback, BearFeedback.prototype);
  }

  presentConfirmed(frame: number, fighter: Readonly<Fighter>, slot: number): void {
    for (let animal = 0; animal <= fighter.pack.length; animal++) {
      const placed = placedObject(fighter, animal);
      const look = placed.spec?.model ?? heroLook(fighter.character)?.placedModel ?? DEFAULT_LOOK;
      this.modelFor(slot * ANIMALS + animal, look.path);
    }
    this.feedback.confirm(frame, fighter, slot);
  }

  hideSlot(slot: number): void {
    for (let animal = 0; animal < ANIMALS; animal++) this.hideModel(slot * ANIMALS + animal);
    this.feedback.hide(slot);
  }

  private hideModel(slot: number): void {
    const model = this.models[slot];
    if (model === undefined) return;
    parkOnce(model, this.origin, (this.parked ??= []), slot);
  }

  present(fighter: Readonly<Fighter>, slot: number): void {
    for (let animal = 0; animal < ANIMALS; animal++) {
      if (animal > fighter.pack.length) this.hideModel(slot * ANIMALS + animal);
      else this.presentAnimal(fighter, placedObject(fighter, animal), slot * ANIMALS + animal);
    }
    this.feedback.present(fighter, slot);
  }

  private presentAnimal(fighter: Readonly<Fighter>, placed: Resting<PlacedObject>, slot: number): void {
    const look: PlacedLook = placed.spec?.model ?? heroLook(fighter.character)?.placedModel ?? DEFAULT_LOOK;

    const model = this.paths[slot] === look.path ? this.models[slot] : undefined;
    const spec = placed.spec;
    if (model === undefined) return;
    if (placed.life <= 0 || spec === undefined || fighter.status.out) {
      this.hideModel(slot);
      return;
    }
    const parked = (this.parked ??= []);
    parked[slot] = false;
    const { x, y, z } = this.origin;
    placeEffect(model, x + placed.x, y, z + placed.z);
    const turn = look.turn ?? 0.0;
    setEffectYaw(model, placed.direction > 0 ? -turn : f32(f32(3.14159274) + turn));
    const bear = placed === fighter.placed ? bearState(fighter) : undefined;
    this.pose(model, slot, placed, spec, look, bear);
    setEffectScale(model, f32(spec.height / look.height * (bear === "CHARGING" ? 1.25 : 1.0)));
    setEffectAlpha(model, placedAlpha(placed, spec, look));
  }

  private pose(model: Effect, slot: number, placed: Resting<PlacedObject>, spec: Readonly<SpecialPlacement>, look: PlacedLook, bear: ReturnType<typeof bearState>): void {
    if (look.casts === true) this.cast(model, slot, placed, spec.crumble ?? 0);
    else if (spec.companion !== undefined) this.animate(model, slot, placed, bear);
    else if (spec.crumble !== undefined) this.build(model, slot, placed, spec.crumble, spec.fireAges[0] ?? 1);
    else if (look.finished === true) this.build(model, slot, placed, 0, 0);
    else this.animate(model, slot, placed, bear);
  }

  private cast(model: Effect, slot: number, placed: Resting<PlacedObject>, crumble: number): void {
    let anim = placed.life <= crumble ? 3 : placed.age < SPIRIT_BIRTH_FRAMES ? 4 : 0;
    let start = placed.serial;
    if (anim === 0) for (const fire of placed.spec?.fireAges ?? []) if (placed.age >= fire && placed.age < fire + SPIRIT_CAST_FRAMES) {
      anim = 2;
      start = fire;
    }
    const attackStarts = (this.attackStarts ??= []);
    if (this.anims[slot] === anim && attackStarts[slot] === start) return;
    this.anims[slot] = anim;
    attackStarts[slot] = start;
    playEffectAnimation(model, anim === 3 ? EffectAnimation.death : anim === 4 ? EffectAnimation.birth : anim === 2 ? EffectAnimation.spell : EffectAnimation.stand);
    setEffectTimeScale(model, anim === 4 ? f32(SPIRIT_BIRTH_SECONDS / f32(SPIRIT_BIRTH_FRAMES / 60.0)) : 1.0);
  }


  private build(model: Effect, slot: number, placed: Resting<PlacedObject>, crumble: number, built: number): void {
    const anim = placed.life <= crumble ? 3 : placed.age < built ? 4 : 0;
    const attackStarts = (this.attackStarts ??= []);
    if (this.anims[slot] === anim && attackStarts[slot] === placed.serial) return;
    this.anims[slot] = anim;
    attackStarts[slot] = placed.serial;
    playEffectAnimation(model, anim === 3 ? EffectAnimation.death : anim === 4 ? EffectAnimation.birth : EffectAnimation.stand);
    setEffectTimeScale(model, anim === 3 ? f32(DEATH_SECONDS / f32(crumble / 60.0)) : anim === 4 ? f32(BIRTH_SECONDS / f32(built / 60.0)) : 1.0);
  }

  private animate(model: Effect, slot: number, placed: Resting<PlacedObject>, bear: ReturnType<typeof bearState>): void {
    const { x, mode } = placed;
    const partner = placed.spec?.companion;
    let attackStart = -1;
    let pitch = 0.0;
    let speed = 1.0;
    if (partner !== undefined && mode === CompanionMode.lunge) {
      if (partner.behavior === "sentry") {
        for (const fire of partner.volleyFrames ?? []) {
          if (placed.modeFrame >= fire - 4 && placed.modeFrame < fire + 4) {
            attackStart = placed.age - placed.modeFrame + fire;
            pitch = placed.modeFrame < fire ? f32(-0.2) : 0.0;
            speed = 4.0;
          }
        }
      } else {
        attackStart = placed.age - placed.modeFrame;
        speed = f32(80.0 / (partner.lungeStartup + partner.lungeActive + partner.lungeRecovery));
        if (placed.modeFrame <= partner.lungeStartup) pitch = f32(-0.25);
        else if (placed.modeFrame <= partner.lungeStartup + partner.lungeActive) pitch = partner.behavior === "flying" ? f32(0.7) : f32(0.15);
      }
    } else if (mode === CompanionMode.follow && placed.spec?.aura !== true) {
      for (const fire of placed.spec?.fireAges ?? []) {
        if (placed.age >= fire && placed.age < fire + 8) {
          attackStart = fire;
          speed = 4.0;
        }
      }
    }
    if (bear === "CHARGING") { attackStart = -1; pitch = f32(-0.85); speed = 0.0; }
    else if (bear === "ATTACKING" || bear === "RESTING" && mode === CompanionMode.lunge) speed = 1.5;
    setEffectPitch(model, pitch);
    setEffectTimeScale(model, speed);
    const moved = this.lastX[slot] !== undefined && this.lastX[slot] !== x;
    this.lastX[slot] = x;
    const anim = attackStart >= 0 ? 2 : moved ? 1 : 0;
    const attackStarts = (this.attackStarts ??= []);
    if (this.anims[slot] === anim && attackStarts[slot] === attackStart) return;
    this.anims[slot] = anim;
    attackStarts[slot] = attackStart;
    playEffectAnimation(model, anim === 2 ? EffectAnimation.attack : anim === 1 ? EffectAnimation.walk : EffectAnimation.stand);
    if (bear === "ATTACKING") setEffectTime(model, f32(0.5));
  }

  destroy(): void {
    for (const model of this.models) destroyEffect(model);
    for (let index = 0; index < this.models.length; index++) for (const model of Object.values(this.prepared?.[index] ?? {})) if (model !== undefined && model !== this.models[index]) destroyEffect(model);
    this.feedback.destroy();
  }
}
