import { DEFAULT_FIGHTER } from "../../game/roster/kits";
import { announcePlaying } from "./nativePlaying";
import { partnerOwner } from "../../game/sim/duoOwner";
import { shieldEnergyReady, shieldEnergyReceipt } from "../../game/session/shieldEnergyCapture";
import { writeLines } from "wisp/src/platform/fileio";
import { computerActive } from "../../game/lobby/lobbyState";

import { itemBodyTint } from "../../game/presentation/itemLook";
import { MATCH_HELP_BOX, MATCH_NOTICE_BOX } from "../../game/ui/hudLayout";
import { CryDecision, createCryGate, cryStandIn, gateCry } from "../../game/presentation/hurtVoice";
import { deckModel, slabScale } from "../../game/presentation/stagePreload";
import { type PlatformPart, platformParts } from "../../game/presentation/stockPlatforms";
import { stageEdgeLight, STAGE_EDGE_LIGHT_MODEL } from "../../game/presentation/stageEdgeLights";
import { f32 } from "wisp/src/sim/f32";
import { Character, SpecialAction } from "../../game/sim/codes";
import { at } from "wisp/src/runtime/lookup";
import { PARTICIPANT_SLOTS, type ParticipantSlot, type Slots } from "../../game/input/participants";
import { SHOWCASE_PAD_X } from "../../game/session/showcase";
import type { FighterAgency } from "../../game/presentation/fighterAgency";
import type { FrameControls } from "../../game/match/controls";
import { type MatchState, Phase, costumeFor, costumeTintFor, fighterColor, humanActive, stageClock } from "../../game/lobby/lobbyState";
import type { PacingAndPresentation } from "../../game/match/pacingAndPresentation";
import { fighterOffscreen, fitFighterFrames } from "../../game/presentation/fighterFraming";
import { arenaFarZ, ARENA_CAMERA, FLOOR_HEIGHT, cameraFieldOfView, type ScreenPoint, cameraPoint, extremeCamera, finalCamera, localCamera, resultCamera } from "../../game/presentation/arenaCamera";

import { beginPauseCamera, advancePauseCamera, pauseCameraAngle, pauseHudHidden } from "./pauseCamera";
import { type MatchCamera, copyMatchCamera } from "../../game/sim/matchCamera";
import { applyHeldCamera } from "./heldCamera";
import { aimArenaCamera } from "./arenaShot";

