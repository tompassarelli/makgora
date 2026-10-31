import { ORB_HEIGHT, type OrbClock, orbPoint, orbWarned, orbWarningFrames } from "../sim/orbs";
import { ORB_MARKER_SCALE_END, ORB_SCALE, type OrbSighting, createOrbSighting, orbMarkerAlpha, orbMarkerScale, sightOrb } from "../presentation/orbLook";
import { hideEffect, STOCK_MODELS, type WorldOrigin } from "./effects";
import { createEffect, Effect, EffectAnimation, playEffectAnimation, setEffectAlpha, setEffectPosition, setEffectScale } from "wisp/game/effects";

export class OrbPresentation {
  private readonly marker: Effect;
  private readonly orb: Effect;
  private markerShown = false;
  private shown = false;
  private bursting = false;
  private shownStage = -1;
  private sighting?: OrbSighting;

  constructor(private readonly origin: Readonly<WorldOrigin>) {
    this.marker = createEffect(STOCK_MODELS.massTeleportTarget, origin.x, origin.y);
    this.orb = createEffect(STOCK_MODELS.fireBallMissile, origin.x, origin.y);
    hideEffect(this.marker, origin);
    hideEffect(this.orb, origin);
  }

  present(game: Readonly<OrbClock>, stage: number, playing: boolean): void {
    const point = orbPoint(stage);
    if (playing && orbWarned(game)) {
      const left = orbWarningFrames(game);
      setEffectPosition(this.marker, this.origin.x + point.x, this.origin.y, this.origin.z + point.z);
      setEffectScale(this.marker, left === undefined ? ORB_MARKER_SCALE_END : orbMarkerScale(left));
      setEffectAlpha(this.marker, orbMarkerAlpha(left ?? game.matchFrame));
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
      setEffectPosition(this.orb, this.origin.x + point.x, this.origin.y, this.origin.z + point.z + ORB_HEIGHT);
      setEffectScale(this.orb, ORB_SCALE);
      playEffectAnimation(this.orb, bursting ? EffectAnimation.death : EffectAnimation.stand);
    }
    this.shown = live;
    this.bursting = bursting;
    this.shownStage = stage;
  }
}
