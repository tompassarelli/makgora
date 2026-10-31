import { isParticipantSlot } from "../../game/input/participants";
import { Phase, cancelRematchCountdown, humanActive } from "../../game/lobby/lobbyState";
import { startKeyUp } from "../../game/match/controls";
import { warcraftChatOpen } from "../../platform/editboxJournal";
import { KEYBOARD_PAUSE_PREFIX, Key } from "./keyEvents";
import { startDown } from "./keys";
import { type ShellState, localSlot } from "./state";
import { eventPlayer, playerSlot } from "wisp/game/players";
import { sendSync } from "wisp/game/sync";


export function onPauseKeyDown(s: ShellState): void {
  const slot = playerSlot(eventPlayer());
  if (GetHandleId(BlzGetTriggerPlayerKey()) === Key.escape && s.game.phase !== Phase.match) return;
  const chatting = s.chatOpen?.() ?? warcraftChatOpen(s.chatFrame);
  if (!isParticipantSlot(slot) || slot !== localSlot() || !humanActive(s.game, slot) || chatting) return;
  sendSync(KEYBOARD_PAUSE_PREFIX, "");
}

export function onKeyboardPause(s: ShellState): void {
  const slot = playerSlot(eventPlayer());
  if (!isParticipantSlot(slot) || !humanActive(s.game, slot)) return;
  if (s.pauseMenu?.title) {
    s.pauseMenu.title = false;
    return;
  }
  if (cancelRematchCountdown(s.game, slot)) return;
  startDown(s, slot);
  startKeyUp(s.session, slot);
}