import { advanceMatchCamera } from "../../game/sim/matchCamera";
import { stageBounds } from "../../game/sim/stageBounds";
import { damageTint } from "../../game/presentation/hitPresentation";
import { roaring } from "../../game/presentation/terrorCues";
import { shakeRoarCamera } from "./roarCamera";
import { DamagePose, damagePose } from "../../game/presentation/damagePose";
import { FIGHTER_PHASE_ALPHA, hideEffect } from "../../game/render/effects";
import { createLavaRims, destroyLavaRims } from "./lavaRims";
import type { FighterPose } from "../../game/presentation/fighterPose";
import { FRAME_SECONDS } from "../../game/presentation/frameClock";
import { shellChatBox } from "./matchChat";
import { hideWarcraftChat } from "../../game/ui/warcraftChat";
import { CANNON_MODEL, CANNON_MODEL_BASE, HYDRA_CREST_MODEL, HYDRA_RING_MODEL, WIND_STREAK_COUNT, WIND_STREAK_MODEL, lavaLook, windStreak } from "../../game/presentation/stageHazards";
import { escapeMeterView, readEscapeMeter } from "../../game/presentation/escapeMeter";
import { presentFighterMarkers } from "./fighterMarkers";
import { drawnScale, lavaPiece } from "../../game/presentation/stageScenery";
import { hasLava, lavaSide } from "../../game/sim/lava";
import type { Fighter } from "../../game/sim/fighter";
import { type StartControl, matchHelp, matchStartNotice, resultNotice, waitingMessage } from "../../game/session/messages";
import { isIntangible } from "../../game/sim/conditions";
import { type Roster, fighterAt, isActive } from "../../game/sim/roster";
import { surfaceCount, surfaceLeft, surfaceRight, surfaceZ } from "../../game/sim/stage";
import { CANNON_Z, cannonOn, cannonX, hasTide, hasWind, inCannonBarrel } from "../../game/sim/stageHazards";
import { localParticipantSlot, traceParticipant } from "./diagnostics";
import { colorFighterBody, paintFighterBody, placeFighterBody, renderDizzy } from "./fighterBody";
import { concealFighter, concealFighters } from "./fighterCloak";
import { localDevice, localPreview } from "./keyboardPreview";
import { type ShellState, type StatusFrames, activeRollback, localSlot } from "./state";
import { presentedMatch } from "./presentedMatch";
import { EMPTY_PAUSE_VIEW, pauseScreenUp, pauseView } from "./pauseView";
import { type UiObjects, pauseEffects, views } from "./ui";
import { followFormChange } from "./formChange";
import { drawStageScenery, presentDrifters } from "./stageScenery";
import { probeCamera } from "./responseProbe";
import { clockSeconds } from "./trace";
import { frameCaptureStage } from "../../platform/captureStage";
import { markLoreClear, presentMatchPanels, presentMessages, updateSlotHud } from "./viewHud";
import { presentHydra, presentSlot, presentStageMotion } from "./viewPresentation";
import { createEffect, destroyEffect, Effect, EffectAnimation, playEffectAnimation, setEffectAlpha, setEffectColor, setEffectMatrixScale, setEffectPosition, setEffectScale, setEffectYaw } from "wisp/game/effects";
import { clearTextMessages, createFrameByType, Frame, FramePoint, originFrame, OriginFrame, screenHeight, screenWidth, setFrameAbsPoint, setFrameFont, setFrameSize, setFrameTextAlignment, TextAlignment } from "wisp/game/frames";
import { CameraField, panCameraTo, setCameraBounds, setCameraField, setCameraPosition } from "wisp/game/view";
import { setBodyAnimation, setBodyAnimationIndex, setBodyTimeScale, showBody } from "wisp/game/bodies";
import { formatReal, toReal } from "wisp/game/text";
import { fighterModelReplaced } from "../../game/presentation/fighterForm";

declare const os: { readonly clock?: (this: void) => number } | undefined;


const RESUME_PRESENTATION_SECONDS = f32(1.0 / 30.0);

export function resumePresentationHeld(s: Readonly<ShellState>): boolean {
  return s.resumePresentationUntil !== undefined;
}


export function serviceResumePresentation(s: ShellState): void {
  if (s.resumePresentationUntil === undefined) return;
  if (s.game.phase === Phase.match && typeof os === "object" && typeof os.clock === "function" && os.clock() < s.resumePresentationUntil) return;
  s.resumePresentationUntil = undefined;
  setMatchPresentationPaused(s, s.session.paused);
}


export const LASTING = 3600.0;

export function setStatus(s: ShellState, text: string, seconds: number): void {
  s.status.text = text;
  s.status.seconds = seconds;
}


export function announce(s: ShellState, text: string): void {
  setStatus(s, text, 2.0);
}


function createStatusText(name: string, x: number, y: number, width: number, height: number, size: number): Frame {
  const frame = createFrameByType("TEXT", name, originFrame(OriginFrame.gameUi, 0), "", 0);
  setFrameAbsPoint(frame, FramePoint.topLeft, x, y);
  setFrameSize(frame, width, height);
  setFrameFont(frame, "Fonts\\FRIZQT__.TTF", size, 0);
  setFrameTextAlignment(frame, TextAlignment.top, TextAlignment.left);
  return frame;
}

