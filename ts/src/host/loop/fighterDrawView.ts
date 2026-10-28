import { type FighterDraw, fitFighterDraw } from "../../game/presentation/fighterDraw";
import type { FighterPose } from "../../game/presentation/fighterPose";
import type { BodyFlash } from "../../game/render/bodyFlash";
import type { FighterPoolPresentation } from "../../game/render/fighterPool";
import type { MeterGlow } from "../../game/render/meterGlow";
import type { ParasolPresentation } from "../../game/render/parasolPresentation";
import type { Character } from "../../game/sim/codes";
import type { Fighter } from "../../game/sim/fighter";
import type { MatchCamera } from "../../game/sim/matchCamera";

interface DrawnBody {
  readonly character: Character;
  readonly pool: FighterPoolPresentation | undefined;
  readonly flash: BodyFlash;
  readonly glow: MeterGlow;
  readonly parasol: ParasolPresentation | undefined;
  readonly draw: FighterDraw;
}

/** Fits the fighter's draw once and presents the body, white flash, meter rim and parasol from it; `body` shows the pool body, `posed` the overlays. */
export function presentDrawnBody(renderers: DrawnBody, fighter: Readonly<Fighter> | undefined, body: boolean, posed: Readonly<Fighter> | undefined, pose: Readonly<FighterPose>, stage: number, frame: number, matchFrame: number, camera: Readonly<MatchCamera>, ultimatesOff: boolean): void {
  const drawn = fighter !== undefined && fitFighterDraw(renderers.draw, renderers.character, fighter, pose, stage, frame, matchFrame);
  if (renderers.pool !== undefined) {
    if (fighter !== undefined && body) renderers.pool.present(fighter, renderers.draw, drawn, frame);
    else renderers.pool.hide();
  }
  renderers.flash.present(posed, renderers.draw, drawn, frame, camera);
  renderers.glow.present(posed, renderers.draw, drawn, frame, camera, ultimatesOff);
  renderers.parasol?.present(posed, renderers.draw, drawn, frame);
}
