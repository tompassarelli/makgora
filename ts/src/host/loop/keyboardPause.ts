import { isParticipantSlot, type ParticipantSlot } from "../../game/input/participants";
import { chordComplete } from "../../game/input/pauseChord";
import { Phase, humanActive } from "../../game/lobby/lobbyState";
import { cancelRematchCountdown } from "../../game/lobby/matchFlow";
import { startKeyUp } from "../../game/match/controls";
import { clearLeaveHold, leaveHold, pressEscape, releaseEscape, tickLeaveHold } from "../../game/match/leaveHold";
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
  if (!isParticipantSlot(slot) || slot !== localSlot() || !humanActive(s.game, slot)) return;
  sendSync(KEYBOARD_PAUSE_PREFIX, ESCAPE_UP);
}

function leavePauser(s: ShellState, slot: ParticipantSlot): ParticipantSlot | undefined {
  if (s.game.phase !== Phase.match || !s.session.paused || journalEpoch(s)?.journal.barrier.request !== undefined) return undefined;
  return chordComplete(pauseChordKeys(s, slot), s.participants[slot].bindings.bindings) ? undefined : s.pausedBy;
}

export function onKeyboardPause(s: ShellState): void {
  const slot = playerSlot(eventPlayer());
  if (!isParticipantSlot(slot) || !humanActive(s.game, slot)) return;
  const message = syncData();
  const hold = s.leaveHold ??= leaveHold();
  if (message === ESCAPE_UP) {
    if (releaseEscape(hold, slot) && s.game.phase === Phase.match && s.session.paused) pressStart(s, slot);
    return;
  }
  if (message === ESCAPE_DOWN && (pressEscape(hold, slot, leavePauser(s, slot)) || s.game.phase !== Phase.match)) return;
  if (s.pauseMenu?.title) {
    s.pauseMenu.title = false;
    return;
  }
  if (cancelRematchCountdown(s.game, slot)) return;
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
