import { fighterModelScale } from "../presentation/fighterScale";
import type { FighterDraw } from "../presentation/fighterDraw";
import { PARASOL_FOLD_FRAMES, PARASOL_GRIP, PARASOL_MODEL, parasolShown } from "../presentation/parasolLook";
import type { Fighter } from "../sim/fighter";
import { hideEffect, placeEffect, type WorldOrigin } from "./effects";

export class ParasolPresentation {
  // Online, Warcraft handles must be born on the same turn on every client, so the parasol is made at setup and only shown and hidden on presented frames.
  private readonly parasol: effect;
  private shown = false;
  private foldFrame: number | undefined;

  constructor(private readonly origin: Readonly<WorldOrigin>) {
    this.parasol = AddSpecialEffect(PARASOL_MODEL, origin.x, origin.y);
    hideEffect(this.parasol, origin);
  }

  /** Placed from the body's own draw on the presented frame, so it moves with the drawn model. */
  present(fighter: Readonly<Fighter> | undefined, draw: Readonly<FighterDraw>, drawn: boolean, frame: number): void {
    if (fighter === undefined || !drawn || fighter.status.out) {
      this.hide();
      return;
    }
    if (parasolShown(fighter)) {
      if (this.foldFrame !== undefined) this.hide();
      if (!this.shown) BlzPlaySpecialEffect(this.parasol, ANIM_TYPE_BIRTH);
      this.shown = true;
      this.place(fighter, draw);
      return;
    }
    if (!this.shown) return;
    if (this.foldFrame === undefined) {
      BlzPlaySpecialEffect(this.parasol, ANIM_TYPE_DEATH);
      this.foldFrame = frame;
    } else if (frame < this.foldFrame || frame - this.foldFrame >= PARASOL_FOLD_FRAMES) {
      this.hide();
      return;
    }
    this.place(fighter, draw);
  }

  private place(fighter: Readonly<Fighter>, draw: Readonly<FighterDraw>): void {
    const scale = fighterModelScale(fighter);
    BlzSetSpecialEffectScale(this.parasol, scale);
    placeEffect(this.parasol, this.origin.x + draw.x + draw.facing * PARASOL_GRIP.x * scale, this.origin.y + draw.y, this.origin.z + draw.z + PARASOL_GRIP.z * scale);
  }

  drawnEffects(into: effect[]): void {
    if (this.shown) into.push(this.parasol);
  }

  hide(): void {
    this.foldFrame = undefined;
    if (!this.shown) return;
    this.shown = false;
    hideEffect(this.parasol, this.origin);
  }

  destroy(): void {
    this.hide();
    DestroyEffect(this.parasol);
  }
}
