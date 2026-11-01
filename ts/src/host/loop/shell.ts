import { recordSessionWins } from "../../game/session/sessionWins";
import { servicePauseCameraControls, pauseHudHidden } from "./pauseCamera";



import { PARTICIPANT_SLOTS, isParticipantMask, isParticipantSlot } from "../../game/input/participants";
import { clearPulse } from "../../game/input/directionalInput";
import { ownConfirmedState } from "./confirmedState";
import { startKeyUp } from "../../game/match/controls";
import { Phase, copyMatchState, firstHumanSlot, humanActive, humanPresent, participantLeft, startComputerChoices, updateConnectedHumans } from "../../game/lobby/lobbyState";
import { chooseScenarioCharacters } from "../../game/session/scenarios";
import { FRAME_SECONDS } from "../../game/presentation/frameClock";
import { holdGameSpeed } from "./gameSpeed";
import { FLOOR_HEIGHT } from "../../game/presentation/arenaCamera";
import { type MapBuild, journalIngress } from "../../game/session/build";
import { pausing } from "../../game/session/pauseBarrier";
import type { RollbackPlayback } from "../../game/session/playback";
import { cancelBindingCapture, initializeBindingSettings, loadSavedBindings, saveBindingSettings, useDefaultBindings } from "../../game/ui/bindingSettings";
import { f32 } from "wisp/src/sim/f32";
import { on, trampoline } from "wisp/src/platform/dispatch";
import { beginFrameSection, endFrameSection } from "wisp/src/map/frameSections";
import { CAMERA_SECTION, PRESENTATION_SECTION, UI_SECTION } from "./frameSections";
import { DRAW_EVENT, beginPresentedFrame, drawBetweenFrames, startFrameClock } from "./betweenFrames";
import { EDITBOX_ENTER, EditboxIngress } from "../../platform/editboxJournal";
import { localParticipantSlot, traceTick, writeReadyMarker } from "./diagnostics";
import { writeDrawnFrame } from "./drawnFrame";
import { heldVisualFrame } from "../../game/session/visualCapture";
import { holdPresentedCapture, serviceVisualCapture } from "./visualCapture";
import { callbackMatchTick } from "./frame";
import { clearAllInputs, clearParticipantInputs, currentHumanMask } from "./inputs";
import { INPUT_PREFIX, journalEpoch, publishMenu, serviceJournalEnd } from "./journal";
import * as journalPause from "./journalPause";
import { KEY_DOWN, KEY_UP, KEY_START_DOWN, KEY_START_UP, KEY_PAUSE_DOWN, KEY_PREVIEW_DOWN, KEYBOARD_PAUSE, KEYBOARD_PAUSE_PREFIX, MAIN_MENU, Key, registerKey, syncKeyEvents } from "./keyEvents";
import { onPreviewKeyDown } from "./keyboardPreview";
import { receiveChat, toggleChatHistory } from "./matchChat";
import { onKeyboardPause, onPauseKeyDown } from "./keyboardPause";
import { onDeveloperRestart, onDeveloperTrace, onKeyDown, onKeyUp, onStartKeyDown, onStartKeyUp, onProbeExport, onProbeStart, selectPauseMenu } from "./keys";
import { onDevCommand } from "./developerCommands";
import { MAIN_MENU_PREFIX } from "../../game/ui/mainMenuButton";
import { onMainMenu, openControlsFirst, panelActions, previewControlsFirst, pickResult, serviceAutomaticRematch, startingSelection } from "./menus";
import { PLAYER_FILE_RECEIVED, bindingFiles, playerFileReceived, playerFilesOwnerLeft, receivedLobbyCounter, startPlayerFiles } from "./playerFiles";
import { PLAYTEST, PLAYTEST_PREFIX, playtestRequested, readPlaytestRequest, servicePlaytestRequest } from "./playtest";
import { STAGE_READY, cancelStageLoad, serviceStageLoad, stageReadyEvent } from "./stageLoad";
import { STAGE_READY_PREFIX } from "../../game/session/stageLoad";
import { makePreview } from "./preview";
import { HELP_EVENT, helpCommand, serviceHelp, startHelp } from "./help";
import { preloadStageAssets } from "./stageScenery";
import * as probe from "./responseProbe";
import { checksumRow, delayRow, receiveInput, rollbackTick } from "./rollback";
import { floorMod } from "wisp/src/sim/intMath";
import * as netDelay from "./netDelay";
import { SAVE_MOMENT, momentKey, serviceMomentRequest, serviceMomentSave } from "./moment";
import { readMatchIndex, writeMatchRecord } from "./matchRecords";
import { type Rollback, type ShellState, activeRollback, createShellState, keepShellMomentEnd, localSlot, momentSaves, replayRecording, shellState } from "./state";
import { endReplaySegment, serviceReplay } from "./replays";
import { CONTROL_ACK_PREFIX, PAUSE_REQUEST_PREFIX } from "../../game/session/pauseBarrier";
import { clearMatchEffects, createUi, recreateUi, views } from "./ui";
import { findWarcraftMenuFrames } from "./warcraftMenu";
import { registerChatEvents, registerChatHistoryKey } from "wisp/src/ui/chatPanel";
import { resultsView } from "../../game/presentation/matchCues";
import * as view from "./view";
import { renderCaptureStage } from "./captureStage";
import { resultMessage } from "../../game/session/messages";
import { beforeNativeDriverTick, afterNativeDriverTick, captureNativeDriverInputs } from "../../platform/nativeDriver";
import { fighterAt, isActive } from "../../game/sim/roster";
import { PAD_MOUSE, createPadTriggers, padMouse } from "./analogPad";
import { beforeNativeSoakTick, afterNativeSoakTick } from "../../platform/nativeSoak";
import { afterProbedTick, beforeProbedTick } from "./tickProbe";
import { advanceHandleLedger, handleLedger, installHandleLedger } from "./handleLedger";
import { knownFrame } from "wisp/src/netcode/shadowSchedule";
import { createTimer, startTimer } from "wisp/game/clock";
import { createEvents, onEvents } from "wisp/game/events";
import { displayText, hideOriginFrames, loadFrameFile } from "wisp/game/frames";
import { addChatEvent, addKeyEvent, chatText, enableSelections, enableUserControl, osKey } from "wisp/game/input";
import { enableFog, enableFogMask, setCameraSmoothing, setTimeOfDay, setTimeOfDayScale } from "wisp/game/view";
import { addLeaveEvent, eventPlayer, localPlayer, player, playerSlot, setPlayerColor } from "wisp/game/players";
import { addSyncEvent } from "wisp/game/sync";
import { locationX, locationY, mapCenter, removeLocation, showBody } from "wisp/game/bodies";

