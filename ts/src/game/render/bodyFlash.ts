import { HEAVY_SHEEN, HEAVY_SHEEN_ALPHA, heavySheen } from "../presentation/itemLook";
import { fighterModelReplaced } from "../presentation/fighterForm";
import type { FighterDraw } from "../presentation/fighterDraw";
import { createWhiteGlowState, whiteGlowAlpha } from "../presentation/whiteGlow";
import { GOLD_SACK_GLOW, goldSackGlowAlpha } from "../presentation/peonPose";
import type { Character } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import type { MatchCamera } from "../sim/matchCamera";
import type { WorldOrigin } from "./effects";
import { PosedWhiteModel } from "./posedWhiteModel";
import type { Effect } from "wisp/game/effects";

const FLASH_LIFT = 8.0;

export class BodyFlash {
  private readonly model: PosedWhiteModel;
  private readonly state = createWhiteGlowState();

  constructor(character: Character, origin: WorldOrigin, bodyScale: number) {
    this.model = new PosedWhiteModel(character, origin, bodyScale);
  }

  present(fighter: Readonly<Fighter> | undefined, draw: Readonly<FighterDraw>, drawn: boolean, frame: number, camera: Readonly<MatchCamera>): void {
    const glow = fighter === undefined ? 0 : whiteGlowAlpha(this.state, fighter, frame);
    const gold = glow === 0 && fighter !== undefined ? goldSackGlowAlpha(fighter) : 0;
    const sheen = glow === 0 && gold === 0 && fighter !== undefined && heavySheen(fighter);
    const alpha = sheen ? HEAVY_SHEEN_ALPHA : gold > 0 ? gold : glow;
    const tint = sheen ? HEAVY_SHEEN : gold > 0 ? GOLD_SACK_GLOW : undefined;
    if (fighter === undefined || alpha === 0 || fighterModelReplaced(fighter) || !drawn || !this.model.pose(draw, camera, FLASH_LIFT, 1.0, 0.0)) {
      this.model.hide();
      return;
    }
    this.model.tint(alpha, tint?.red ?? 255, tint?.green ?? 255, tint?.blue ?? 255);
  }

  drawnEffects(into: Effect[]): void {
    this.model.drawnEffects(into);
  }

  destroy(): void {
    this.model.destroy();
  }
}
