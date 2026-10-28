import type { FighterPose } from "../presentation/fighterPose";
import { METER_GLOW_DEPTH, METER_GLOW_GROW, meterGlowAlpha, meterGlowColor, meterGlowHeight } from "../presentation/meterGlow";
import type { Character } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import type { MatchCamera } from "../sim/matchCamera";
import type { WorldOrigin } from "./effects";
import { PosedWhiteModel } from "./posedWhiteModel";

export class MeterGlow {
  private readonly model: PosedWhiteModel;
  private readonly height: number;

  constructor(character: Character, origin: WorldOrigin) {
    this.model = new PosedWhiteModel(character, origin);
    this.height = meterGlowHeight(character);
  }

  present(fighter: Readonly<Fighter> | undefined, pose: Readonly<FighterPose>, stage: number, frame: number, camera: Readonly<MatchCamera>, ultimatesOff: boolean): void {
    const color = fighter === undefined ? undefined : meterGlowColor(fighter, ultimatesOff, frame);
    if (fighter === undefined || color === undefined || !this.model.pose(fighter, pose, stage, camera, -METER_GLOW_DEPTH, METER_GLOW_GROW, this.height)) {
      this.model.hide();
      return;
    }
    this.model.tint(meterGlowAlpha(color, frame), color.red, color.green, color.blue);
  }

  drawnEffects(into: effect[]): void {
    this.model.drawnEffects(into);
  }

  destroy(): void {
    this.model.destroy();
  }
}
