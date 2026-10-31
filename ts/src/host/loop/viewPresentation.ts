import { presentDrawnBody } from "./fighterDrawView";
import { type MatchState, Phase } from "../../game/lobby/lobbyState";
import type { PacingAndPresentation } from "../../game/match/pacingAndPresentation";
import { PARTICIPANT_SLOTS, type ParticipantSlot } from "../../game/input/participants";
import type { FighterAgency } from "../../game/presentation/fighterAgency";
import type { Fighter } from "../../game/sim/fighter";
import { type Roster, fighterAt, isActive } from "../../game/sim/roster";
import { hideEffect } from "../../game/render/effects";
import { stageEdgeLight } from "../../game/presentation/stageEdgeLights";
import { PLATFORM_CUE_FRAMES, CANNON_MODEL_BASE, cannonWarned, framesUntilPlatformMoves, hydraStrikeZ, hydraWarningX } from "../../game/presentation/stageHazards";
import { CANNON_Z, SEA_SURFACE_Z, cannonOn, cannonRock, cannonX } from "../../game/sim/stageHazards";
import { surfaceLeft, surfaceMoves, surfaceRight, surfaceZ } from "../../game/sim/stage";
import { at } from "wisp/src/runtime/lookup";
import { presentedCueTrace } from "./diagnostics";
import type { UiObjects } from "./ui";
import type { ShellState } from "./state";
import { setEffectColor, setEffectPitch, setEffectPosition, setEffectScale, setEffectTimeScale, setEffectYaw } from "wisp/game/effects";

export function presentStageMotion(s: ShellState, drawn: number, matchFrame: number, world: Readonly<Roster>): void {
  const beforePlatform = framesUntilPlatformMoves(drawn, matchFrame);
  for (let index = 0; index < s.stageDeckParts.length; index++) {
    const light = stageEdgeLight(drawn, index, matchFrame);
    if (light === undefined) break;
    setEffectPosition(at(s.stageDeckParts, index), s.origin.x + light.x, s.origin.y + light.y, s.origin.z + light.z);
  }
  for (let index = 1; index < s.stageDecks.length; index++) {
    if (!surfaceMoves(drawn, index)) continue;
    const x = s.origin.x + (surfaceLeft(drawn, index, matchFrame) + surfaceRight(drawn, index, matchFrame)) / 2;
    setEffectPosition(at(s.stageDecks, index), x, s.origin.y, s.origin.z + surfaceZ(drawn, index, matchFrame));
    const warns = beforePlatform !== undefined && beforePlatform <= PLATFORM_CUE_FRAMES;
    setEffectColor(at(s.stageDecks, index), 255, warns ? 170 : 255, warns ? 40 : 255);
  }
  if (s.stageCannon !== undefined && cannonOn(drawn, matchFrame)) {
    setEffectPosition(s.stageCannon, s.origin.x + cannonX(matchFrame), s.origin.y, s.origin.z + CANNON_Z - CANNON_MODEL_BASE);
    setEffectPitch(s.stageCannon, cannonRock(matchFrame));
    const warned = cannonWarned(world);
    setEffectColor(s.stageCannon, 255, warned ? 70 : 255, warned ? 40 : 255);
  }
}

export function presentHydra(s: ShellState, drawn: number, world: Readonly<Roster>, game: MatchState, playing: boolean): void {
  for (const slot of PARTICIPANT_SLOTS) {
    const ring = s.stageHydra?.[slot * 2];
    const crest = s.stageHydra?.[slot * 2 + 1];
    if (ring === undefined || crest === undefined) continue;
    const water = playing && isActive(world, slot) ? fighterAt(world, slot).water : undefined;
    const strikeZ = water === undefined ? undefined : hydraStrikeZ(drawn, water, game.matchFrame);
    const x = water === undefined ? undefined : strikeZ === undefined ? hydraWarningX(drawn, water) : water.hydraX;
    if (x === undefined) {
      hideEffect(ring, s.origin);
      hideEffect(crest, s.origin);
      continue;
    }
    setEffectScale(ring, strikeZ === undefined ? 0.75 : 1.0);
    setEffectColor(ring, 48, 72, 64);
    setEffectPosition(ring, s.origin.x + x, s.origin.y, s.origin.z + SEA_SURFACE_Z + 8.0);
    setEffectScale(crest, strikeZ === undefined ? 0.75 : 1.0);
    setEffectYaw(crest, Math.PI / 2.0);
    setEffectPosition(crest, s.origin.x + x, s.origin.y + 40.0, s.origin.z + (strikeZ ?? SEA_SURFACE_Z - 60.0));
    setEffectTimeScale(crest, 0.0);
  }
}