export function createStatusFrames(): StatusFrames {
  return {
    help: createStatusText("MeleeHelp", MATCH_HELP_BOX.left, MATCH_HELP_BOX.top, MATCH_HELP_BOX.width, MATCH_HELP_BOX.height, f32(0.01)),
    notice: createStatusText("MeleeNotice", MATCH_NOTICE_BOX.left, MATCH_NOTICE_BOX.top, MATCH_NOTICE_BOX.width, MATCH_NOTICE_BOX.height, f32(0.019)),
  };
}

function clearStageDecks(s: ShellState): void {
  for (const effect of s.stageHydra ?? []) {
    hideEffect(effect, s.origin);
    destroyEffect(effect);
  }
  s.stageHydra = [];
  for (const effect of s.stageWind) {
    hideEffect(effect, s.origin);
    destroyEffect(effect);
  }
  s.stageWind.length = 0;
  if (s.stageCannon !== undefined) {
    hideEffect(s.stageCannon, s.origin);
    destroyEffect(s.stageCannon);
    s.stageCannon = undefined;
  }
  destroyLavaRims(s);
  if (s.stageLava !== undefined) {
    hideEffect(s.stageLava, s.origin);
    destroyEffect(s.stageLava);
    s.stageLava = undefined;
  }
  for (const deck of s.stageDecks) {
    hideEffect(deck, s.origin);
    destroyEffect(deck);
  }
  s.stageDecks.length = 0;
  for (const part of s.stageDeckParts) {
    hideEffect(part, s.origin);
    destroyEffect(part);
  }
  s.stageDeckParts.length = 0;
}

function placePart(deck: Effect, part: Readonly<PlatformPart>, x: number, y: number, z: number): void {
  setEffectPosition(deck, x + part.x, y + part.y, z + part.z);
  // Native yaw discards an earlier matrix scale (0.0.103 drew Frozen Throne's floes unsquashed), so the scale goes last.
  setEffectYaw(deck, part.yaw * (Math.PI / 180.0));
  setEffectMatrixScale(deck, part.scale[0], part.scale[1], part.scale[2]);
  setEffectColor(deck, part.color[0], part.color[1], part.color[2]);
}


export function drawStage(s: ShellState): void {
  clearStageDecks(s);
  drawStageScenery(s);
  const { origin } = s;
  const stage = s.game.stageChoice;
  const stageFrame = stageClock(s.game);
  for (let index = 0; index < surfaceCount(stage); index++) {
    const left = surfaceLeft(stage, index, stageFrame);
    const right = surfaceRight(stage, index, stageFrame);
    const x = origin.x + (left + right) / 2;
    const deck = createEffect(deckModel(stage, index), x, origin.y);
    const z = origin.z + surfaceZ(stage, index, stageFrame);
    setEffectPosition(deck, x, origin.y, z);
    const parts = platformParts(stage, index);
    if (parts.length > 0) {

      for (const [order, part] of parts.entries()) {
        const effect = order === 0 ? deck : createEffect(part.model, x, origin.y);
        placePart(effect, part, x, origin.y, z);
        if (order > 0) s.stageDeckParts.push(effect);
      }
      s.stageDecks.push(deck);
      continue;
    }
    const scale = slabScale(stage, index, right - left);
    if (scale !== undefined) setEffectMatrixScale(deck, scale[0], scale[1], scale[2]);
    s.stageDecks.push(deck);
  }
  if (cannonOn(stage, stageFrame)) {
    s.stageCannon = createEffect(CANNON_MODEL, origin.x + cannonX(stageFrame), origin.y);
    setEffectPosition(s.stageCannon, origin.x + cannonX(stageFrame), origin.y, origin.z + CANNON_Z - CANNON_MODEL_BASE);
    setEffectScale(s.stageCannon, 1.5);
  }
  for (let index = 0; index < 6; index++) {
    const light = stageEdgeLight(stage, index, stageFrame);
    if (light === undefined) break;
    const effect = createEffect(STAGE_EDGE_LIGHT_MODEL, origin.x + light.x, origin.y + light.y);
    setEffectPosition(effect, origin.x + light.x, origin.y + light.y, origin.z + light.z);
    setEffectScale(effect, 0.75);
    setEffectColor(effect, 96, 255, 64);
    playEffectAnimation(effect, EffectAnimation.stand);
    s.stageDeckParts.push(effect);
  }
  if (hasLava(stage)) {
    createLavaRims(s);
    const piece = lavaPiece(lavaSide(stageFrame));
    s.stageLava = createEffect(piece.model, origin.x + piece.x, origin.y + piece.y);
    setEffectPosition(s.stageLava, origin.x + piece.x, origin.y + piece.y, origin.z + piece.z);
    const drawn = drawnScale(piece);
    setEffectScale(s.stageLava, drawn.scale);
    if (drawn.matrixScale !== undefined) setEffectMatrixScale(s.stageLava, drawn.matrixScale[0], drawn.matrixScale[1], drawn.matrixScale[2]);
    playEffectAnimation(s.stageLava, EffectAnimation.stand);
    presentLava(s, stage, stageFrame);
  }
  s.drawnStage = stage;
  if (hasTide(stage)) {
    for (const _slot of PARTICIPANT_SLOTS) {
      for (const model of [HYDRA_RING_MODEL, HYDRA_CREST_MODEL]) {
        const effect = createEffect(model, origin.x, origin.y);
        hideEffect(effect, origin);
        s.stageHydra?.push(effect);
      }
    }
  }
  if (hasWind(stage)) {
    for (let index = 0; index < WIND_STREAK_COUNT; index++) {
      const effect = createEffect(WIND_STREAK_MODEL, origin.x, origin.y);
      hideEffect(effect, origin);
      s.stageWind.push(effect);
    }
  }
  presentWind(s, stage, stageFrame);
}

