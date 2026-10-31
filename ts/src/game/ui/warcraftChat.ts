import { originFrame, setFrameVisible } from "wisp/game/frames";
// Engine: Warcraft's own chat frame; moving it or changing its level crashes the game (engineFrames.test.ts).
export function hideWarcraftChat(): void {
  setFrameVisible(originFrame(ORIGIN_FRAME_CHAT_MSG, 0), false);
}
