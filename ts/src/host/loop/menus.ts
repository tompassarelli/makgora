import type { QuickStageSettings } from "../../game/session/devSettings";




import { floorMod } from "wisp/src/sim/intMath";
import { Action } from "../../game/input/actions";
import { menuAction } from "../../game/input/keyBindings";
import { pressKey } from "../../game/input/playerKeys";
import { PARTICIPANT_SLOTS, type ParticipantSlot, isParticipantSlot } from "../../game/input/participants";
import {
  DEFAULT_RESULT_PICK, Phase, RESULT_PICKS, ResultPick, resultChoicesOpen, changeStagePoolMode, changeStagePoolStage, canChooseComputer, cancelRematchCountdown, firstHumanSlot, characterFor, confirmRematch, cycleSlotMode, humanActive, recallCharacter,
  setTeamBattle, setFriendlyFire, cycleTeam, requestStageSelect, requestStart, setAutomaticRematch, setCpuOpponent, setCpuTier, setEndless, setHitAreas, setPartnerDamage, setTraining, cycleMatchMode, stepClassicTier, stepLoreBattle, setItemsOn, setUltimatesOn, toggleItemKind, stepPartnerBehaviour,
  stepPartnerEscape, stepPartnerTech, stepTrainingSpeed, setTutorialLesson, tickRematchCountdown,
  returnToCharacters, selectCharacter, selectCpuCharacter, selectStage, setHazards, setMeterDropsOn, setStocks, setTimeLimit, updateConnectedHumans,
  type MatchState, copyMatchState, createMatchState, initializeComputerChoices, setParticipants,
} from "../../game/lobby/lobbyState";
import { resetMomentRecorder } from "../../game/replay/moment";
import { resetPacingAndPresentation } from "../../game/match/pacingAndPresentation";
import { clearObservedActions } from "../../game/match/step";
import { clearAttackBuffer } from "../../game/input/attackBuffer";
import { copyControls, neutralControls } from "../../game/sim/roster";
import { chooseScenarioCharacters } from "../../game/session/scenarios";
import { PARTNER_DAMAGE_STEP } from "../../game/match/trainingState";
import { LESSONS, NO_LESSON, prepareTutorial, stepTutorialLesson } from "../../game/match/tutorial";
import { prepareQuickMatch } from "../../game/session/devSettings";
import type { Scenario } from "../../game/session/build";
import type { Character } from "../../game/sim/codes";
import { type PlaytestRequest, preparePlaytest } from "../../game/session/playtest";
import { nextStage } from "../../game/menu/stageCatalog";
import { nextMatchCharacter } from "../../game/lobby/lobbyState";
import { stepCpuOpponent, stepCpuTier } from "../../game/match/cpuProfiles";
import { traceSelectionState } from "./diagnostics";
import { ClassicStep, continueClassic, quitClassic, skipToClassicBoss, startClassic } from "../../game/classic/classic";
import { LORE_BATTLES, LoreStep, continueLore, startLore } from "../../game/classic/loreBattles";
import { clearParticipantInputs, controlsAvailable, currentComputerMask, currentHumanMask } from "./inputs";
import { startMatch } from "./matchStart";
import { cancelStageLoad, requestStageLoad, stageLoading } from "./stageLoad";
import { endReplaySegment } from "./replays";
import { makePreview } from "./preview";
import { type ShellState, cancelPendingPlaytest, keepShellMomentEnd, shell } from "./state";
import type { PanelActions } from "./ui";
import { clearMatchEffects, views } from "./ui";
import { announce, pauseMatchPresentation, setStatus } from "./view";


export function choose(s: ShellState, slot: ParticipantSlot, direction: -1 | 1): void {
  if (!controlsAvailable(s, slot) || stageLoading(s)) return;
  if (s.game.phase === Phase.characterMenu) {
    cancelPendingPlaytest();
    selectCharacter(s.game, slot, nextMatchCharacter(s.game, characterFor(s.game, slot), direction));
    makePreview(s);
  } else if (s.game.phase === Phase.stageMenu) selectStage(s.game, slot, nextStage(s.game.stageChoice, direction));
  else if (resultChoicesShown(s)) stepResultFocus(s, slot, direction);
}

const resultChoicesShown = (s: ShellState): boolean => resultChoicesOpen(s.game) && views(s).match.pending === undefined;

