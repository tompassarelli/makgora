import { originFrame, OriginFrame, setFrameVisible } from "wisp/game/frames";
// Engine: Warcraft's own chat frame; moving it or changing its level crashes the game (engineFrames.test.ts).
export function hideWarcraftChat(): void {
  setFrameVisible(originFrame(OriginFrame.chatMsg, 0), false);
}
