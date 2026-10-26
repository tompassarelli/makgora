import { SHIELD_ENERGY_SAMPLES } from "../../game/session/shieldEnergyCapture";
import { PartnerBehaviour } from "../../game/match/trainingState";
import { traceSetup } from "../../game/session/traceSettings";
import { startNativeSoak } from "../../platform/nativeSoak";
import { HIT_PRESENTATION_CASES } from "../../game/session/hitPresentationCases";
import { createImpactEvents } from "../../game/presentation/impactEvents";
import { emitImpacts } from "../../game/presentation/impactState";
import { PARTICIPANT_SLOTS } from "../../game/input/participants";
import { Phase, setTraining, setHitAreas } from "../../game/lobby/lobbyState";
import { ROSTER_MANA } from "../../game/sim/mana";
import { fighterAt, isActive } from "../../game/sim/roster";
import { METER_COMMAND, classicDevRequest, loreDevRequest, LORE_WIN_COMMAND, winLoreBattle, DESYNC_COMMAND, QUICK_CPU_STOCKS, RESET_COMMAND, QUICK_TRAINING_COMMAND, applyDevCommand, prepareQuickCpu, prepareQuickTraining, quickMatchCpuHero, quickMatchCpuProfile, quickMatchHero, quickMatchHitAreas, quickMatchStocks, quickMatchPair, quickPromoRequest, prepareQuickPromo, quickStageSettings, quickPainHero, quickRecoveryHero, quickOffstageHero } from "../../game/session/devSettings";
import { fighterKey } from "../../game/sim/heroes/registry";
import { devReceiptFile } from "../../game/session/journalFiles";
import { applyFighterSetup } from "../../game/session/fighterSetup";
import { prepareDevState, commitDevState } from "./devState";
import { applySetupCommand } from "../../game/session/sessionSetup";
import { writeLines } from "wisp/src/platform/fileio";
import { probeFrameCostClock } from "./frameCost";
import { probeRenderClock } from "./renderClock";
import { probeCallbackClock } from "./callbackClock";
import { drawAtBurstTime } from "./betweenFrames";
import { showBackdrop, showStageLighting, leverCommand } from "./stageScenery";
import { fighterHideCommand, hideFighter } from "./fighterCloak";
import { journalIdentity } from "./journal";
import { startBodyFit } from "./bodyFit";
import { startAgencyFixture } from "./agencyFixture";
import { applyShowcaseCommand } from "./showcase";
import { showcaseRequest } from "../../game/session/showcase";
import { clearVisualCapture, configureVisualCapture } from "../../game/session/visualCapture";
import { resetToStartingSelection, startDevClassic, startDevLore, startQuickMatch } from "./menus";
import { LORE_BATTLES } from "../../game/classic/loreBattles";
import { makePreview } from "./preview";
import { type ShellState, localSlot } from "./state";
import { views } from "./ui";
import { ownConfirmedState } from "./confirmedState";
import { pauseMatchPresentation, renderFighter, renderPersistentPresentation } from "./view";


export function onDevCommand(s: ShellState): void {
  applyDeveloperCommand(s, GetPlayerId(GetTriggerPlayer()), GetEventPlayerChatString());
}


const CINE_OFF_SUFFIX = " |cine off";


export function applyDeveloperCommand(s: ShellState, actor: number, original: string): void {
  if (!s.build.devConsole) return;
  ownConfirmedState(s);
  if (original === RESET_COMMAND) resetDeveloperPresentation(s);
  const message = developerMessage(s, original);
  if (message.startsWith("-dev setup ")) {
    applySetupCommands(s, actor, message);
    return;
  }
  const receipt = sessionReceipt(s, actor, message, developerRequests(s, actor, message));
  if (receipt === undefined) return;
  writeDeveloperReceipt(s, receipt);
}

function resetDeveloperPresentation(s: ShellState): void {
  s.promoHudHidden = false;
  clearVisualCapture(localSlot());
  for (const slot of PARTICIPANT_SLOTS) s.hiddenFighters[slot] = undefined;
  pauseMatchPresentation(s, s.session.paused);
}

function developerMessage(s: ShellState, original: string): string {
  const trace = traceSetup(original);
  if (original === RESET_COMMAND) s.trace.limit = undefined;
  if (s.build.responseProbe && trace.callbacks !== undefined) s.trace.limit = trace.callbacks;
  const captured = s.build.responseProbe ? configureVisualCapture(trace.command, localSlot()) : trace.command;
  const cineOff = captured.endsWith(CINE_OFF_SUFFIX);
  if (cineOff || original === RESET_COMMAND) views(s).combat.cineFilter = !cineOff;
  return cineOff ? captured.substring(0, captured.length - CINE_OFF_SUFFIX.length) : captured;
}