function presentWind(s: ShellState, stage: number, frame: number): void {
  for (const [index, effect] of s.stageWind.entries()) {
    const streak = windStreak(stage, frame, index);
    if (streak === undefined) {
      hideEffect(effect, s.origin);
      continue;
    }
    setEffectScale(effect, 2.0);
    setEffectPosition(effect, s.origin.x + streak.x, s.origin.y, s.origin.z + streak.z);
    setEffectYaw(effect, streak.direction > 0 ? 0.0 : Math.PI);
  }
}


function presentLava(s: ShellState, stage: number, frame: number): void {
  const lava = s.stageLava;
  if (lava === undefined || !hasLava(stage)) return;
  const piece = lavaPiece(lavaSide(frame));
  setEffectPosition(lava, s.origin.x + piece.x, s.origin.y + piece.y, s.origin.z + piece.z);
  const look = lavaLook(stage, frame);
  setEffectAlpha(lava, look.alpha);
  setEffectColor(lava, look.red, look.green, look.blue);
}


export function renderFighter(s: ShellState, slot: ParticipantSlot, pose: Readonly<FighterPose>, wasOut: boolean): void {
  if (resumePresentationHeld(s)) return;
  const participant = s.participants[slot];
  const { body } = participant;
  if (body === undefined || !isActive(s.world, slot)) return;
  const fighter = fighterAt(s.world, slot);
  renderDizzy(body, fighter, s.game.phase === Phase.match, s.origin);
  colorFighterBody(body, slot, fighterColor(s.game, slot));
  const hidden = s.hiddenFighters[slot];
  const cloaked = hidden?.body === true;
  if (!cloaked && wasOut && !fighter.status.out) showBody(body.unit, true);
  else if (!cloaked && !wasOut && fighter.status.out) {
    showBody(body.unit, false);
  }
  const { pooled } = participant;
  const unitShown = !pooled && !fighter.status.out && !inCannonBarrel(fighter) && !fighterModelReplaced(fighter);
  if (hidden !== undefined && cloaked) hidden.unitShown = unitShown;
  else showBody(body.unit, unitShown);
  if (body.renderedSelection !== pose.selectionSerial) {
    if (!pooled) {

      const cry = gateCry(body.cry ??= createCryGate(), s.runtime.simulationFrame, fighter, pose.clipIndex, pose.clipName);
      const standIn = cry === CryDecision.standIn ? cryStandIn(fighter.character) : undefined;
      if (standIn !== undefined) setBodyAnimationIndex(body.unit, standIn);
      else if (cry === CryDecision.keep) {

      } else if (pose.clipIndex !== undefined) setBodyAnimationIndex(body.unit, pose.clipIndex);
      else setBodyAnimation(body.unit, pose.clipName);
    }
    body.renderedSelection = pose.selectionSerial;
    const reaction = damagePose(fighter);
    if (reaction !== DamagePose.none) {
      const { launch, motion } = fighter;
      traceParticipant(s, slot, `damage pose ${reaction} hitlag ${launch.hitlag} hitstun ${launch.hitstun} x ${formatReal(motion.x)} z ${formatReal(motion.z)} launch ${formatReal(launch.knockbackX)}:${formatReal(launch.knockbackZ)}`);
    }
  }
  if (!pooled) setBodyTimeScale(body.unit, pose.rate);
  if (fighter.status.out) return;
  placeFighterBody(body, fighter, s.origin, s.game.stageChoice);
  const tint = damageTint(fighter);
  const frozen = fighter.status.frozenFrames > 0;
  const item = fighter.shield.raised ? undefined : itemBodyTint(fighter);
  const red = frozen ? 155 : tint?.red ?? (fighter.shield.raised ? 100 : item?.red ?? 255);
  const green = frozen ? 210 : tint?.green ?? (fighter.shield.raised ? 160 : item?.green ?? 255);
  const blue = frozen ? 255 : tint?.blue ?? item?.blue ?? 255;
  const alpha = !frozen && tint === undefined && isIntangible(fighter) ? FIGHTER_PHASE_ALPHA : 255;
  paintFighterBody(body, red, green, blue, alpha, costumeTintFor(s.game, slot, fighter.character));
  concealFighter(s, slot);
}