export function stepResultFocus(s: ShellState, slot: ParticipantSlot, direction: number): void {
  const focus = s.resultFocus ??= [DEFAULT_RESULT_PICK, DEFAULT_RESULT_PICK, DEFAULT_RESULT_PICK, DEFAULT_RESULT_PICK];
  focus[slot] = floorMod((focus[slot] ?? DEFAULT_RESULT_PICK) + direction, RESULT_PICKS);
}

export function resultKey(s: ShellState, slot: ParticipantSlot, key: number, action: Action | undefined): boolean {
  const step = key === 0x25 || key === 0x26 || action === Action.moveLeft || action === Action.moveUp ? -1 : key === 0x27 || key === 0x28 || action === Action.moveRight || action === Action.moveDown ? 1 : 0;
  if (step === 0 || !resultChoicesShown(s)) return false;
  stepResultFocus(s, slot, step);
  return true;
}

export function pickResult(s: ShellState, actor: number, choice: number): void {
  if (!isParticipantSlot(actor) || !resultChoicesOpen(s.game)) return;
  stepResultFocus(s, actor, choice - (s.resultFocus?.[actor] ?? DEFAULT_RESULT_PICK));
  confirm(s, actor, true);
}


export function confirm(s: ShellState, slot: ParticipantSlot, clicked = false): void {
  if (s.pauseMenu?.title) {
    s.pauseMenu.title = false;
    return;
  }
  if (!controlsAvailable(s, slot)) {
    announce(s, "Controls are still loading or settings are open.");
    return;
  }
  const { game } = s;
  if (stageLoading(s)) return;
  if (game.phase === Phase.characterMenu) {
    s.pauseSelection = createMatchState();
    copyMatchState(s.pauseSelection, game);
  }
  if (game.phase === Phase.characterMenu && game.lore) {
    if (!startLore(game, slot)) return;
    for (const panel of views(s).settings) panel.close();
    requestStageLoad(s, slot);
  } else if (game.phase === Phase.characterMenu && game.classic) {
    if (!startClassic(game, slot)) return;
    for (const panel of views(s).settings) panel.close();
    requestStageLoad(s, slot);
  } else if (game.phase === Phase.characterMenu) {
    if (requestStageSelect(game, slot)) {
      if (s.dev.stageChoice !== undefined) selectStage(game, slot, s.dev.stageChoice);
      s.dev.stageChoice = undefined;
      for (const panel of views(s).settings) panel.close();
    }
  } else if (game.phase === Phase.stageMenu) {
    requestStageLoad(s, slot);
  } else if (game.phase === Phase.result && game.run.active && game.lore) {
    const step = continueLore(game, slot);
    if (step === LoreStep.none) return;
    setStatus(s, "", 0.0);
    if (step === LoreStep.retry) requestStageLoad(s, slot);
    else {
      updateConnectedHumans(game, currentHumanMask(game.departedMask));
      makePreview(s);
    }
  } else if (game.phase === Phase.result && game.run.active) {
    const step = continueClassic(game, slot);
    if (step === ClassicStep.none) return;
    setStatus(s, "", 0.0);
    if (step === ClassicStep.fight) requestStageLoad(s, slot);
    else {
      updateConnectedHumans(game, currentHumanMask(game.departedMask));
      makePreview(s);
    }
  } else if (game.phase === Phase.result) {
    if (cancelRematchCountdown(game, slot)) return;
    if (!clicked && !resultChoicesShown(s)) return;
    const pick = s.resultFocus?.[slot] ?? DEFAULT_RESULT_PICK;
    if (pick !== ResultPick.rematch && pick !== ResultPick.newStage && pick !== ResultPick.characters) return;
    if (!confirmRematch(game, slot, pick)) return;
    s.resultFocus = undefined;
    updateConnectedHumans(game, currentHumanMask(game.departedMask));
    setStatus(s, "", 0.0);
    const next = s.game.phase as Phase;
    if (next === Phase.match) startMatch(s);
    else makePreview(s);
  }
}

export function back(s: ShellState, slot: ParticipantSlot): void {
  if (!controlsAvailable(s, slot) || stageLoading(s)) return;
  if (s.game.phase === Phase.characterMenu) views(s).selections[slot].recallHeld();
  else if (s.game.phase === Phase.stageMenu) returnToCharacters(s.game, slot);
  else if (s.game.phase === Phase.result && quitClassic(s.game, slot)) {
    setStatus(s, "", 0.0);
    makePreview(s);
  } else if (s.game.phase === Phase.result) cancelRematchCountdown(s.game, slot);
}