const TICK = "shell.tick";
const PLAYER_LEFT = "shell.playerLeft";
const CONTROL_ACK = "shell.controlAck";
const PAUSE_REQUEST = "shell.pauseRequest";
const CHAT_CLOSED = "shell.chatClosed";
const INPUT = "shell.input";
const DEV_COMMAND = "shell.devCommand";
const CHAT_RECEIVED = "shell.chatReceived";
const CHAT_HISTORY = "shell.chatHistory";
const CONTROLS_COMMAND = "shell.controlsCommand";
const SAVE_CONTROLS = "-save";
const SAVE_MOMENT_COMMAND = "-clip";
const LOAD_CONTROLS = "-load";
const RESTART = "shell.restart";
const TRACE = "shell.trace";
const PROBE_START = "shell.probeStart";
const PROBE_EDGES = "shell.probeEdges";
const PROBE_DUMP = "shell.probeDump";
const PROBE_KEYS = { f5: 0x74, f6: 0x75, f7: 0x76 } as const;


// #396: the native-input build records each match epoch for at most EPOCH_CALLBACKS callbacks, ending with a checksum of the confirmed state.
function serviceEpochWindow(s: ShellState, recorder: probe.ResponseProbe): void {
  const epoch = s.game.phase === Phase.match ? activeRollback(s)?.epoch : undefined;
  if (probe.epochWindowEnds(recorder, epoch)) {
    probe.probeIntegrity(recorder, checksumRow(s, recorder.epoch ?? -1, s.runtime.simulationFrame));
    probe.exportProbe(recorder);
  }
  if (probe.beginEpochWindow(recorder, epoch)) probe.probeIntegrity(recorder, s.rollback === undefined ? "delay -1 -1 -" : delayRow(s, s.rollback));
}