export function pauseMatchPresentation(s: ShellState, paused: boolean, immediately = false): void {
  s.resumePresentationUntil = undefined;
  s.pauseChord = undefined;
  if (!paused) s.pausedBy = undefined;
  if (paused && s.game.phase === Phase.match) {
    const height = screenHeight();
    beginPauseCamera(s, height > 0 ? toReal(screenWidth()) / toReal(height) : 16.0 / 9.0);
  } else if (s.pauseCamera !== undefined) {
    const saved = s.pauseCamera;
    copyMatchCamera(s.camera, saved.saved);
    s.pauseCamera = undefined;
    applyArenaCamera(s, s.camera, saved.aspect, ARENA_CAMERA.angleOfAttack, 0.0);
    renderUi(s);
  }
  if (!paused && !immediately && s.build.inputProfile !== "native-driver" && s.game.phase === Phase.match && typeof os === "object" && typeof os.clock === "function") {
    s.resumePresentationUntil = os.clock() + RESUME_PRESENTATION_SECONDS;
    return;
  }
  setMatchPresentationPaused(s, paused);
}

function setMatchPresentationPaused(s: ShellState, paused: boolean): void {
  for (const slot of PARTICIPANT_SLOTS) {
    const { body } = s.participants[slot];
    if (body === undefined || !isActive(s.world, slot)) continue;
    if (paused) setBodyTimeScale(body.unit, 0.0);
    else if (!fighterAt(s.world, slot).status.out) renderFighter(s, slot, s.runtime.poses[slot], false);
  }
  pauseEffects(s, paused);
}

const agencyMarks: Slots<FighterAgency> = ["act", "act", "act", "act"];
const forecastHits: Slots<number> = [-1, -1, -1, -1];
const FORECAST_STEPS_PER_CALLBACK = 8;
// A callback that re-simulated frames already spent its budget; spread the forecast over later callbacks (#168).
const FORECAST_STEPS_AFTER_REPAIR = 1;







