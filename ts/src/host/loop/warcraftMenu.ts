import { warcraftChatOpen } from "../../platform/editboxJournal";
import type { ShellState } from "./state";

const ESCAPE_MENU_FRAMES = ["EscMenuMainPanel", "EscMenuOptionsPanel", "EscMenuOptionsConfirmDialog"] as const;

let escapeMenuFrames: readonly framehandle[] | undefined;

export function warcraftMenuOpen(s: Readonly<ShellState>): boolean {
  const frames = escapeMenuFrames ?? (escapeMenuFrames = ESCAPE_MENU_FRAMES.map(name => BlzGetFrameByName(name, 0)));
  for (const frame of frames) if (BlzFrameIsVisible(frame)) return true;
  return s.chatOpen?.() ?? warcraftChatOpen(s.chatFrame);
}
