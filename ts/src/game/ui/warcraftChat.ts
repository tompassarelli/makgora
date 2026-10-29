// Engine: Warcraft's own chat frame; moving it or changing its level crashes the game (engineFrames.test.ts).
export function hideWarcraftChat(): void {
  BlzFrameSetVisible(BlzGetOriginFrame(ORIGIN_FRAME_CHAT_MSG, 0), false);
}