function pendingMark(world: Readonly<Roster>, slot: number): FighterAgency {
  const { launch } = fighterAt(world, slot);
  return launch.hitlag > 0 && launch.diPending ? "di" : "none";
}

function markAgency(ui: UiObjects, world: Readonly<Roster>, stage: number, matchFrame: number, controls: Readonly<FrameControls>, repaired: boolean): void {
  let stalest = -1;
  let stalestAge = -1;
  let budget = repaired ? FORECAST_STEPS_AFTER_REPAIR : FORECAST_STEPS_PER_CALLBACK;
  for (const slot of PARTICIPANT_SLOTS) {
    const forecast = ui.fighters[slot]?.agency.forecast;
    if (forecast === undefined || !isActive(world, slot)) continue;
    const immediate = forecast.immediate(world, slot, stage, matchFrame, budget);
    budget -= forecast.throwStepsSpent();
    if (immediate !== undefined) {
      forecast.cancel();
      agencyMarks[slot] = immediate;
      continue;
    }
    if (forecast.pendingFor(world, slot)) continue;
    const age = forecast.reuseAge(world, slot, matchFrame);
    if (age === undefined) {
      forecast.begin(world, slot, stage, matchFrame, controls.commands[slot].graceFrames);
      const hit = fighterAt(world, slot).visuals.hit;
      if (forecastHits[slot] !== hit) agencyMarks[slot] = pendingMark(world, slot);
      forecastHits[slot] = hit;
    } else {
      forecast.cancel();
      agencyMarks[slot] = forecast.reused(world, slot);
      if (age > stalestAge) {
        stalest = slot;
        stalestAge = age;
      }
    }
  }
  for (const slot of PARTICIPANT_SLOTS) {
    const forecast = ui.fighters[slot]?.agency.forecast;
    if (forecast === undefined || !isActive(world, slot) || forecast.finished()) continue;
    budget -= forecast.advance(budget);
    if (forecast.finished()) agencyMarks[slot] = forecast.result();
  }
  const forecast = stalest < 0 || budget <= 0 ? undefined : at(ui.fighters, stalest)?.agency.forecast;
  if (forecast === undefined || stalestAge <= 0) return;
  forecast.begin(world, stalest, stage, matchFrame, at(controls.commands, stalest).graceFrames);
  forecast.advance(budget);
  if (forecast.finished()) agencyMarks[stalest] = forecast.result();
}


export function renderPersistentPresentation(s: ShellState): void {
  if (resumePresentationHeld(s)) return;
  const now = clockSeconds(s.trace);
  for (const slot of PARTICIPANT_SLOTS) {
    views(s).fighters[slot]?.cues?.confirm(isActive(s.world, slot) ? fighterAt(s.world, slot) : undefined, s.game.phase === Phase.match, now);
  }
  const { game, world, runtime, playing } = presentedMatch(s);
  const stage = game.stageChoice;
  const matchFrame = stageClock(game);

  const drawn = s.drawnStage;
  presentStageMotion(s, drawn, matchFrame, world);
  presentLava(s, drawn, matchFrame);
  presentWind(s, drawn, matchFrame);
  presentDrifters(s);
  presentHydra(s, drawn, world, game, playing);
  const ui = views(s);
  if (playing) markAgency(ui, world, stage, matchFrame, s.controls, (activeRollback(s)?.repairedFrames ?? 0) > 0);
  ui.classic?.present(game);
  ui.combat.present(runtime.impacts, runtime.simulationFrame, s.runtime.impacts, playing, s.camera);
  const roared = roaring(world, playing);
  for (const slot of PARTICIPANT_SLOTS) {
    followFormChange(s, ui, slot, world);
    presentSlot(s, ui, slot, game, world, runtime, playing, drawn, matchFrame, roared, agencyMarks[slot]);
  }
  presentShieldEnergyCapture(s, game, world, runtime, playing);
  concealFighters(s);
}