function gameTick(s: ShellState): void {
  advanceHandleLedger(handleLedger());
  beforeNativeSoakTick(s);
  beforeProbedTick(s);
  if (!beforeNativeDriverTick(s)) {
    writeReadyMarker(s);
    serviceReplay(s);
    return;
  }
  if (s.build.pausePositionProbe && s.game.phase === Phase.match && s.probe?.run === 0) probe.startProbe(s.probe, false);
  if (s.build.epochProbe === true && s.probe !== undefined) serviceEpochWindow(s, s.probe);
  const pausedBefore = s.session.paused;
  view.serviceResumePresentation(s);
  serviceVisualCapture(s);
  const epoch = journalEpoch(s);
  const editbox = s.rollback?.journal?.editbox;
  servicePauseCameraControls(s);
  editbox?.tick();
  const chatSlot = s.build.devConsole ? localParticipantSlot(s) : undefined;
  if (chatSlot !== undefined) editbox?.publishChat(s.build.id, chatSlot, epoch?.rollback.epoch);
  if (epoch !== undefined) {
    journalPause.serviceChat(s, epoch.rollback, epoch.journal);
    journalPause.servicePauseRequest(s, epoch.rollback, epoch.journal);
    serviceMomentRequest(s, epoch.rollback, epoch.journal);
    if (editbox !== undefined && s.game.phase !== Phase.match) serviceJournalEnd(s, epoch.rollback, epoch.journal);
  }
  const rollback = activeRollback(s);
  probe.probeBegin(s.probe, s.runtime.simulationFrame, rollback?.schedule.nextSpeculative ?? -1, rollback === undefined ? -1 : knownFrame(rollback.schedule), s.game.phase);
  traceTick(s);
  for (const slot of PARTICIPANT_SLOTS) {
    const participant = s.participants[slot];
    if (participant.appliedBindingRevision === participant.bindings.revision) continue;
    clearParticipantInputs(s, slot);
    participant.appliedBindingRevision = participant.bindings.revision;
  }
  s.status.seconds = Math.max(0.0, f32(s.status.seconds - FRAME_SECONDS));
  s.moment.notice = Math.max(0.0, f32(s.moment.notice - FRAME_SECONDS));
  serviceMomentSave(s);
  serviceReplay(s);
  captureNativeDriverInputs(s);
  if (s.rollback !== undefined) serviceDelay(s, s.rollback);
  if (rollback !== undefined && s.game.phase === Phase.match) {
    const { journal } = rollback;
    if (journal !== undefined) journalPause.serviceControlAck(s, rollback, journal);
    rollbackTick(s, rollback);
    if (journal !== undefined) {
      journalPause.sendPauseCommit(s, rollback, journal);
      journalPause.commitPauseAtFrame(s, rollback, journal);
    }
  } else if (s.game.phase === Phase.match && !s.session.paused) callbackMatchTick(s);
  if (s.game.phase !== Phase.match) clearAllInputs(s);
  else for (const slot of PARTICIPANT_SLOTS) clearPulse(s.participants[slot].keys.directions);
  syncKeyEvents(s);
  const held = heldVisualFrame(localSlot()) !== undefined || view.resumePresentationHeld(s);
  beginPresentedFrame(s.game.phase === Phase.match && !s.session.paused && !held);
  if (!held) {
    beginFrameSection(PRESENTATION_SECTION);
    view.renderPersistentPresentation(s);
    renderCaptureStage(s);
    endFrameSection(PRESENTATION_SECTION);
    beginFrameSection(CAMERA_SECTION);
    view.lockArenaCamera(s);
    endFrameSection(CAMERA_SECTION);
    beginFrameSection(UI_SECTION);
    view.renderUi(s);
    endFrameSection(UI_SECTION);
    holdPresentedCapture(s);
  }
  writeDrawnFrame(s);
  const journal = s.rollback?.journal;
  if (editbox !== undefined && journal !== undefined) {
    const { barrier } = journal;
    editbox.updatePauseHint(s.session.paused, barrier.request !== undefined, pausing(barrier), pauseHudHidden(s));
  }
  if (s.game.phase === Phase.characterMenu || s.game.phase === Phase.stageMenu) s.menuFrames = ((s.menuFrames ?? 0) + 1) & 1048575;
  openControlsFirst(s);
  serviceHelp(s);
  servicePlaytestRequest(s);
  serviceStageLoad(s);
  if (s.game.phase === Phase.result) serviceAutomaticRematch(s);
  presentMatchFlow(s);
  publishMenu(s);
  const local = localParticipantSlot(s);
  if (probe.probeRecording(s.probe) && local !== undefined) {
    const confirmed = s.participants[local].body !== undefined && isActive(s.world, local) && fighterAt(s.world, local).shield.raised;
    const predictedWorld = rollback?.speculative.world;
    const predicted = predictedWorld !== undefined && isActive(predictedWorld, local);
    probe.probePresent(s.probe, confirmed, predicted && fighterAt(predictedWorld, local).shield.raised, predicted ? rollback?.speculative.runtime.poses[local].selectionSerial ?? -1 : -1);
    if (probe.probeRecording(s.probe)) {
      const presented = s.build.presentation === "pool-predicted" && rollback !== undefined ? rollback.speculative : undefined;
      const world = presented?.world ?? s.world;
      const frame = presented?.runtime.simulationFrame ?? s.runtime.simulationFrame;
      for (const slot of PARTICIPANT_SLOTS) {
        if (!isActive(world, slot)) continue;
        const { x, z } = fighterAt(world, slot).motion;
        probe.probeFighterPosition(s.probe, slot, frame, x, z);
      }
      if (pausedBefore !== s.session.paused) {
        probe.probeIntegrity(s.probe, `pause-boundary ${s.session.paused ? "paused" : "resumed"} ${frame}`);
        if (s.build.pausePositionProbe && !s.session.paused) probe.exportProbe(s.probe);
      }
    }
  }
  writeReadyMarker(s);
  afterNativeDriverTick(s);
  afterNativeSoakTick(s);
  afterProbedTick(s);
}


