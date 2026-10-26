import { PARTICIPANT_SLOTS, type ParticipantSlot } from "../../game/input/participants";
import { Phase, firstHumanSlot, setEndless, setItemsOn, setMeterDropsOn, setParticipants, setUltimatesOn, stageClock, updateConnectedHumans } from "../../game/lobby/lobbyState";
import { SHOWCASE_PAD_X, type ShowcasePads, type ShowcaseRequest, applyShowcaseRequest, copyShowcasePads, createShowcasePads, padName, showcaseMask } from "../../game/session/showcase";
import { STAGE_EDGE_LIGHT_MODEL } from "../../game/presentation/stageEdgeLights";
import { Character } from "../../game/sim/codes";
import { fighterAt, isActive } from "../../game/sim/roster";
import { surfaceZ } from "../../game/sim/stage";
import { hideFighter } from "./fighterCloak";
import { startQuickMatch } from "./menus";
import type { ShellState } from "./state";
import { renderPersistentPresentation } from "./view";

const SHOWCASE_STAGE = 0;
const matchStarted = (s: Readonly<ShellState>): boolean => s.game.phase === Phase.match;
const PAD_COLOURS: readonly (readonly [number, number, number])[] = [[255, 64, 64], [64, 96, 255], [64, 255, 224], [192, 64, 255]];

function drawPadMarkers(s: ShellState): void {
  for (const marker of s.showcaseMarkers) DestroyEffect(marker);
  s.showcaseMarkers.length = 0;
  const { origin } = s;
  const z = origin.z + surfaceZ(SHOWCASE_STAGE, 0, stageClock(s.game));
  for (const slot of PARTICIPANT_SLOTS) {
    const x = origin.x + SHOWCASE_PAD_X[slot];
    const marker = AddSpecialEffect(STAGE_EDGE_LIGHT_MODEL, x, origin.y);
    BlzSetSpecialEffectPosition(marker, x, origin.y, z);
    BlzSetSpecialEffectScale(marker, 0.5 + 0.25 * slot);
    const [red, green, blue] = PAD_COLOURS[slot] ?? [255, 255, 255];
    BlzSetSpecialEffectColor(marker, red, green, blue);
    s.showcaseMarkers.push(marker);
  }
}

export function applyShowcaseSetup(s: ShellState, pads: Readonly<ShowcasePads>): boolean {
  const { game } = s;
  const actor = firstHumanSlot(game);
  if (s.build.inputProfile !== "native-driver" || game.phase !== Phase.characterMenu || actor === undefined) return false;
  setParticipants(game, showcaseMask(pads), 0);
  updateConnectedHumans(game, 15);
  setEndless(game, actor, true);
  setItemsOn(game, actor, false);
  setMeterDropsOn(game, actor, false);
  setUltimatesOn(game, actor, true);
  game.hazards = false;
  startQuickMatch(s, SHOWCASE_STAGE, s.build.scenario, pads.fighters.map(character => character ?? Character.rifleman));
  if (!matchStarted(s)) return false;
  game.teamBattle = true;
  game.friendlyFire = false;
  for (const slot of PARTICIPANT_SLOTS) game.teamChoices[slot] = 0;
  for (const slot of PARTICIPANT_SLOTS) {
    if (pads.fighters[slot] === undefined) continue;
    const fighter = fighterAt(s.world, slot);
    fighter.motion.x = SHOWCASE_PAD_X[slot];
    fighter.facing = SHOWCASE_PAD_X[slot] < 0.0 ? 1 : -1;
  }
  s.promoHudHidden = true;
  s.showcaseFocus = undefined;
  drawPadMarkers(s);
  return true;
}

function focusCamera(s: ShellState, focus: ParticipantSlot | "all"): string {
  if (!matchStarted(s) || focus !== "all" && (s.showcase.fighters[focus] === undefined || !isActive(s.world, focus))) return "dev: showcase refused";
  s.showcaseFocus = focus === "all" ? undefined : focus;
  for (const slot of PARTICIPANT_SLOTS) if (isActive(s.world, slot)) hideFighter(s, slot, focus !== "all" && slot !== focus);
  if (focus === "all") renderPersistentPresentation(s);
  return `dev: showcase camera ${focus === "all" ? "all" : focus + 1}`;
}

export function applyShowcaseCommand(s: ShellState, request: ShowcaseRequest, reset: () => void): string | undefined {
  if (s.build.inputProfile !== "native-driver") return undefined;
  if (request.kind === "camera") return focusCamera(s, request.slot);
  if (request.kind === "demo") {
    s.showcaseDemo = request.character;
    return `dev: showcase demo ${padName(request.character)}`;
  }
  const pads = createShowcasePads();
  copyShowcasePads(pads, s.showcase);
  const receipt = applyShowcaseRequest(pads, request);
  if (receipt === undefined) return "dev: showcase refused";
  reset();
  if (!applyShowcaseSetup(s, pads)) return "dev: showcase refused";
  copyShowcasePads(s.showcase, pads);
  return receipt;
}