export function serviceAutomaticRematch(s: ShellState): void {
  const journal = s.rollback?.journal;
  if (journal !== undefined && s.rollback?.active === true && journal.lifecycle?.quiescent() !== true) return;
  if (!tickRematchCountdown(s.game)) return;
  setStatus(s, "", 0.0);
  startMatch(s);
}

export function openSettingsScreen(s: ShellState, slot: ParticipantSlot): void {
  if (s.game.phase !== Phase.characterMenu || !humanActive(s.game, slot)) return;
  if (!s.participants[slot].bindings.ready) {
    announce(s, "Controls are still loading.");
    return;
  }
  clearParticipantInputs(s, slot);
  views(s).settings[slot].show();
}


export function startQuickMatch(s: ShellState, stage = 0, scenario: Scenario = s.build.scenario, character?: Character | readonly Character[], stocks = 1, stageSettings?: QuickStageSettings): void {
  if (prepareQuickMatch(s.game, stage, character, stocks)) {
    for (const panel of views(s).settings) panel.close();
    startMatch(s, scenario, stageSettings);
  }
}


export function startDevClassic(s: ShellState, character: Character, boss: boolean): void {
  const first = firstHumanSlot(s.game);
  if (first === undefined || s.game.phase !== Phase.characterMenu || stageLoading(s)) return;
  selectCharacter(s.game, first, character);
  s.game.training = false;
  s.game.classic = true;
  s.pauseSelection = createMatchState();
  copyMatchState(s.pauseSelection, s.game);
  if (!startClassic(s.game, first)) return;
  if (boss) skipToClassicBoss(s.game);
  for (const panel of views(s).settings) panel.close();
  requestStageLoad(s, first);
}


export function startDevLore(s: ShellState, battle: number): void {
  const first = firstHumanSlot(s.game);
  if (first === undefined || s.game.phase !== Phase.characterMenu || stageLoading(s)) return;
  s.game.training = false;
  s.game.classic = false;
  s.game.lore = true;
  s.game.loreBattle = battle - 1;
  if (!startLore(s.game, first)) return;
  for (const panel of views(s).settings) panel.close();
  requestStageLoad(s, first);
}


export function startPlaytest(s: ShellState, request: PlaytestRequest): boolean {
  const first = firstHumanSlot(s.game);
  if (first === undefined || !preparePlaytest(s.game, request)) return false;
  for (const panel of views(s).settings) panel.close();
  return requestStageLoad(s, first);
}


function withSlot(participant: number, act: (s: ShellState, slot: ParticipantSlot) => void): void {
  if (isParticipantSlot(participant)) act(shell(), participant);
}