function presentMatchFlow(s: ShellState): void {
  const { match, selections } = views(s);
  const { phase } = s.game;
  if (phase === Phase.characterMenu || phase === Phase.stageMenu) {
    match.enterMenus();
    const local = localParticipantSlot(s);
    match.presentMenus(s.game, local === undefined ? undefined : selections[local].hoveredTile());
    return;
  }
  if (!match.tick()) return;
  const posing = match.posing;
  const body = posing === undefined ? undefined : s.participants[posing]?.body;
  if (body !== undefined) showBody(body.unit, false);
}

function controlsCommand(s: ShellState): void {
  const slot = playerSlot(eventPlayer());
  if (!isParticipantSlot(slot) || !humanActive(s.game, slot)) return;
  const settings = s.participants[slot].bindings;
  if (!settings.ready) return;
  const announce = (message: string): void => displayText(player(slot), 0, 0, message);
  if (chatText() === SAVE_CONTROLS) {
    saveBindingSettings(settings);
    announce(settings.message);
  } else {
    loadSavedBindings(settings, announce);
  }
}

function playerLeft(s: ShellState): void {
  ownConfirmedState(s);
  const slot = playerSlot(eventPlayer());
  playerFilesOwnerLeft(slot);
  if (!humanPresent(s.game, slot)) return;
  const wasMatch = s.game.phase === Phase.match;
  keepShellMomentEnd(s);
  endReplaySegment(s);
  participantLeft(s.game, slot, s.world);
  clearAllInputs(s);
  startKeyUp(s.session, slot);
  if (isParticipantSlot(slot)) cancelBindingCapture(s.participants[slot].bindings);
  if (s.rollback !== undefined) s.rollback.active = false;
  if (wasMatch) {
    recordSessionWins(s.sessionWins, s.game);
    clearMatchEffects(s);
    s.session.paused = false;
    view.pauseMatchPresentation(s, false);
    view.setStatus(s, resultMessage(s.game), view.LASTING);
    views(s).match.beginResults(resultsView(s.game, s.world, views(s).match.tally), 0);
    writeMatchRecord(s);
  } else if (s.game.phase === Phase.characterMenu || s.game.phase === Phase.stageMenu) {
    cancelStageLoad(s);
    s.game.phase = Phase.characterMenu;
    const humans = currentHumanMask(s.game.departedMask);
    if (isParticipantMask(humans)) {
      updateConnectedHumans(s.game, humans);
      makePreview(s);
    }
    view.announce(s, "A player left. Choose the next match.");
  }
  syncKeyEvents(s);
}