export function presentSlot(s: ShellState, ui: UiObjects, slot: ParticipantSlot, game: MatchState, world: Readonly<Roster>, runtime: PacingAndPresentation, playing: boolean, drawn: number, matchFrame: number, roared: boolean, mark: FighterAgency): void {
  const fighter = isActive(world, slot) ? fighterAt(world, slot) : undefined;
  const live = playing ? fighter : undefined;
  presentSlotBody(s, ui, slot, game, fighter, live, runtime, drawn, matchFrame, roared, mark);
  ui.special.presentStatic(runtime.specials, live, slot);
  ui.special.presentSummons(runtime.summons, live, slot);
  presentSlotLayers(ui, slot, live);
  presentSlotOverlays(s, ui, slot, fighter, live, playing, runtime);
}

function presentSlotBody(s: ShellState, ui: UiObjects, slot: ParticipantSlot, game: MatchState, fighter: Readonly<Fighter> | undefined, live: Readonly<Fighter> | undefined, runtime: PacingAndPresentation, drawn: number, matchFrame: number, roared: boolean, mark: FighterAgency): void {
  const renderers = ui.fighters[slot];
  if (s.game.phase === Phase.result) {
    const body = s.participants[slot].body;
    if (body !== undefined) ShowUnit(body.unit, false);
  }
  const posed = ui.match.posing === slot ? undefined : live;
  if (renderers !== undefined) presentDrawnBody(renderers, fighter, game.phase !== Phase.result && ui.match.posing !== slot, posed, runtime.poses[slot], game.stageChoice, runtime.simulationFrame, matchFrame, game.camera, game.ultimatesOff);
  renderers?.goldSack?.present(posed, game.stageChoice);
  renderers?.shurikenGlow?.present(posed, game.stageChoice);
  renderers?.spheres?.present(posed, runtime.simulationFrame, s.session.paused);
  renderers?.flight?.present(posed, game.stageChoice, s.session.paused);
  if (renderers !== undefined) {
    renderers.agency.present(live, live === undefined ? "act" : mark);
    renderers.terror.present(live, roared, s.session.paused);
    renderers.seaSplash.present(live, drawn, s.session.paused);
  }
}

function presentSlotLayers(ui: UiObjects, slot: ParticipantSlot, live: Readonly<Fighter> | undefined): void {
  if (live !== undefined) ui.frost.present(live, slot);
  else ui.frost.hideSlot(slot);
  ui.stance.present(live, slot);
  if (live !== undefined) ui.elements.present(live, slot);
  else ui.elements.hideSlot(slot);
  if (live !== undefined) ui.placed.present(live, slot);
  else ui.placed.hideSlot(slot);
}

function presentSlotOverlays(s: ShellState, ui: UiObjects, slot: ParticipantSlot, fighter: Readonly<Fighter> | undefined, live: Readonly<Fighter> | undefined, playing: boolean, runtime: PacingAndPresentation): void {
  const renderers = ui.fighters[slot];
  renderers?.shield.present(fighter, playing);
  renderers?.projectiles.present(fighter, playing, s.session.paused);
  renderers?.hookChain?.present(fighter, s.world, playing);
  renderers?.cues?.present(fighter, playing, s.session.paused);
  renderers?.meter?.present(runtime.simulationFrame, fighter, playing, presentedCueTrace(s, slot, runtime.simulationFrame));
  renderers?.hitAreas?.present(live);
}