function applySetupCommands(s: ShellState, actor: number, message: string): void {
  const commands = message.substring(11).split(";");
  if (commands.length > 32 || commands.some(command => command.length === 0 || command.startsWith("setup "))) return;
  s.devStep = 0;
  s.devSteps = commands.length;
  for (const command of commands) {
    s.devStep++;
    applyDeveloperCommand(s, actor, `-dev ${command}`);
  }
  s.devStep = 1;
  s.devSteps = 1;
}

function editFighters(s: ShellState, message: string): string | undefined {
  let fighterEdited = false;
  const fighterSetup = applyFighterSetup(s.game, s.world, message, () => { prepareDevState(s); fighterEdited = true; });
  if (fighterEdited) commitDevState(s);
  return fighterSetup;
}

function developerRequests(s: ShellState, actor: number, message: string) {
  const fighterSetup = editFighters(s, message);
  const promo = quickPromoRequest(message);
  const quickStage = quickStageSettings(message);
  const quickHero = quickMatchHero(message);
  const quickPair = quickMatchPair(message);
  const recoveryHero = quickRecoveryHero(message);
  const offstageHero = quickOffstageHero(message);
  const painHero = quickPainHero(message);
  const quickCpu = quickMatchCpuProfile(message);
  const fighterHide = fighterHideCommand(message);
  const showcase = showcaseRequest(message);

  const setup = applySetupCommand(s.game, actor, message);
  if (setup === `dev: stage ${s.game.stageChoice}` && s.game.phase === Phase.characterMenu) s.dev.stageChoice = s.game.stageChoice;
  const classic = classicDevRequest(message);
  const lore = loreDevRequest(message, LORE_BATTLES.length);
  return { fighterSetup, promo, quickStage, quickHero, quickPair, recoveryHero, offstageHero, painHero, quickCpu, fighterHide, showcase, setup, classic, lore };
}

type DeveloperRequests = ReturnType<typeof developerRequests>;

function sessionReceipt(s: ShellState, actor: number, message: string, requests: DeveloperRequests): string | undefined {
  const { fighterSetup, showcase, lore, classic } = requests;
  if (fighterSetup !== undefined) return fighterSetup;
  if (message === "-dev trace") return "dev: trace";
  if (message === "-dev soak") return startNativeSoak(s) ? "dev: native soak four CPUs" : "dev: native soak requires an integrity map at selection";
  if (showcase !== undefined) return applyShowcaseCommand(s, showcase, () => applyDeveloperCommand(s, actor, RESET_COMMAND));
  if (message === LORE_WIN_COMMAND) {
    if (!winLoreBattle(s.game, s.world)) return undefined;
    return "dev: lore win";
  }
  if (lore !== undefined) {
    const receipt = `dev: lore ${lore}`;
    startDevLore(s, lore);
    return receipt;
  }
  if (classic !== undefined) {
    const receipt = `dev: classic ${fighterKey(classic.character)}${classic.boss ? " boss" : ""}`;
    startDevClassic(s, classic.character, classic.boss);
    return receipt;
  }
  if (message.startsWith("-dev shield-energy ")) return shieldEnergyReceipt(s, message);
  return matchStartReceipt(s, actor, message, requests);
}

function matchStartReceipt(s: ShellState, actor: number, message: string, requests: DeveloperRequests): string | undefined {
  if (message === QUICK_TRAINING_COMMAND) {
    prepareQuickTraining(s.game);
    startQuickMatch(s, 0);
    return "dev: quick training";
  }
  if (message === RESET_COMMAND) {
    resetToStartingSelection(s);
    return "dev: reset";
  }
  if (message.startsWith(METER_COMMAND)) return meterReceipt(s, message);
  if (message === "-dev camera") {
    startQuickMatch(s, 0, "camera");
    return "dev: camera match";
  }
  return quickMatchReceipt(s, actor, message, requests);
}

function shieldEnergyReceipt(s: ShellState, message: string): string | undefined {
  const sample = SHIELD_ENERGY_SAMPLES.find(value => message === `-dev shield-energy ${value}`);
  if (sample === undefined || !s.game.training || s.game.phase !== Phase.match) return undefined;
  s.dev.shieldEnergyCapture = { sample, pending: true, lines: sample === "down" ? [] : s.dev.shieldEnergyCapture?.lines ?? [] };
  s.game.trainer.behaviour = sample === "down" ? PartnerBehaviour.stand : PartnerBehaviour.shield;
  s.session.paused = sample === "down";
  pauseMatchPresentation(s, s.session.paused, true);
  renderPersistentPresentation(s);
  return `dev: shield energy ${sample}`;
}