function developerChord(s: ShellState, key: number, handler: string): void {
  const trigger = createEvents();
  for (const slot of PARTICIPANT_SLOTS) {
    if (humanActive(s.game, slot)) addKeyEvent(trigger, player(slot), osKey(key), 2, true);
  }
  onEvents(trigger, trampoline(handler));
}

function syncTrigger(s: ShellState, prefix: string, handler: string, humansOnly: boolean): void {
  const trigger = createEvents();
  for (const slot of PARTICIPANT_SLOTS) {
    if (!humansOnly || humanActive(s.game, slot)) addSyncEvent(trigger, player(slot), prefix);
  }
  onEvents(trigger, trampoline(handler));
}


function createTriggers(s: ShellState): void {
  createPadTriggers(s);
  developerChord(s, s.build.responseProbe ? Key.g : PROBE_KEYS.f5, PROBE_START);
  developerChord(s, s.build.responseProbe ? Key.j : PROBE_KEYS.f6, PROBE_EDGES);
  developerChord(s, s.build.responseProbe ? Key.h : PROBE_KEYS.f7, PROBE_DUMP);
  developerChord(s, Key.r, RESTART);
  developerChord(s, Key.t, TRACE);
  const startDown = createEvents();
  const startUp = createEvents();
  registerKey(s, startDown, Key.y, true);
  registerKey(s, startUp, Key.y, false);
  onEvents(startDown, trampoline(KEY_START_DOWN));
  onEvents(startUp, trampoline(KEY_START_UP));
  const pauseDown = createEvents();
  registerKey(s, pauseDown, Key.backspace, true);
  registerKey(s, pauseDown, Key.escape, true);
  onEvents(pauseDown, trampoline(KEY_PAUSE_DOWN));
  const previewDown = createEvents();
  registerKey(s, previewDown, Key.h, true);
  onEvents(previewDown, trampoline(KEY_PREVIEW_DOWN));
  syncTrigger(s, KEYBOARD_PAUSE_PREFIX, KEYBOARD_PAUSE, true);
  syncTrigger(s, MAIN_MENU_PREFIX, MAIN_MENU, true);
  syncKeyEvents(s);
  const { rollback } = s;
  if (rollback !== undefined) syncTrigger(s, INPUT_PREFIX, INPUT, true);
  if (rollback !== undefined) netDelay.registerDelayProposals(netDelay.DELAY_RECEIVED);
  if (rollback?.journal !== undefined) syncTrigger(s, CONTROL_ACK_PREFIX, CONTROL_ACK, true);
  if (rollback?.journal?.editbox !== undefined) {
    syncTrigger(s, PAUSE_REQUEST_PREFIX, PAUSE_REQUEST, true);
    syncTrigger(s, journalPause.CHAT_CLOSED_PREFIX, CHAT_CLOSED, true);
  }
  if (s.build.devConsole) {
    const chat = createEvents();
    for (const slot of PARTICIPANT_SLOTS) addChatEvent(chat, player(slot), "-dev ", false);
    onEvents(chat, trampoline(DEV_COMMAND));
  }
  const received = createEvents();
  registerChatEvents(received, PARTICIPANT_SLOTS);
  onEvents(received, trampoline(CHAT_RECEIVED));
  const history = createEvents();
  registerChatHistoryKey(history, PARTICIPANT_SLOTS, osKey(Key.f8));
  onEvents(history, trampoline(CHAT_HISTORY));
  const controls = createEvents();
  for (const slot of PARTICIPANT_SLOTS) {
    addChatEvent(controls, player(slot), SAVE_CONTROLS, true);
    addChatEvent(controls, player(slot), LOAD_CONTROLS, true);
  }
  onEvents(controls, trampoline(CONTROLS_COMMAND));
  const clip = createEvents();
  for (const slot of PARTICIPANT_SLOTS) addChatEvent(clip, player(slot), SAVE_MOMENT_COMMAND, true);
  onEvents(clip, trampoline(SAVE_MOMENT));
  syncTrigger(s, PLAYTEST_PREFIX, PLAYTEST, true);
  syncTrigger(s, STAGE_READY_PREFIX, STAGE_READY, true);
  const leave = createEvents();
  for (const slot of PARTICIPANT_SLOTS) addLeaveEvent(leave, player(slot));
  onEvents(leave, trampoline(PLAYER_LEFT));
  holdGameSpeed();
  const tick = createTimer();
  startTimer(tick, FRAME_SECONDS, true, trampoline(TICK));
  startFrameClock(tick);
}


