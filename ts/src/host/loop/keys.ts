import { NATIVE_PREFLIGHT_KEY, inputPreflightLine } from "../../game/input/nativePreflight";
import { INPUT_PREFLIGHT_FILE } from "../../game/core/gameFiles";
import { cameraKey, pauseHeldKeys } from "./pauseCamera";
import { type ChordKeys, chordComplete, chordKeys, noteChordKey } from "../../game/input/pauseChord";


import { Action } from "../../game/input/actions";
import { sampleKeys } from "../../game/input/keyboardCapture";
import { menuAction } from "../../game/input/keyBindings";
import { isCarrierKey } from "../../game/netcode/journal/keyboard";
import { type ParticipantSlot, isParticipantSlot } from "../../game/input/participants";
import { heldActions, keyDown, pressKey, releaseKey } from "../../game/input/playerKeys";
import { startKeyDown, startKeyUp } from "../../game/match/controls";
import { Phase, cancelRematchCountdown, characterFor, copyMatchState, firstHumanSlot, humanActive, recallCharacter, selectCharacter } from "../../game/lobby/lobbyState";
import { leaveTutorial } from "../../game/match/tutorial";
import { fighterName } from "../../game/roster/kits";
import { endReplaySegment } from "./replays";
import { pausedMessage } from "../../game/session/messages";
import { cancelBindingCapture, cancelNaming, captureBinding, closeSlotMenu } from "../../game/ui/bindingSettings";
import { writeLines } from "wisp/src/platform/fileio";
import { confirmedChecksum, startInputTrace, traceParticipant } from "./diagnostics";
import { clearCapturedInputs } from "./inputs";
import { journalEpoch } from "./journal";
import { chatBusy, requestPause } from "./journalPause";
import { Key, keyEventAllowed, syncKeyEvents } from "./keyEvents";
import { back, choose, confirm, journalMenuKey, openSettingsScreen, openTitle, resultKey } from "./menus";
import { makePreview } from "./preview";
import { exportProbe, probeIntegrity, probeRecording, startProbe } from "./responseProbe";
import { type ShellState, activeRollback, cancelPendingPlaytest, keepShellMomentEnd, localSlot, playsOnKeyboard } from "./state";
import { clearMatchEffects, views } from "./ui";
import { ownConfirmedState } from "./confirmedState";
import { LASTING, pauseMatchPresentation, setStatus } from "./view";
import { noteKeyDownEvent, noteKeyUpEvent, osKeyDown } from "../../platform/osKeys";
import { restartMatch } from "wisp/game/clock";
import { eventKey } from "wisp/game/input";
import { eventPlayer, localPlayer, playerSlot } from "wisp/game/players";


function journalOwnsKey(s: ShellState, slot: ParticipantSlot, key: number): boolean {
  const epoch = journalEpoch(s);
  if (epoch === undefined) return false;
  const { journal } = epoch;
  if (journal.ingress === "keyboard") return isCarrierKey(key);
  if (journal.ingress !== "editbox") return false;


  if (s.game.phase !== Phase.match) return journal.lifecycle?.quiescent() !== true;
  return key === Key.y && !playsOnKeyboard(journal, slot);
}


export function startDown(s: ShellState, slot: ParticipantSlot): void {
  const epoch = journalEpoch(s);
  const playing = s.game.phase === Phase.match;
  if (epoch?.journal.editbox !== undefined && chatBusy(epoch.journal)) return;
  if (epoch !== undefined && playing && epoch.journal.barrier.request !== undefined) return;
  if (s.session.paused) s.pauseKeysHeld = pauseHeldKeys(s.participants[slot].bindings.bindings).filter(key => osKeyDown(key));
  if (playing && s.session.paused && chordComplete(pauseChordKeys(s, slot), s.participants[slot].bindings.bindings)) {
    exitPausedMatch(s);
    return;
  }
  const wasPaused = s.session.paused;
  const deferred = epoch !== undefined && playing;
  const consumed = !s.session.startHeld[slot] && views(s).selections[slot].consumeStart();
  const action = startKeyDown(s.session, slot, s.game.phase, consumed || views(s).settings[slot].isOpen(), deferred);
  if (action === "togglePause") {
    if (!wasPaused) s.pausedBy = slot;
    if (epoch !== undefined && deferred) requestPause(s, epoch.rollback, epoch.journal, !s.session.paused);
    else {
      clearCapturedInputs(s);
      pauseMatchPresentation(s, s.session.paused);
      if (probeRecording(s.probe)) probeIntegrity(s.probe, `pause-boundary ${s.session.paused ? "paused" : "resumed"} ${s.runtime.simulationFrame}`);
      syncKeyEvents(s);
      setStatus(s, s.session.paused ? pausedMessage("Y") : "Resumed.", s.session.paused ? LASTING : 1.0);
    }
  } else if (action === "confirm") confirm(s, slot);
}


