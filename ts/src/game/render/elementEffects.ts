





import { PARTICIPANT_SLOTS } from "../input/participants";
import { ELEMENTS, HIT_CUES, type HitCueSeen, advanceHitCueSeen, elementLook, hitCueSeen } from "../presentation/elementLooks";
import { characterModelScale } from "../presentation/modelScale";
import type { Fighter } from "../sim/fighter";
import { type ParkedFlags, type WorldOrigin, parkOnce, placeEffect } from "./effects";


const SHOWN = ELEMENTS.filter((element) => elementLook(element).victim !== undefined);

export class ElementEffects {

  private readonly models: readonly effect[];
  private parked: ParkedFlags | undefined;

  private readonly hitSerials: number[] = [0, 0, 0, 0];

  private readonly front: number;

  readonly hitCues: readonly effect[];
  private readonly hitCueSeen: HitCueSeen[] = PARTICIPANT_SLOTS.flatMap(() => HIT_CUES.map(() => hitCueSeen()));

  private readonly hitCueShown: number[] = PARTICIPANT_SLOTS.flatMap(() => HIT_CUES.map(() => -1));

  private readonly hitSounds: readonly (sound | undefined)[] = HIT_CUES.map((cue) => cue.look.sound === undefined ? undefined : CreateSoundFromLabel(cue.look.sound, false, true, true, 10, 10));

  constructor(private readonly origin: WorldOrigin) {
    this.front = origin.y - 10.0;
    this.models = PARTICIPANT_SLOTS.flatMap(() => SHOWN.map((element) => AddSpecialEffect(elementLook(element).victim ?? "", origin.x, origin.y)));
    this.hitCues = PARTICIPANT_SLOTS.flatMap(() => HIT_CUES.map((cue) => AddSpecialEffect(cue.look.model, origin.x, origin.y)));
    this.clear();
  }

  clear(): void {
    for (let slot = 0; slot < PARTICIPANT_SLOTS.length; slot++) this.hideSlot(slot);
  }

  hideSlot(slot: number): void {
    const parked = (this.parked ??= []);
    for (let index = 0; index < SHOWN.length; index++) {
      const model = this.models[slot * SHOWN.length + index];
      if (model !== undefined) parkOnce(model, this.origin, parked, slot * SHOWN.length + index);
    }
    for (let cue = 0; cue < HIT_CUES.length; cue++) this.hideHitCue(slot * HIT_CUES.length + cue);
  }

  private hideHitCue(at: number): void {
    const model = this.hitCues[at];
    if (model !== undefined) parkOnce(model, this.origin, (this.parked ??= []), this.models.length + at);
    this.hitCueShown[at] = -1;
  }

  present(fighter: Readonly<Fighter>, slot: number): void {
    const { launch, visuals } = fighter;
    const shown = !fighter.status.out && (launch.hitlag > 0 || launch.hitstun > 0) ? SHOWN.indexOf(visuals.hitElement) : -1;
    const parked = (this.parked ??= []);
    const scale = characterModelScale(fighter.character);
    for (let index = 0; index < SHOWN.length; index++) {
      const at = slot * SHOWN.length + index;
      const model = this.models[at];
      if (model === undefined) continue;
      if (index !== shown) {
        parkOnce(model, this.origin, parked, at);
        continue;
      }
      parked[at] = false;
      if (this.hitSerials[slot] !== visuals.hit) BlzSetSpecialEffectTime(model, 0.0);
      placeEffect(model, this.origin.x + fighter.motion.x, this.front, this.origin.z + fighter.motion.z + 45.0 * scale);
      BlzSetSpecialEffectScale(model, elementLook(visuals.hitElement).victimScale * scale);
      BlzSetSpecialEffectAlpha(model, 255);
    }
    this.hitSerials[slot] = visuals.hit;
    for (let cue = 0; cue < HIT_CUES.length; cue++) this.presentHitCue(fighter, slot, cue, scale);
  }

  private presentHitCue(fighter: Readonly<Fighter>, slot: number, cue: number, scale: number): void {
    const at = slot * HIT_CUES.length + cue;
    const kind = HIT_CUES[cue];
    const seen = this.hitCueSeen[at];
    const model = this.hitCues[at];
    if (kind === undefined || seen === undefined || model === undefined) return;
    if (!advanceHitCueSeen(seen, kind.serial(fighter), fighter)) {
      if (this.hitCueShown[at] !== -1) this.hideHitCue(at);
      return;
    }
    (this.parked ??= [])[this.models.length + at] = false;
    const { look } = kind;
    if (this.hitCueShown[at] !== fighter.visuals.hit) {
      BlzSetSpecialEffectAnimation(model, look.sequence);
      BlzSetSpecialEffectTime(model, look.seconds);
      this.hitCueShown[at] = fighter.visuals.hit;
      const sound = this.hitSounds[cue];
      if (sound !== undefined) {
        StopSound(sound, false, false);
        SetSoundPosition(sound, this.origin.x + fighter.motion.x, this.origin.y, this.origin.z + fighter.motion.z);
        SetSoundVolume(sound, 127);
        StartSound(sound);
      }
    }
    placeEffect(model, this.origin.x + fighter.motion.x, this.front, this.origin.z + fighter.motion.z + look.z * scale);
    BlzSetSpecialEffectScale(model, look.scale * scale);
    BlzSetSpecialEffectAlpha(model, 255);
  }

  setPaused(paused: boolean): void {
    for (const model of [...this.models, ...this.hitCues]) BlzSetSpecialEffectTimeScale(model, paused ? 0.0 : 1.0);
  }

  destroy(): void {
    for (const model of [...this.models, ...this.hitCues]) DestroyEffect(model);
  }
}