function worldOrigin(): { x: number; y: number; z: number } {
  const center = mapCenter();
  // Engine: terrain water can change GetLocationZ at the map centre, so the arena stands at a fixed height over the base map's ground (z 0).
  const origin = { x: locationX(center), y: locationY(center), z: FLOOR_HEIGHT };
  removeLocation(center);
  return origin;
}


function initialize(build: MapBuild, playback: RollbackPlayback, origin: { x: number; y: number; z: number }): void {
  if (shellState() !== undefined) return;
  hideOriginFrames(true);

  if (!loadFrameFile("war3mapImported\\SmashcraftHUD.toc")) displayText(localPlayer(), 0.0, 0.0, "The game's menus could not load. Restart the game.");
  enableSelections(false, false);
  enableUserControl(true);
  enableFog(false);
  enableFogMask(false);


  for (const slot of PARTICIPANT_SLOTS) setPlayerColor(player(slot), slot);
  const s = createShellState(build, {
    origin, frames: view.createStatusFrames(), persistence: bindingFiles, playback,
    editbox: journalIngress(build) === "editbox" ? new EditboxIngress() : undefined,
  });
  copyMatchState(s.game, startingSelection(build.scenario));
  s.startingChoicesReady = s.game.computerMask === 0;
  findWarcraftMenuFrames();
  createUi(s, panelActions(), (choice, clicker) => selectPauseMenu(s, playerSlot(clicker), choice));
  s.ui?.results.bindActions((choice, clicker) => pickResult(s, playerSlot(clicker), choice));
  view.drawStage(s);
  setCameraSmoothing(0.0);
  setTimeOfDay(12.0);
  setTimeOfDayScale(0.0);
  startPlayerFiles();
  makePreview(s);
  view.lockArenaCamera(s);
  view.renderUi(s);
  createTriggers(s);
  startHelp(s);
  readPlaytestRequest(s);
  readMatchIndex();
  for (const participant of s.participants) {
    if (humanActive(s.game, participant.slot)) initializeBindingSettings(participant.bindings);
    else useDefaultBindings(participant.bindings);
  }
  previewControlsFirst(s);
}


function serviceDelay(s: ShellState, rollback: Rollback): void {
  const local = localSlot();
  netDelay.serviceNetDelay(rollback.net, s.game, local, rollback.delay, s.game.phase === Phase.match, rollback.predictionHeld || rollback.stalled > 0);
  netDelay.sendHandleLedger(s.game);
  if (s.game.phase !== Phase.characterMenu || floorMod(rollback.net.ticks, 30) !== 0) return;
  const net = netDelay.lobbyNet(rollback.net, s.game, local);
  for (const panel of views(s).selections) panel.showDelay(net);
}


