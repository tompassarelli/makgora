import { HEAVY_SHEEN, HEAVY_SHEEN_ALPHA, heavySheen } from "../presentation/itemLook";
import { fighterModelReplaced } from "../presentation/fighterForm";
import type { FighterPose } from "../presentation/fighterPose";
import { createWhiteGlowState, whiteGlowAlpha } from "../presentation/whiteGlow";
import { GOLD_SACK_GLOW, goldSackGlowAlpha } from "../presentation/peonPose";
import type { Character } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import type { MatchCamera } from "../sim/matchCamera";
import type { WorldOrigin } from "./effects";
import { PosedWhiteModel } from "./posedWhiteModel";

const FLASH_LIFT = 8.0;

export class BodyFlash {
  private readonly model: PosedWhiteModel;
  private readonly state = createWhiteGlowState();

  constructor(character: Character, origin: WorldOrigin) {
    this.model = new PosedWhiteModel(character, origin);
  }

  present(fighter: Readonly<Fighter> | undefined, pose: Readonly<FighterPose>, stage: number, frame: number, camera: Readonly<MatchCamera>): void {
    const glow = fighter === undefined ? 0 : whiteGlowAlpha(this.state, fighter, frame);
    const gold = glow === 0 && fighter !== undefined ? goldSackGlowAlpha(fighter) : 0;
    const sheen = glow === 0 && gold === 0 && fighter !== undefined && heavySheen(fighter);
    const alpha = sheen ? HEAVY_SHEEN_ALPHA : gold > 0 ? gold : glow;
    const tint = sheen ? HEAVY_SHEEN : gold > 0 ? GOLD_SACK_GLOW : undefined;
    if (fighter === undefined || alpha === 0 || fighterModelReplaced(fighter) || !this.model.pose(fighter, pose, stage, camera, FLASH_LIFT, 1.0, 0.0)) {
      this.model.hide();
      return;
    }
    this.model.tint(alpha, tint?.red ?? 255, tint?.green ?? 255, tint?.blue ?? 255);
  }

  drawnEffects(into: effect[]): void {
    this.model.drawnEffects(into);
  }

  destroy(): void {
    this.model.destroy();
  }
}