function presentShieldEnergyCapture(s: ShellState, game: MatchState, world: Readonly<Roster>, runtime: PacingAndPresentation, playing: boolean): void {
  const capture = s.dev.shieldEnergyCapture;
  if (capture?.pending && playing) {
    const partner = PARTICIPANT_SLOTS.find(slot => computerActive(game, slot) && isActive(world, slot));
    const fighter = partner === undefined ? undefined : fighterAt(world, partner);
    if (fighter !== undefined && shieldEnergyReady(capture.sample, fighter, runtime.simulationFrame)) {
      capture.pending = false;
      s.session.paused = true;
      pauseMatchPresentation(s, true);
      capture.lines.push(shieldEnergyReceipt(capture.sample, fighter, runtime.simulationFrame));
      writeLines(`smashcraft-dev-shield-energy-p${localSlot()}.txt`, capture.lines);
    }
  }
}


const meter = escapeMeterView();

function applyArenaCamera(s: ShellState, framing: Readonly<MatchCamera>, aspect: number, angle: number, duration: number): void {
  const { x: centerX, y: centerY } = s.origin;
  const targetX = centerX + framing.x;
  if (duration > 0.0) {

    const bounds = stageBounds(s.game.stageChoice).camera;
    const left = centerX + bounds.left;
    const right = centerX + bounds.right;
    setCameraBounds(left, centerY, right, centerY, left, centerY, right, centerY);
  } else setCameraBounds(targetX, centerY, targetX, centerY, targetX, centerY, targetX, centerY);
  setCameraField(CameraField.rotation, ARENA_CAMERA.rotation, 0.0);
  setCameraField(CameraField.angleOfAttack, angle, 0.0);
  setCameraField(CameraField.targetDistance, framing.distance, duration);
  setCameraField(CameraField.zOffset, FLOOR_HEIGHT + framing.z, duration);
  setCameraField(CameraField.roll, 0.0, 0.0);
  setCameraField(CameraField.fieldOfView, cameraFieldOfView(framing, aspect), duration);
  setCameraField(CameraField.farZ, arenaFarZ(s.game.stageChoice, framing), 0.0);
  if (duration > 0.0) panCameraTo(targetX, centerY, duration);
  else setCameraPosition(targetX, centerY);
}


