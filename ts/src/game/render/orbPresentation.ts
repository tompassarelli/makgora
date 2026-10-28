import { ORB_HEIGHT, type OrbClock, orbPoint, orbWarned, orbWarningFrames } from "../sim/orbs";
import { ORB_MARKER_SCALE_END, ORB_SCALE, type OrbSighting, createOrbSighting, orbMarkerAlpha, orbMarkerScale, sightOrb } from "../presentation/orbLook";
import { hideEffect, STOCK_MODELS, type WorldOrigin } from "./effects";

export class OrbPresentation {
  private readonly marker: effect;
  private readonly orb: effect;
  private markerShown = false;
  private shown = false;
  private bursting = false;
  private shownStage = -1;
  private sighting?: OrbSighting;

  constructor(private readonly origin: Readonly<WorldOrigin>) {
    this.marker = AddSpecialEffect(STOCK_MODELS.massTeleportTarget, origin.x, origin.y);
    this.orb = AddSpecialEffect(STOCK_MODELS.fireBallMissile, origin.x, origin.y);
    hideEffect(this.marker, origin);
    hideEffect(this.orb, origin);
  }

  present(game: Readonly<OrbClock>, stage: number, playing: boolean): void {
    const point = orbPoint(stage);
    if (playing && orbWarned(game)) {
      const left = orbWarningFrames(game);
      BlzSetSpecialEffectPosition(this.marker, this.origin.x + point.x, this.origin.y, this.origin.z + point.z);
      BlzSetSpecialEffectScale(this.marker, left === undefined ? ORB_MARKER_SCALE_END : orbMarkerScale(left));
      BlzSetSpecialEffectAlpha(this.marker, orbMarkerAlpha(left ?? game.matchFrame));
      this.markerShown = true;
    } else if (this.markerShown) {
      hideEffect(this.marker, this.origin);
      this.markerShown = false;
    }
    const seen = this.sighting ??= createOrbSighting();
    sightOrb(seen, game.orbs, game.matchFrame);
    const live = playing && seen.shown;
    const bursting = live && seen.bursting;
    if (live === this.shown && bursting === this.bursting && stage === this.shownStage) return;
    if (this.shown && !live) hideEffect(this.orb, this.origin);
    if (live) {
      BlzSetSpecialEffectPosition(this.orb, this.origin.x + point.x, this.origin.y, this.origin.z + point.z + ORB_HEIGHT);
      BlzSetSpecialEffectScale(this.orb, ORB_SCALE);
      BlzPlaySpecialEffect(this.orb, bursting ? ANIM_TYPE_DEATH : ANIM_TYPE_STAND);
    }
    this.shown = live;
    this.bursting = bursting;
    this.shownStage = stage;
  }
}