function meterReceipt(s: ShellState, message: string): string | undefined {
  const points = S2I(message.substring(METER_COMMAND.length));
  if (s.game.phase !== Phase.match || points < 0 || points > ROSTER_MANA.max) return undefined;
  prepareDevState(s);
  for (const slot of PARTICIPANT_SLOTS) if (isActive(s.world, slot)) fighterAt(s.world, slot).mana.points = points;
  commitDevState(s);
  return `dev: meter ${points}`;
}

function quickMatchReceipt(s: ShellState, actor: number, message: string, requests: DeveloperRequests): string | undefined {
  const { promo, quickCpu, quickStage, offstageHero, recoveryHero, painHero, quickPair, quickHero } = requests;
  if (promo !== undefined) {
    if (!prepareQuickPromo(s.game, promo.pair)) return undefined;
    s.promoHudHidden = true;
    ClearTextMessages();
    startQuickMatch(s, promo.stage, "normal", undefined, QUICK_CPU_STOCKS);
    return "dev: quick promo";
  }
  if (quickCpu !== undefined) {
    const receipt = `dev: quick match cpu ${quickCpu}`;
    prepareQuickCpu(s.game, quickCpu, quickMatchCpuHero(message));
    startQuickMatch(s, 0, s.build.scenario, undefined, QUICK_CPU_STOCKS);
    return receipt;
  }
  if (quickStage !== undefined) {
    startQuickMatch(s, quickStage.stage, s.build.scenario, quickStage.pair, 1, quickStage);
    return "dev: quick match";
  }
  if (offstageHero !== undefined) {
    const receipt = `dev: quick offstage ${fighterKey(offstageHero)}`;
    startQuickMatch(s, 0, "up-special-recovery", offstageHero);
    return receipt;
  }
  if (recoveryHero !== undefined) {
    const receipt = `dev: quick recovery ${fighterKey(recoveryHero)}`;
    startQuickMatch(s, 0, "knockdown", recoveryHero);
    return receipt;
  }
  if (painHero !== undefined) {
    const receipt = `dev: quick ${painHero.scenario} ${fighterKey(painHero.character)}`;
    startQuickMatch(s, 0, painHero.scenario, painHero.character);
    return receipt;
  }
  if (quickPair !== undefined) {
    const receipt = `dev: quick match ${fighterKey(quickPair[0])} / ${fighterKey(quickPair[1])}`;
    startQuickMatch(s, 0, s.build.scenario, quickPair);
    return receipt;
  }
  if (quickHero !== undefined) {
    const receipt = `dev: quick match ${fighterKey(quickHero)}`;
    if (quickMatchHitAreas(message)) {
      setTraining(s.game, actor, true);
      setHitAreas(s.game, actor, true);
    }
    startQuickMatch(s, 0, s.build.scenario, quickHero, quickMatchStocks(message));
    return receipt;
  }
  return presentationReceipt(s, actor, message, requests);
}

function presentationReceipt(s: ShellState, actor: number, message: string, requests: DeveloperRequests): string | undefined {
  if (message.startsWith("-dev effects ")) return effectsReceipt(s, message);
  if (message === "-dev frame-cost-clock") {
    probeFrameCostClock();
    return "dev: frame cost clock probe";
  }
  if (message === "-dev backdrop off" || message === "-dev backdrop on") {
    const visible = message === "-dev backdrop on";
    const receipt = `dev: backdrop ${visible ? "on" : "off"}`;
    showBackdrop(s, visible);
    return receipt;
  }
  if (message === "-dev lighting stock" || message === "-dev lighting stage") return lightingReceipt(s, message);
  if (message === "-dev view near" || message === "-dev view far" || message === "-dev view off") {
    s.viewExtreme = message === "-dev view near" ? "near" : message === "-dev view far" ? "far" : undefined;
    return `dev: view ${s.viewExtreme ?? "off"}`;
  }
  return sceneToggleReceipt(s, actor, message, requests);
}