export function lockArenaCamera(s: ShellState): void {
  if (resumePresentationHeld(s)) return;
  const { world, game } = presentedMatch(s);

  if (game.phase !== Phase.result && !game.camera.initialized) advanceMatchCamera(s.previewCamera, world, game.stageChoice);
  const height = screenHeight();
  const aspect = height > 0 ? toReal(screenWidth()) / toReal(height) : 16.0 / 9.0;
  const angle = aimArenaCamera(s, aspect);
  if (game.phase !== Phase.result && s.viewExtreme !== undefined) extremeCamera(s.camera, game.stageChoice, aspect, s.viewExtreme);
  if (s.viewExtreme !== undefined) clearTextMessages();
  if (game.phase !== Phase.result && s.showcaseFocus !== undefined) s.camera.x = SHOWCASE_PAD_X[s.showcaseFocus];
  if (game.phase !== Phase.result && s.showcaseFocus === undefined && (!s.session.paused || s.pauseCamera === undefined)) fitFighterFrames(s.camera, world, game.stageChoice, aspect);
  applyHeldCamera(s);
  frameCaptureStage(s.capture, s.camera, game.phase === Phase.match, game.stageChoice, aspect);
  const { x: centerX, y: centerY } = s.origin;
  const framing = s.camera;
  if (game.phase === Phase.match && game.run.active && game.run.boss.kind !== 0 && !s.session.paused) {

    framing.x = 0.0;
    framing.z = 160.0;
    framing.distance = 1450.0;
    framing.tangent = 0.2679491937160492;
  }
  finalCamera(framing, game.stageChoice);
  probeCamera(s.probe, game.camera, framing, centerX, FLOOR_HEIGHT);
  const duration = s.cameraTween === true && game.phase === Phase.match && !s.session.paused ? FRAME_SECONDS : 0.0;
  applyArenaCamera(s, framing, aspect, angle, duration);
  shakeRoarCamera(world, game.phase, s.session.paused, FLOOR_HEIGHT + framing.z);
  if (s.build.analogPadDiagnostic === true) {

    setCameraBounds(centerX, centerY, centerX, centerY, centerX, centerY, centerX, centerY);
    setCameraField(CameraField.angleOfAttack, 270.0, 0.0);
    setCameraField(CameraField.targetDistance, 3200.0, 0.0);
    setCameraField(CameraField.zOffset, 0.0, 0.0);
    setCameraField(CameraField.fieldOfView, 70.0, 0.0);
    setCameraPosition(centerX, centerY);
  }
  views(s).items.present(game, world);
  views(s).auras.present(game.phase === Phase.match, world);
  views(s).orbs.present(game, game.stageChoice, game.phase === Phase.match);
  for (const slot of PARTICIPANT_SLOTS) {
    const fighter = isActive(world, slot) ? fighterAt(world, slot) : undefined;
    const point = cameraPoint(framing, aspect, fighter?.motion.x ?? 0.0, (fighter?.motion.z ?? 0.0) + 60.0, BUBBLE_POINT);
    const outside = fighter !== undefined && fighterOffscreen(framing, aspect, fighter.character, fighter.motion.x, fighter.motion.z);
    const owner = partnerOwner(fighter, slot);
    views(s).bubbles[slot].update(!pauseHudHidden(s) && game.phase === Phase.match && fighter !== undefined && !fighter.status.out && outside, fighter?.character ?? DEFAULT_FIGHTER, fighterColor(game, owner), point.column, point.row, aspect, costumeTintFor(game, owner, fighter?.character), costumeFor(game, owner), owner !== slot);
    readEscapeMeter(world, slot, meter);
    if (game.phase !== Phase.match || pauseHudHidden(s)) meter.shown = false;
    const meterPoint = cameraPoint(framing, aspect, meter.x, meter.z, METER_POINT);
    views(s).escapeMeters[slot].update(meter, meterPoint.column, meterPoint.row, aspect);
    ESCAPING[slot] = meter.shown;
  }
  presentFighterMarkers(s, framing, aspect, ESCAPING);
}

const ESCAPING = [false, false, false, false];


const BUBBLE_POINT: ScreenPoint = { column: 0.0, row: 0.0 };
const METER_POINT: ScreenPoint = { column: 0.0, row: 0.0 };

export function renderUi(s: ShellState): void {
  announcePlaying(s);
  if (resumePresentationHeld(s)) return;
  const { game } = s;
  const ui = views(s);
  const selecting = game.phase === Phase.characterMenu || game.phase === Phase.stageMenu;
  const menu = s.pauseMenu ??= { shown: false, title: false };
  const paused = game.phase === Phase.match && pauseScreenUp(s);
  menu.shown = paused;
  const local = localParticipantSlot(s);
  const localKeys = s.participants[local ?? 0].bindings.bindings;
  ui.pause.update(menu.title);
  const screenShown = paused && s.dev.shieldEnergyCapture?.pending !== false;
  ui.pauseScreen.update(screenShown, screenShown ? pauseView(s, localKeys) : EMPTY_PAUSE_VIEW);
  const localFighter = local !== undefined && s.participants[local].body !== undefined && isActive(s.world, local) ? fighterAt(s.world, local) : undefined;
  const showMatch = !paused && !pauseHudHidden(s) && !selecting && !(local !== undefined && ui.settings[local].isOpen());
  for (const slot of PARTICIPANT_SLOTS) updateSlotHud(s, ui, slot, game, selecting, paused, menu.title, showMatch);
  presentMatchPanels(s, game, ui, showMatch, local, localKeys);
  markLoreClear(game);
  presentMessages(s, game, ui, showMatch, paused, selecting, local, localFighter);
  ui.stage.update(game);
  hideWarcraftChat();
  ui.chat.update(FRAME_SECONDS, shellChatBox(s));
}
