import { ORB_HEIGHT, type OrbClock, orbPoint, orbWarningFrames, warnedOrb } from "../sim/orbs";
import { OrbKind } from "../sim/orbState";
import { ORB_MARKER_SCALE_END, orbMarkerAlpha, orbMarkerScale, orbScale } from "../presentation/orbLook";
import { hideEffect, STOCK_MODELS, type WorldOrigin } from "./effects";

export class OrbPresentation {
  private readonly marker: effect;
  private readonly exOrb: effect;
  private readonly ultimateOrb: effect;
  private markerShown = false;
  private shown: OrbKind = OrbKind.none;
  private shownStage = -1;

  constructor(private readonly origin: Readonly<WorldOrigin>) {
    this.marker = AddSpecialEffect(STOCK_MODELS.massTeleportTarget, origin.x, origin.y);
    this.exOrb = AddSpecialEffect(STOCK_MODELS.frostWyrmMissile, origin.x, origin.y);
    this.ultimateOrb = AddSpecialEffect(STOCK_MODELS.fireBallMissile, origin.x, origin.y);
    hideEffect(this.marker, origin);
    hideEffect(this.exOrb, origin);
    hideEffect(this.ultimateOrb, origin);
  }

  present(game: Readonly<OrbClock>, stage: number, playing: boolean): void {
    const point = orbPoint(stage);
    const warned = playing ? warnedOrb(game) : OrbKind.none;
    if (warned !== OrbKind.none) {
      const left = orbWarningFrames(game);
      BlzSetSpecialEffectPosition(this.marker, this.origin.x + point.x, this.origin.y, this.origin.z + point.z);
      BlzSetSpecialEffectScale(this.marker, left === undefined ? ORB_MARKER_SCALE_END : orbMarkerScale(left));
      BlzSetSpecialEffectAlpha(this.marker, orbMarkerAlpha(left ?? game.matchFrame));
      this.markerShown = true;
    } else if (this.markerShown) {
      hideEffect(this.marker, this.origin);
      this.markerShown = false;
    }
    const live = playing ? game.orbs.live : OrbKind.none;
    if (live === this.shown && stage === this.shownStage) return;
    if (this.shown !== OrbKind.none) hideEffect(this.orb(this.shown), this.origin);
    if (live !== OrbKind.none) {
      const orb = this.orb(live);
      BlzSetSpecialEffectPosition(orb, this.origin.x + point.x, this.origin.y, this.origin.z + point.z + ORB_HEIGHT);
      BlzSetSpecialEffectScale(orb, orbScale(live));
    }
    this.shown = live;
    this.shownStage = stage;
  }

  private orb(kind: OrbKind): effect {
    return kind === OrbKind.ultimate ? this.ultimateOrb : this.exOrb;
  }
}