function sceneToggleReceipt(s: ShellState, actor: number, message: string, requests: DeveloperRequests): string | undefined {
  const { fighterHide } = requests;
  if (fighterHide !== undefined) {
    if (!hideFighter(s, fighterHide.slot, fighterHide.hidden)) return undefined;
    if (!fighterHide.hidden) renderPersistentPresentation(s);
    return `dev: fighter ${fighterHide.slot} ${fighterHide.hidden ? "hidden" : "shown"}`;
  }
  if (message.startsWith("-dev lever ")) return leverReceipt(s, message);
  if (message.startsWith("-dev fogv ")) return fogReceipt(s, message);
  if (message === "-dev smooth-draw on" || message === "-dev smooth-draw off") {
    drawAtBurstTime(message === "-dev smooth-draw on");
    return `dev: smooth draw ${message === "-dev smooth-draw on" ? "on" : "off"}`;
  }
  if (message === "-dev camera-smooth on" || message === "-dev camera-smooth off") {
    s.cameraTween = message === "-dev camera-smooth on";
    return `dev: camera smooth ${s.cameraTween ? "on" : "off"}`;
  }
  return probeReceipt(s, actor, message, requests);
}

function probeReceipt(s: ShellState, actor: number, message: string, requests: DeveloperRequests): string | undefined {
  const { setup } = requests;
  if (message === "-dev render-clock") {
    probeRenderClock();
    return "dev: render clock probe";
  }
  if (message.startsWith("-dev callback-clock ")) {
    const callbacks = S2I(message.substring(20));
    return callbacks > 0 && probeCallbackClock(0x43, callbacks) ? `dev: callback clock ${callbacks}` : undefined;
  }
  if (message === DESYNC_COMMAND) return desyncReceipt(actor);
  if (setup !== undefined) {
    makePreview(s);
    return setup;
  }
  return startAgencyFixture(s, message) ?? startBodyFit(s, message) ?? applyDevCommand(s.dev, message);
}

function effectsReceipt(s: ShellState, message: string): string | undefined {
  const index = S2I(message.slice(13));
  const scenario = HIT_PRESENTATION_CASES[index];
  if (scenario === undefined || s.game.phase !== Phase.match) return undefined;
  const events = { ...createImpactEvents(), ...scenario.cue };
  events.x = 0.0;
  const ui = views(s);
  emitImpacts(s.runtime.impacts, events, 8, 0);
  ui.combat.presentConfirmed(s.devReceipts + 1, 4, events);
  ui.combat.present(s.runtime.impacts, s.runtime.simulationFrame, s.runtime.impacts, true);
  return `dev: effects ${index} ${scenario.model} ${scenario.sound}`;
}

function lightingReceipt(s: ShellState, message: string): string {
  const authored = message === "-dev lighting stage";
  showStageLighting(s, authored);
  for (const slot of PARTICIPANT_SLOTS) renderFighter(s, slot, s.runtime.poses[slot], s.participants[slot].before.out);
  renderPersistentPresentation(s);
  return `dev: lighting ${authored ? "stage" : "stock"}`;
}

function leverReceipt(s: ShellState, message: string): string {
  const words = message.slice(11).split(" ");
  leverCommand(s, words[0] ?? "", words[1] ?? "", words[2] ?? "");
  return "";
}

function fogReceipt(s: ShellState, message: string): string | undefined {
  const v = message.slice(10).split(" ").map((word) => S2R(word));
  if (v.length < 11) return undefined;
  s.stageFogOverride = true;
  SetTerrainFogExV(R2I(v[0] ?? 0), v[1] ?? 0, v[2] ?? 0, v[3] ?? 0, v[4] ?? 0, v[5] ?? 0, v[6] ?? 0, v[7] ?? 0, v[8] ?? 0, v[9] ?? 0, v[10] ?? 0);
  BlzSetTerrainFogDrawOverSky((v[11] ?? 0) > 0.5);
  return `dev: fogv ${message.slice(10)}`;
}

function desyncReceipt(actor: number): string {
  const slot = actor;
  const receipt = `dev: desync from player ${slot + 1}'s client`;
  // Creating a handle on one client alone diverges Warcraft's handle counter and tempest checksum.
  if (slot === GetPlayerId(GetLocalPlayer())) CreateTimer();
  return receipt;
}

function writeDeveloperReceipt(s: ShellState, receipt: string): void {
  s.devReceipts++;
  if (s.build.receiptsOnScreen && !s.promoHudHidden) DisplayTextToPlayer(GetLocalPlayer(), 0.0, 0.0, receipt);
  const file = devReceiptFile(journalIdentity(s, s.rollback?.epoch ?? 0), s.devReceipts, s.devStep, s.devSteps, s.dev, s.game, s.sessionWins.counts);
  writeLines(file.name, file.lines);
}
