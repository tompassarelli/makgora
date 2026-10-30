import { warcraftChatOpen } from "../../platform/editboxJournal";
import type { ShellState } from "./state";

const ESCAPE_MENU_FRAMES = ["EscMenuMainPanel", "EscMenuOptionsPanel", "EscMenuOptionsConfirmDialog"] as const;

let escapeMenuFrames: readonly framehandle[] = [];

// Every client looks the frames up on the same frame: the headless desync guard compares native calls.
export function findWarcraftMenuFrames(): void {
  escapeMenuFrames = ESCAPE_MENU_FRAMES.map(name => BlzGetFrameByName(name, 0));
}

export function warcraftMenuOpen(s: Readonly<ShellState>): boolean {
  for (const frame of escapeMenuFrames) if (BlzFrameIsVisible(frame)) return true;
  return s.chatOpen?.() ?? warcraftChatOpen(s.chatFrame);
}
