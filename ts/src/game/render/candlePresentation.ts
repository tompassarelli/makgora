import { at } from "wisp/src/runtime/lookup";
import { fitFighterPlacement } from "../presentation/fighterPlacement";
import { characterModelScale } from "../presentation/modelScale";
import { CANDLE_FLAMES } from "../presentation/candleLook";
import { CandleState } from "../sim/codes";
import { fighterPoseFacing } from "../sim/conditions";
import type { Fighter } from "../sim/fighter";
import { candleLevel } from "../sim/heroes/koboldCandle";
import { definitiveCues } from "./specialCueEffects";
import { facingYaw, hideEffect, placeEffect, type WorldOrigin } from "./effects";

const CLASSIC_TIP = { x: 8.0, z: 74.0 };
const DEFINITIVE_TIP = { x: 8.0, z: 74.0 };

export class CandlePresentation {
  private readonly flames: effect[] = [];
  private readonly placement = { x: 0.0, z: 0.0 };
  private readonly tip = definitiveCues() ? DEFINITIVE_TIP : CLASSIC_TIP;
  private shown = -1;
  private paused = false;

  constructor(private readonly origin: Readonly<WorldOrigin>) {
    for (const level of CANDLE_FLAMES) {
      const model = AddSpecialEffect(level.model, origin.x, origin.y);
      hideEffect(model, origin);
      this.flames.push(model);
    }
  }

  present(fighter: Readonly<Fighter> | undefined, stage: number): void {
    const level = fighter === undefined || fighter.status.out || fighter.candle.state !== CandleState.held || !fighter.candle.lit ? -1 : candleLevel(fighter);
    if (level !== this.shown && this.shown >= 0) hideEffect(at(this.flames, this.shown), this.origin);
    this.shown = level;
    if (fighter === undefined || level < 0) return;
    const model = at(this.flames, level);
    const facing = fighterPoseFacing(fighter);
    const scale = characterModelScale(fighter.character);
    fitFighterPlacement(this.placement, fighter, stage);
    placeEffect(model, this.origin.x + this.placement.x + this.tip.x * scale * facing, this.origin.y, this.origin.z + this.placement.z + this.tip.z * scale);
    BlzSetSpecialEffectYaw(model, facingYaw(facing));
    BlzSetSpecialEffectScale(model, at(CANDLE_FLAMES, level).scale * scale);
    BlzSetSpecialEffectTimeScale(model, this.paused ? 0.0 : 1.0);
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    if (this.shown >= 0) BlzSetSpecialEffectTimeScale(at(this.flames, this.shown), paused ? 0.0 : 1.0);
  }

  drawnEffects(into: effect[]): void {
    for (const model of this.flames) into.push(model);
  }

  hide(): void {
    if (this.shown >= 0) hideEffect(at(this.flames, this.shown), this.origin);
    this.shown = -1;
  }

  destroy(): void {
    for (const model of this.flames) {
      hideEffect(model, this.origin);
      DestroyEffect(model);
    }
  }
}
