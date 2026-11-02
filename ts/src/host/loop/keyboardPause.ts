import { isParticipantSlot, type ParticipantSlot } from "../../game/input/participants";
import { chordComplete } from "../../game/input/pauseChord";
import { Phase, cancelRematchCountdown, humanActive } from "../../game/lobby/lobbyState";
import { startKeyUp } from "../../game/match/controls";
import { clearLeaveHold, leaveHold, pressLeaveHold, releaseLeaveHold, tickLeaveHold } from "../../game/match/leaveHold";
import { warcraftChatOpen } from "../../platform/editboxJournal";
import { journalEpoch } from "./journal";
import { KEYBOARD_PAUSE_PREFIX, Key } from "./keyEvents";
import { exitPausedMatch, pauseChordKeys, startDown } from "./keys";
import { type ShellState, localSlot } from "./state";
import { eventKey } from "wisp/game/input";
import { eventPlayer, playerSlot } from "wisp/game/players";
import { sendSync, syncData } from "wisp/game/sync";

const ESCAPE_DOWN = "E";
const ESCAPE_UP = "U";

export function onPauseKeyDown(s: ShellState): void {
  const slot = playerSlot(eventPlayer());
  const escape = eventKey() === Key.escape;
  if (escape && s.game.phase !== Phase.match) return;
  const chatting = s.chatOpen?.() ?? warcraftChatOpen(s.chatFrame);
  if (!isParticipantSlot(slot) || slot !== localSlot() || !humanActive(s.game, slot) || chatting) return;
  sendSync(KEYBOARD_PAUSE_PREFIX, escape ? ESCAPE_DOWN : "");
}

export function onPauseKeyUp(s: ShellState): void {
  const slot = playerSlot(eventPlayer());
  if (s.game.phase !== Phase.match || !isParticipantSlot(slot) || slot !== localSlot() || !humanActive(s.game, slot)) return;
  sendSync(KEYBOARD_PAUSE_PREFIX, ESCAPE_UP);
}

function holdsToLeave(s: ShellState, slot: ParticipantSlot): boolean {
  if (s.game.phase !== Phase.match || !s.session.paused || journalEpoch(s)?.journal.barrier.request !== undefined) return false;
  if (chordComplete(pauseChordKeys(s, slot), s.participants[slot].bindings.bindings)) return false;
  return pressLeaveHold(s.leaveHold ??= leaveHold(), slot, s.pausedBy);
}

export function onKeyboardPause(s: ShellState): void {
  const slot = playerSlot(eventPlayer());
  if (!isParticipantSlot(slot) || !humanActive(s.game, slot)) return;
  const message = syncData();
  if (message === ESCAPE_UP) {
    if (s.leaveHold !== undefined && releaseLeaveHold(s.leaveHold, slot) && s.game.phase === Phase.match && s.session.paused) pressStart(s, slot);
    return;
  }
  if (s.pauseMenu?.title) {
    s.pauseMenu.title = false;
    return;
  }
  if (cancelRematchCountdown(s.game, slot)) return;
  if (message === ESCAPE_DOWN && holdsToLeave(s, slot)) return;
  pressStart(s, slot);
}

function pressStart(s: ShellState, slot: ParticipantSlot): void {
  startDown(s, slot);
  startKeyUp(s.session, slot);
}

export function serviceLeaveHold(s: ShellState): void {
  const hold = s.leaveHold;
  if (hold === undefined) return;
  if (s.game.phase !== Phase.match || !s.session.paused) clearLeaveHold(hold);
  else if (tickLeaveHold(hold)) exitPausedMatch(s);
}
