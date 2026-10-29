import type { CostumeTint } from "../presentation/model/costume";

export function paintCostume(frame: framehandle, tint: CostumeTint | undefined): void {
  BlzFrameSetVertexColor(frame, tint === undefined ? BlzConvertColor(255, 255, 255, 255) : BlzConvertColor(255, tint[0], tint[1], tint[2]));
}
