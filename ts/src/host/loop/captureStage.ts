import { PARTICIPANT_SLOTS, type ParticipantSlot } from "../../game/input/participants";
import { Phase } from "../../game/lobby/lobbyState";
import { fighterSlug } from "../../game/roster/kits";
import { isActive } from "../../game/sim/roster";
import type { CaptureRequest } from "../../game/session/devSettings";
import { advanceCaptureStage, captureMove, captureStaged, createCaptureLane } from "../../platform/captureStage";
import { createFighterBody, placeFighterBody, removeFighterBody } from "./fighterBody";
import { hideFighter } from "./fighterCloak";
import type { ShellState } from "./state";
import { renderPersistentPresentation } from "./view";
import { player } from "wisp/game/players";

function removeLane(s: ShellState, slot: ParticipantSlot): void {
  const staged = s.captureBodies[slot];
  if (staged !== undefined) removeFighterBody(staged.body);
  s.captureBodies[slot] = undefined;
  s.capture.lanes[slot] = undefined;
}

export function clearCaptureStage(s: ShellState): void {
  if (!captureStaged(s.capture)) return;
  for (const slot of PARTICIPANT_SLOTS) removeLane(s, slot);
  for (const slot of PARTICIPANT_SLOTS) if (isActive(s.world, slot)) hideFighter(s, slot, false);
  s.promoHudHidden = false;
  renderPersistentPresentation(s);
}

export function applyCaptureCommand(s: ShellState, request: CaptureRequest): string | undefined {
  if (s.game.phase !== Phase.match) return undefined;
  if (request.kind === "clear") {
    clearCaptureStage(s);
    return "dev: capture clear";
  }
  const move = captureMove(request.move);
  const lane = move === undefined ? undefined : createCaptureLane(request.character, move, request.facing === "right" ? 1 : -1, request.slot, s.game.stageChoice);
  if (lane === undefined) return undefined;
  removeLane(s, request.slot);
  s.capture.lanes[request.slot] = lane;
  s.captureBodies[request.slot] = { body: createFighterBody(player(request.slot), lane.fighter, s.origin), loop: -1 };
  for (const slot of PARTICIPANT_SLOTS) if (isActive(s.world, slot)) hideFighter(s, slot, true);
  s.promoHudHidden = true;
  return `dev: capture ${fighterSlug(request.character)} ${request.move} ${request.facing} ${request.slot}`;
}

export function renderCaptureStage(s: ShellState): void {
  if (!captureStaged(s.capture)) return;
  if (s.game.phase !== Phase.match) {
    clearCaptureStage(s);
    return;
  }
  advanceCaptureStage(s.capture);
  for (const slot of PARTICIPANT_SLOTS) {
    const lane = s.capture.lanes[slot];
    const staged = s.captureBodies[slot];
    if (lane === undefined || staged === undefined) continue;
    const { body } = staged;
    const { pose } = lane;
    if (staged.loop !== lane.loops || body.renderedSelection !== pose.selectionSerial) {
      if (pose.clipIndex !== undefined) SetUnitAnimationByIndex(body.unit, pose.clipIndex);
      else SetUnitAnimation(body.unit, pose.clipName);
      body.renderedSelection = pose.selectionSerial;
      staged.loop = lane.loops;
    }
    SetUnitTimeScale(body.unit, pose.rate);
    placeFighterBody(body, lane.fighter, s.origin, s.game.stageChoice);
  }
}