export function pauseChordKeys(s: ShellState, slot: ParticipantSlot): ChordKeys {
  s.pauseChord ??= [chordKeys(), chordKeys(), chordKeys(), chordKeys()];
  return s.pauseChord[slot];
}

export function exitPausedMatch(s: ShellState, title = false): void {
  ownConfirmedState(s);
  keepShellMomentEnd(s);
  endReplaySegment(s);
  clearMatchEffects(s);
  if (s.game.run.active && s.pauseSelection !== undefined) copyMatchState(s.game, s.pauseSelection);
  s.game.phase = Phase.characterMenu;
  s.game.practice = false;
  leaveTutorial(s.game);
  s.game.run.active = false;
  s.session.paused = false;
  const menu = s.pauseMenu ??= { shown: false, title: false };
  menu.shown = false;
  menu.title = title;
  s.titleAwaitRelease = title;
  clearCapturedInputs(s);
  setStatus(s, "", 0.0);
  makePreview(s);
  pauseMatchPresentation(s, false);
}

export function selectPauseMenu(s: ShellState, actor: number, choice: number): void {
  if (!isParticipantSlot(actor) || !humanActive(s.game, actor)) return;
  if (s.pauseMenu?.title) {
    s.pauseMenu.title = false;
    return;
  }
  if (s.game.phase !== Phase.match || !s.session.paused) return;
  if (choice === 0) exitPausedMatch(s);
}

function pausedMatchKeyDown(s: ShellState, slot: ParticipantSlot, key: number): void {
  const { bindings } = s.participants[slot].bindings;
  noteChordKey(pauseChordKeys(s, slot), bindings, key, true);
  if (eventPlayer() === localPlayer() && (s.rollback?.journal?.editbox === undefined || playsOnKeyboard(s.rollback.journal, slot))) cameraKey(s, bindings, key, true);
  if (key === Key.f2 && s.game.training) s.trainingHints = !s.trainingHints;
}

function participantKeyDown(s: ShellState, slot: ParticipantSlot, startKey = false): void {
  if (!humanActive(s.game, slot)) return;
  const key = eventKey();
  if (!startKey && !keyEventAllowed(s.keyEvents, key, s.participants[slot].bindings.bindings)) return;
  if (journalOwnsKey(s, slot, key)) return;
  if (s.participants[slot].bindings.naming) {
    if (key === Key.escape) cancelNaming(s.participants[slot].bindings);
    return;
  }
  if (s.trace.active) s.trace.window.keyDown[slot]++;
  traceParticipant(s, slot, `received down ${key}`);
  const participant = s.participants[slot];
  const { keys, bindings } = participant;
  const settings = views(s).settings[slot];
  if (key < 0 || key > 255 || keyDown(keys, key)) return;
  const menu = menuAction(bindings.bindings, key);
  if (s.pauseMenu?.title && (menu === Action.attack || key === Key.y)) {
    if (menu === Action.attack && s.titleAwaitRelease) return;
    s.pauseMenu.title = false;
    return;
  }
  if ((key === Key.y || key === Key.escape) && cancelRematchCountdown(s.game, slot)) return;
  if (key === Key.y && (startKey || (s.game.phase !== Phase.match && bindings.capture === undefined))) {
    if (startKey && s.game.phase !== Phase.match) startDown(s, slot);
    return;
  }
  if (s.game.phase === Phase.match && s.session.paused) {
    pausedMatchKeyDown(s, slot, key);
    return;
  }
  if (key === Key.escape && bindings.capture !== undefined) {
    cancelBindingCapture(bindings);
    return;
  }
  if (key === Key.escape && closeSlotMenu(bindings)) return;
  if ((key === Key.escape || key === Key.f9) && settings.isOpen()) {
    settings.close();
    return;
  }
  if (settings.isOpen() || bindings.capture !== undefined) {
    captureBinding(bindings, key);
    return;
  }
  if (key === Key.escape && (views(s).selections[slot].closeBar() || views(s).selections[slot].credits.close() || views(s).selections[slot].community.close())) return;
  if (key === Key.escape && s.game.phase === Phase.characterMenu && bindings.ready) {
    openTitle(s, slot);
    return;
  }
  if (key === Key.f1) return;
  if (!bindings.ready) return;
  if (key === 13 && s.game.phase !== Phase.match) return;
  const { game } = s;
  views(s).selections[slot].menuBindings(bindings.bindings);
  const editbox = s.rollback?.journal?.editbox !== undefined;
  if (editbox && game.phase !== Phase.match && journalMenuKey(s, slot, key)) return;
  if (key === Key.escape && game.phase === Phase.characterMenu && views(s).selections[slot].menuAction(Action.special)) return;
  if (key === Key.escape && game.phase === Phase.stageMenu) {
    back(s, slot);
    return;
  }
  if (game.phase === Phase.match && (s.session.paused || activeRollback(s) !== undefined)) return;
  const action = pressKey(keys, key, bindings.bindings);
  if (resultKey(s, slot, key, action)) return;
  if (action === undefined) return;
  if (cancelRematchCountdown(game, slot)) return;
  participant.lastInputAction = action;
  traceParticipant(s, slot, `mapped action ${action}`);
  if (game.phase === Phase.characterMenu && views(s).selections[slot].menuAction(action)) return;
  if (game.phase === Phase.match) sampleKeys(participant.capture, heldActions(keys));
  else if (action === Action.moveLeft || action === Action.moveRight) choose(s, slot, 1);
  else if (action === Action.attack) {
    if (game.phase === Phase.characterMenu) views(s).selections[slot].placeHovered();
    else confirm(s, slot);
  } else if (action === Action.special) back(s, slot);
}

