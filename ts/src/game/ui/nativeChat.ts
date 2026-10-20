import { f32 } from "wisp/src/sim/f32";
import type { TextBox } from "./hudLayout";

export const SELECT_CHAT_BOX: TextBox = { left: f32(0.558), top: f32(0.05), width: f32(0.232), height: f32(0.044) };
export const MATCH_CHAT_BOX: TextBox = { left: f32(0.02), top: f32(0.21), width: f32(0.28), height: f32(0.082) };

export class NativeChat {
  private readonly frame = BlzGetOriginFrame(ORIGIN_FRAME_CHAT_MSG, 0);
  private box: TextBox | undefined;
  private shown: boolean | undefined;

  update(visible: boolean, box: TextBox): void {
    if (this.box !== box) {
      this.box = box;
      BlzFrameClearAllPoints(this.frame);
      BlzFrameSetAbsPoint(this.frame, FRAMEPOINT_TOPLEFT, box.left, box.top);
      BlzFrameSetAbsPoint(this.frame, FRAMEPOINT_BOTTOMRIGHT, f32(box.left + box.width), f32(box.top - box.height));
    }
    if (visible === this.shown) return;
    this.shown = visible;
    BlzFrameSetVisible(this.frame, visible);
  }
}
