import { warcraftChatOpen } from "../../platform/editboxJournal";
import type { ShellState } from "./state";
import { Frame, frameChildCount, frameVisible, namedFrame } from "wisp/game/frames";

const ESCAPE_MENU_FRAMES = ["EscMenuMainPanel", "EscMenuOptionsPanel", "EscMenuOptionsConfirmDialog"] as const;

let escapeMenuFrames: readonly Frame[] = [];

// The native window answers an unknown name with an empty frame that reads visible, so only a frame with children is Warcraft's own panel.
// Every client looks the frames up on the same frame: the headless desync guard compares native calls.
export function findWarcraftMenuFrames(): void {
  escapeMenuFrames = ESCAPE_MENU_FRAMES.map(name => namedFrame(name, 0)).filter(frame => frameChildCount(frame) > 0);
}

export function warcraftMenuOpen(s: Readonly<ShellState>): boolean {
  for (const frame of escapeMenuFrames) if (frameVisible(frame)) return true;
  return s.chatOpen?.() ?? warcraftChatOpen(s.chatFrame);
}