function participantKeyUp(s: ShellState, slot: ParticipantSlot, startKey = false): void {
  if (!humanActive(s.game, slot)) return;
  const key = eventKey();
  if (!startKey && !keyEventAllowed(s.keyEvents, key, s.participants[slot].bindings.bindings)) return;

  if (s.pauseMenu?.title && menuAction(s.participants[slot].bindings.bindings, key) === Action.attack) s.titleAwaitRelease = false;

  if (key === Key.y && startKey) {
    startKeyUp(s.session, slot);
    return;
  }
  if (s.game.phase === Phase.match && s.session.paused) {
    const { bindings } = s.participants[slot].bindings;
    noteChordKey(pauseChordKeys(s, slot), bindings, key, false);
    if (eventPlayer() === localPlayer()) cameraKey(s, bindings, key, false);
    return;
  }
  if (journalOwnsKey(s, slot, key)) return;
  if (key === Key.f1) {
    openSettingsScreen(s, slot);
    return;
  }
  if (s.trace.active) s.trace.window.keyUp[slot]++;
  traceParticipant(s, slot, `received up ${key}`);
  const participant = s.participants[slot];
  releaseKey(participant.keys, key, participant.bindings.bindings);
  if (s.game.phase === Phase.match) sampleKeys(participant.capture, heldActions(participant.keys));
}

function triggerSlot(): ParticipantSlot | undefined {
  const slot = playerSlot(eventPlayer());
  return isParticipantSlot(slot) ? slot : undefined;
}

export function onKeyDown(s: ShellState): void {
  const slot = triggerSlot();
  const key = eventKey();
  if (eventPlayer() === localPlayer()) noteKeyDownEvent(s.localKeys, key, activeRollback(s) !== undefined && s.game.phase === Phase.match && !s.session.paused);
  if (slot !== undefined && key === Key.f10) views(s).selections[slot].wakeStockCursor();
  if (key === NATIVE_PREFLIGHT_KEY.code) {
    if (slot === localSlot()) writeLines(INPUT_PREFLIGHT_FILE, [inputPreflightLine(s.build.id)]);
    return;
  }
  if (slot !== undefined) participantKeyDown(s, slot);
}

export function onKeyUp(s: ShellState): void {
  const slot = triggerSlot();
  const key = eventKey();
  if (eventPlayer() === localPlayer()) noteKeyUpEvent(s.localKeys, key);
  if (slot !== undefined) participantKeyUp(s, slot);
}

export function onStartKeyDown(s: ShellState): void {
  const slot = triggerSlot();
  if (slot !== undefined) participantKeyDown(s, slot, true);
}

export function onStartKeyUp(s: ShellState): void {
  const slot = triggerSlot();
  if (slot !== undefined) participantKeyUp(s, slot, true);
}


const fromFirstHuman = (s: Readonly<ShellState>) => triggerSlot() === firstHumanSlot(s.game);


export function onDeveloperRestart(s: ShellState): void {
  if (!fromFirstHuman(s) || s.restartRequested) return;
  s.restartRequested = true;
  restartMatch(false);
}


export function onDeveloperTrace(s: ShellState): void {
  if (fromFirstHuman(s) && !s.trace.active && !probeRecording(s.probe)) startInputTrace(s);
}


export function onProbeStart(s: ShellState, edgeStamps: boolean): void {
  if (s.trace.active || s.probe === undefined || !fromFirstHuman(s)) return;
  startProbe(s.probe, edgeStamps);
}


export function onProbeExport(s: ShellState): void {
  if (s.probe === undefined || !fromFirstHuman(s)) return;
  const rollback = activeRollback(s);
  if (rollback !== undefined) probeIntegrity(s.probe, `checksum ${rollback.epoch} ${s.runtime.simulationFrame} ${confirmedChecksum(s)} ${s.game.phase}`);
  exportProbe(s.probe);
}
