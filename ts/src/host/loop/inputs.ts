
import { warcraftChatOpen } from "../../platform/editboxJournal";
import { ACTION_ORDER, bit } from "../../game/input/actions";
import { clearAttackBuffer } from "../../game/input/attackBuffer";
import { resetKeys } from "../../game/input/keyboardCapture";
import { actionFor, keyFor } from "../../game/input/keyBindings";
import { PAD_LAYER } from "../../game/input/padKeys";
import { PARTICIPANT_SLOTS, type ParticipantSlot, isParticipantSlot, participantActive } from "../../game/input/participants";
import { clearKeys } from "../../game/input/playerKeys";
import { endReplaySegment } from "./replays";
import { humanFighterActive, humanPresent } from "../../game/lobby/lobbyState";
import { type ShellState, keepShellMomentEnd, localSlot } from "./state";
import { settingsOpen } from "./ui";
import { ownConfirmedState } from "./confirmedState";
import { beginKeyPoll, osKeyDown, polledKeyDown } from "../../platform/osKeys";
import { windowFocused } from "wisp/game/input";
import { player as playerOf, playerControl, playerSlotState } from "wisp/game/players";


export function currentHumanMask(departed: number): number {
  let mask = 0;
  for (const slot of PARTICIPANT_SLOTS) {
    const player = playerOf(slot);
    if (playerControl(player) === MAP_CONTROL_USER && playerSlotState(player) === PLAYER_SLOT_STATE_PLAYING && !participantActive(departed, slot)) mask |= 1 << slot;
  }
  return mask;
}

export function currentComputerMask(): number {
  let mask = 0;
  for (const slot of PARTICIPANT_SLOTS) {
    const player = playerOf(slot);
    if (playerControl(player) === MAP_CONTROL_COMPUTER && playerSlotState(player) === PLAYER_SLOT_STATE_PLAYING) mask |= 1 << slot;
  }
  return mask;
}

function clearCapturedParticipantInputs(s: ShellState, slot: ParticipantSlot): void {
  const participant = s.participants[slot];
  clearKeys(participant.keys);
  resetKeys(participant.capture, 0);
  clearAttackBuffer(s.produced.commands[slot]);
}


export function clearCapturedInputs(s: ShellState): void {
  for (const slot of PARTICIPANT_SLOTS) clearCapturedParticipantInputs(s, slot);
}

export function clearParticipantInputs(s: ShellState, slot: ParticipantSlot): void {
  ownConfirmedState(s);
  clearCapturedParticipantInputs(s, slot);
  keepShellMomentEnd(s);
  endReplaySegment(s);
  clearAttackBuffer(s.controls.commands[slot]);
}

export function clearAllInputs(s: ShellState): void {
  for (const slot of PARTICIPANT_SLOTS) clearParticipantInputs(s, slot);
}


export function controlsAvailable(s: Readonly<ShellState>, slot: ParticipantSlot): boolean {
  return s.startingChoicesReady !== false && humanPresent(s.game, slot) && s.participants[slot].bindings.ready && !settingsOpen(s, slot);
}






export function pollLocalKeys(s: Readonly<ShellState>): number {
  beginKeyPoll(s.localKeys);
  const slot = localSlot();
  if (!isParticipantSlot(slot) || !windowFocused() || !humanFighterActive(s.game, slot) || (s.chatOpen?.() ?? warcraftChatOpen(s.chatFrame))) return 0;
  const { bindings } = s.participants[slot].bindings;
  const menuHeld = s.pauseKeysHeld;
  if (menuHeld !== undefined) {
    for (let index = menuHeld.length - 1; index >= 0; index--) {
      const key = menuHeld[index];
      if (key !== undefined && !osKeyDown(key)) menuHeld.splice(index, 1);
    }
  }
  const pressed = (key: number | undefined) => key !== undefined && !menuHeld?.includes(key) && polledKeyDown(s.localKeys, key);
  let held = 0;
  for (const action of ACTION_ORDER) {
    if (pressed(keyFor(bindings, action, 0)) || pressed(keyFor(bindings, action, 1))) held |= bit(action);
  }
  for (const { action, code } of PAD_LAYER) {
    if (pressed(code) && actionFor(bindings, code) === undefined) held |= bit(action);
  }
  return held;
}