export function panelActions(): PanelActions {
  return {
    selection: {
      selectChoice: (participant, choice) => withSlot(participant, (s, slot) => {
        if (!controlsAvailable(s, slot) || s.game.phase !== Phase.characterMenu) return;
        cancelPendingPlaytest();
        selectCharacter(s.game, slot, choice);
        makePreview(s);
      }),
      selectCpuChoice: (participant, computer, choice) => withSlot(participant, (s, slot) => {
        if (!controlsAvailable(s, slot) || s.game.phase !== Phase.characterMenu || !canChooseComputer(s.game, slot, computer)) return;
        cancelPendingPlaytest();
        selectCpuCharacter(s.game, slot, computer, choice);
        makePreview(s);
      }),
      cycleMode: (actor, fighterSlot) => withSlot(actor, (s, slot) => {
        if (!controlsAvailable(s, slot) || !cycleSlotMode(s.game, slot, fighterSlot)) return;
        cancelPendingPlaytest();
        makePreview(s);
        traceSelectionState(s, `cycle actor ${slot} slot ${fighterSlot}`);
      }),
      recallChoice: (actor, chipSlot) => withSlot(actor, (s, slot) => {
        if (!controlsAvailable(s, slot) || s.game.phase !== Phase.characterMenu) return;
        cancelPendingPlaytest();
        recallCharacter(s.game, slot, chipSlot);
        makePreview(s);
      }),
      openSettings: participant => withSlot(participant, openSettingsScreen),
      start: participant => withSlot(participant, (s, slot) => {
        if (s.game.phase === Phase.characterMenu) confirm(s, slot);
      }),
      changeStocks: (participant, direction) => withSlot(participant, (s, slot) => {
        if (controlsAvailable(s, slot)) setStocks(s.game, slot, s.game.stockCount + direction);
      }),
      changeTime: (participant, direction) => withSlot(participant, (s, slot) => {
        if (controlsAvailable(s, slot)) setTimeLimit(s.game, slot, s.game.timeLimitMinutes + direction);
      }),
      toggleTeamBattle: participant => withSlot(participant, (s, slot) => {
        if (controlsAvailable(s, slot)) setTeamBattle(s.game, slot, !s.game.teamBattle);
      }),
      toggleFriendlyFire: participant => withSlot(participant, (s, slot) => {
        if (controlsAvailable(s, slot)) setFriendlyFire(s.game, slot, !s.game.friendlyFire);
      }),
      changeTeam: (participant, fighter, direction) => withSlot(participant, (s, slot) => {
        if (controlsAvailable(s, slot)) cycleTeam(s.game, slot, fighter, direction);
      }),
      toggleEndless: participant => withSlot(participant, (s, slot) => {
        if (controlsAvailable(s, slot)) setEndless(s.game, slot, !s.game.endless);
      }),
      changeCpuOpponent: (actor, computer, direction) => withSlot(actor, (s, slot) => {
        if (!controlsAvailable(s, slot) || !isParticipantSlot(computer)) return;
        cancelPendingPlaytest();
        setCpuOpponent(s.game, slot, computer, stepCpuOpponent(s.game.cpuOpponents[computer], direction));
      }),
      changeCpuTier: (actor, computer, direction) => withSlot(actor, (s, slot) => {
        if (!controlsAvailable(s, slot) || !isParticipantSlot(computer)) return;
        cancelPendingPlaytest();
        setCpuTier(s.game, slot, computer, stepCpuTier(s.game.cpuTiers[computer], direction));
      }),
      toggleAutomaticRematch: participant => withSlot(participant, (s, slot) => {
        if (controlsAvailable(s, slot)) setAutomaticRematch(s.game, slot, !s.game.automaticRematch);
      }),
      toggleItems: participant => withSlot(participant, (s, slot) => {
        if (controlsAvailable(s, slot)) setItemsOn(s.game, slot, !s.game.items.on);
      }),
      toggleUltimates: participant => withSlot(participant, (s, slot) => {
        if (controlsAvailable(s, slot)) setUltimatesOn(s.game, slot, s.game.ultimatesOff);
      }),
      toggleItemKind: (participant, kind) => withSlot(participant, (s, slot) => {
        if (controlsAvailable(s, slot)) toggleItemKind(s.game, slot, kind);
      }),
      cycleMatchMode: participant => withSlot(participant, (s, slot) => {
        if (controlsAvailable(s, slot)) cycleMatchMode(s.game, slot);
      }),
      stepClassicTier: (participant, direction) => withSlot(participant, (s, slot) => {
        if (!controlsAvailable(s, slot)) return;
        if (s.game.lore) stepLoreBattle(s.game, slot, direction, LORE_BATTLES.length);
        else stepClassicTier(s.game, slot, direction);
      }),
      stepTraining: (participant, setting, direction) => withSlot(participant, (s, slot) => {
        if (!controlsAvailable(s, slot)) return;
        if (setting === "behaviour") stepPartnerBehaviour(s.game, slot, direction);
        else if (setting === "escape") stepPartnerEscape(s.game, slot, direction);
        else if (setting === "tech") stepPartnerTech(s.game, slot, direction);
        else setPartnerDamage(s.game, slot, s.game.trainer.damage + direction * PARTNER_DAMAGE_STEP);
      }),
      toggleHitAreas: participant => withSlot(participant, (s, slot) => {
        if (controlsAvailable(s, slot)) setHitAreas(s.game, slot, !s.game.trainer.showHitAreas);
      }),
      stepSpeed: participant => withSlot(participant, (s, slot) => {
        if (controlsAvailable(s, slot)) stepTrainingSpeed(s.game, slot, 1);
      }),
      stepTutorial: (participant, direction) => withSlot(participant, (s, slot) => {
        if (controlsAvailable(s, slot)) stepTutorialLesson(s.game, slot, direction);
      }),
      startTutorial: participant => withSlot(participant, (s, slot) => {
        if (!controlsAvailable(s, slot) || stageLoading(s)) return;
        cancelPendingPlaytest();
        if (!prepareTutorial(s.game, slot)) return;
        for (const panel of views(s).settings) panel.close();
        makePreview(s);
        requestStageLoad(s, slot);
      }),
      closeTutorial: participant => withSlot(participant, (s, slot) => {
        if (controlsAvailable(s, slot)) setTutorialLesson(s.game, slot, NO_LESSON, LESSONS.length);
      }),
    },
    stage: {
      togglePoolMode: participant => withSlot(participant, (s, slot) => {
        if (!stageLoading(s)) changeStagePoolMode(s.game, slot);
      }),
      togglePoolStage: (participant, choice) => withSlot(participant, (s, slot) => {
        if (!stageLoading(s)) changeStagePoolStage(s.game, slot, choice);
      }),
      selectStage: (participant, choice) => withSlot(participant, (s, slot) => {
        if (!stageLoading(s)) selectStage(s.game, slot, choice);
      }),
      start: participant => withSlot(participant, confirm),
      back: participant => withSlot(participant, (s, slot) => {
        if (!stageLoading(s)) returnToCharacters(s.game, slot);
      }),
      toggleHazards: participant => withSlot(participant, (s, slot) => {
        if (!stageLoading(s)) setHazards(s.game, slot, !s.game.hazards);
      }),
      toggleDrops: participant => withSlot(participant, (s, slot) => {
        if (!stageLoading(s)) setMeterDropsOn(s.game, slot, !s.game.drops.on);
      }),
    },
    settings: {
      closeSettings: participant => withSlot(participant, clearParticipantInputs),
    },
  };
}


