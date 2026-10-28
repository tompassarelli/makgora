import { characterModelScale } from "../presentation/modelScale";
import type { FighterDraw } from "../presentation/fighterDraw";
import { PARASOL_FOLD_FRAMES, PARASOL_GRIP, PARASOL_MODEL, parasolShown } from "../presentation/parasolLook";
import type { Fighter } from "../sim/fighter";
import { effectMotion, placeEffect, type WorldOrigin } from "./effects";

export class ParasolPresentation {
  private parasol: effect | undefined;
  private foldFrame: number | undefined;

  constructor(private readonly origin: Readonly<WorldOrigin>) {}

  /** Placed from the body's own draw on the presented frame, so it moves with the drawn model. */
  present(fighter: Readonly<Fighter> | undefined, draw: Readonly<FighterDraw>, drawn: boolean, frame: number): void {
    if (fighter === undefined || !drawn || fighter.status.out) {
      this.hide();
      return;
    }
    if (parasolShown(fighter)) {
      if (this.foldFrame !== undefined) this.hide();
      this.parasol ??= AddSpecialEffect(PARASOL_MODEL, this.origin.x, this.origin.y);
      this.place(this.parasol, fighter, draw);
      return;
    }
    const parasol = this.parasol;
    if (parasol === undefined) return;
    if (this.foldFrame === undefined) {
      BlzPlaySpecialEffect(parasol, ANIM_TYPE_DEATH);
      this.foldFrame = frame;
    } else if (frame < this.foldFrame || frame - this.foldFrame >= PARASOL_FOLD_FRAMES) {
      this.hide();
      return;
    }
    this.place(parasol, fighter, draw);
  }

  private place(parasol: effect, fighter: Readonly<Fighter>, draw: Readonly<FighterDraw>): void {
    const scale = characterModelScale(fighter.character);
    BlzSetSpecialEffectScale(parasol, scale);
    placeEffect(parasol, this.origin.x + draw.x + draw.facing * PARASOL_GRIP.x * scale, this.origin.y + draw.y, this.origin.z + draw.z + PARASOL_GRIP.z * scale);
  }

  drawnEffects(into: effect[]): void {
    if (this.parasol !== undefined) into.push(this.parasol);
  }

  hide(): void {
    const parasol = this.parasol;
    this.foldFrame = undefined;
    if (parasol === undefined) return;
    effectMotion().release(parasol);
    BlzSetSpecialEffectScale(parasol, 0.0);
    DestroyEffect(parasol);
    this.parasol = undefined;
  }

  destroy(): void {
    this.hide();
  }
}
