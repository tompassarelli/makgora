import { isParticipantSlot } from "../../game/input/participants";
import { cancelRematchCountdown, humanActive } from "../../game/lobby/lobbyState";
import { startKeyUp } from "../../game/match/controls";
import { warcraftChatOpen } from "../../platform/editboxJournal";
import { KEYBOARD_PAUSE_PREFIX } from "./keyEvents";
import { startDown } from "./keys";
import { type ShellState, localSlot } from "./state";


export function onPauseKeyDown(s: ShellState): void {
  const slot = GetPlayerId(GetTriggerPlayer());
  const chatting = s.chatOpen?.() ?? warcraftChatOpen(s.chatFrame);
  if (!isParticipantSlot(slot) || slot !== localSlot() || !humanActive(s.game, slot) || chatting) return;
  BlzSendSyncData(KEYBOARD_PAUSE_PREFIX, "");
}

export function onKeyboardPause(s: ShellState): void {
  const slot = GetPlayerId(GetTriggerPlayer());
  if (!isParticipantSlot(slot) || !humanActive(s.game, slot)) return;
  if (s.pauseMenu?.title) {
    s.pauseMenu.title = false;
    return;
  }
  if (cancelRematchCountdown(s.game, slot)) return;
  startDown(s, slot);
  startKeyUp(s.session, slot);
}