export function startingSelection(scenario: Scenario, seed?: number): MatchState {
  const game = createMatchState();
  setParticipants(game, currentHumanMask(0), currentComputerMask());
  if (seed !== undefined) initializeComputerChoices(game, seed);
  chooseScenarioCharacters(scenario, game);
  return game;
}






export function resetToStartingSelection(s: ShellState): void {
  if (s.game.phase === Phase.match) {
    keepShellMomentEnd(s);
    endReplaySegment(s);
    clearMatchEffects(s);
  }
  cancelStageLoad(s);
  if (s.session.paused) {
    s.session.paused = false;
    pauseMatchPresentation(s, false);
  }
  for (const panel of views(s).settings) panel.close();
  const { matchSeed } = s.game;
  copyMatchState(s.game, startingSelection(s.build.scenario, (s.menuFrames ?? 0) + matchSeed));
  s.game.matchSeed = matchSeed;
  s.dev.stageChoice = undefined;
  resetMomentRecorder(s.moment.recorder);
  resetPacingAndPresentation(s.runtime);
  clearObservedActions();
  for (const slot of PARTICIPANT_SLOTS) {
    clearAttackBuffer(s.controls.commands[slot]);
    copyControls(s.controls.inputs[slot], neutralControls());
  }
  setStatus(s, "", 0.0);
  makePreview(s);
}

export function journalMenuKey(s: ShellState, slot: ParticipantSlot, key: number): boolean {
  const { bindings } = s.participants[slot].bindings;
  const action = menuAction(bindings, key);
  if (action !== undefined) {
    pressKey(s.participants[slot].keys, key, bindings);
    if (views(s).selections[slot].menuAction(action)) return true;
  }
  const sideways = action === Action.moveLeft || action === Action.moveRight;
  if ((sideways || action === Action.attack || action === Action.special) && cancelRematchCountdown(s.game, slot)) return true;
  if (sideways) choose(s, slot, action === Action.moveLeft ? -1 : 1);
  else if (action === Action.attack) {
    if (s.game.phase !== Phase.characterMenu) confirm(s, slot);
    else {
      cancelPendingPlaytest();
      selectCharacter(s.game, slot, characterFor(s.game, slot) ?? 0);
      makePreview(s);
    }
  } else if (action === Action.special) {
    if (s.game.phase === Phase.characterMenu) recallCharacter(s.game, slot, slot);
    else back(s, slot);
  } else return false;
  return true;
}


const ALL_GREETED = 15;

export function previewControlsFirst(s: ShellState): void {
  if (s.game.phase !== Phase.characterMenu || stageLoading(s)) return;
  for (const slot of PARTICIPANT_SLOTS) if (humanActive(s.game, slot)) views(s).settings[slot].preview();
}

export function openControlsFirst(s: ShellState): void {
  if (s.game.phase !== Phase.characterMenu && s.controlsGreeted !== ALL_GREETED) {
    s.controlsGreeted = ALL_GREETED;
    for (const panel of views(s).settings) panel.endPreview();
  }
  if (s.game.phase !== Phase.characterMenu || s.startingChoicesReady === false || stageLoading(s)) return;
  for (const slot of PARTICIPANT_SLOTS) {
    const greeted = s.controlsGreeted ?? 0;
    const bit = 1 << slot;
    if ((greeted & bit) !== 0 || !humanActive(s.game, slot) || !s.participants[slot].bindings.ready) continue;
    s.controlsGreeted = greeted | bit;
    openSettingsScreen(s, slot);
  }
}
