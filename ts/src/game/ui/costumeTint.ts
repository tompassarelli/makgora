import type { CostumeTint } from "../presentation/model/costume";
import { frameColor, setFrameColor } from "wisp/game/frames";

export function paintCostume(frame: framehandle, tint: CostumeTint | undefined): void {
  setFrameColor(frame, tint === undefined ? frameColor(255, 255, 255, 255) : frameColor(255, tint[0], tint[1], tint[2]));
}