function withShell(handler: (s: ShellState) => void): () => void {
  return () => {
    const s = shellState();
    if (s !== undefined) handler(s);
  };
}

function completeStartingChoices(): void {
  playerFileReceived();
  const s = shellState();
  if (s === undefined || s.startingChoicesReady !== false) return;
  const first = firstHumanSlot(s.game);
  if (first === undefined || !s.participants[first].bindings.ready) return;
  startComputerChoices(s.game, receivedLobbyCounter(first), s.menuFrames ?? 0);
  chooseScenarioCharacters(s.build.scenario, s.game);
  s.startingChoicesReady = true;
  makePreview(s);
}


export function installShell(): void {
  installHandleLedger(handleLedger());
  on(PAD_MOUSE, withShell(padMouse));
  on(TICK, withShell(gameTick));
  on(DRAW_EVENT, drawBetweenFrames);
  on(KEY_DOWN, withShell(onKeyDown));
  on(KEY_UP, withShell(onKeyUp));
  on(KEY_START_DOWN, withShell(onStartKeyDown));
  on(KEY_START_UP, withShell(onStartKeyUp));
  on(KEY_PAUSE_DOWN, withShell(onPauseKeyDown));
  on(KEY_PREVIEW_DOWN, withShell(onPreviewKeyDown));
  on(KEYBOARD_PAUSE, withShell(onKeyboardPause));
  on(MAIN_MENU, withShell(onMainMenu));
  on(INPUT, withShell(receiveInput));
  on(netDelay.DELAY_RECEIVED, withShell(s => { if (s.rollback !== undefined) netDelay.receiveDelayProposal(s.rollback.net, s.game); }));
  on(CONTROL_ACK, withShell(journalPause.receiveControlAckEvent));
  on(PAUSE_REQUEST, withShell(journalPause.pauseRequestEvent));
  on(CHAT_CLOSED, withShell(journalPause.chatClosedEvent));
  on(EDITBOX_ENTER, withShell(journalPause.chatEntered));
  on(DEV_COMMAND, withShell(onDevCommand));
  on(CHAT_RECEIVED, withShell(receiveChat));
  on(CHAT_HISTORY, withShell(toggleChatHistory));
  on(CONTROLS_COMMAND, withShell(controlsCommand));
  on(HELP_EVENT, helpCommand);
  on(PLAYER_LEFT, withShell(playerLeft));
  on(RESTART, withShell(onDeveloperRestart));
  on(TRACE, withShell(onDeveloperTrace));
  on(PROBE_START, withShell(s => onProbeStart(s, false)));
  on(PROBE_EDGES, withShell(s => onProbeStart(s, true)));
  on(PROBE_DUMP, withShell(onProbeExport));
  on(probe.PROBE_EXPORT, withShell(s => { if (s.probe !== undefined) probe.exportProbePage(s.probe); }));
  on(PLAYER_FILE_RECEIVED, completeStartingChoices);
  on(SAVE_MOMENT, withShell(momentKey));
  on(PLAYTEST, withShell(playtestRequested));
  on(STAGE_READY, withShell(stageReadyEvent));
  const s = shellState();
  if (s?.ui !== undefined) {
    findWarcraftMenuFrames();
    recreateUi(s, panelActions(), (choice, clicker) => selectPauseMenu(s, playerSlot(clicker), choice));
    s.ui?.results.bindActions((choice, clicker) => pickResult(s, playerSlot(clicker), choice));
  }

  if (s !== undefined && s.moment === undefined) s.moment = momentSaves();
  if (s !== undefined && s.replay === undefined) s.replay = replayRecording();
  const rollback: { net?: netDelay.NetDelay; readonly mode: { readonly rollback: number } } | undefined = s?.rollback;
  if (rollback !== undefined && rollback.net === undefined) rollback.net = netDelay.createNetDelay(rollback.mode.rollback);

  if (s !== undefined && s.drawnStage === undefined) view.drawStage(s);
}


export function startShell(build: MapBuild, playback: RollbackPlayback): void {
  const origin = worldOrigin();
  preloadStageAssets(origin);
  initialize(build, playback, origin);
}
