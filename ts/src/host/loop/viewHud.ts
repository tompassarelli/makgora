import { DEFAULT_FIGHTER } from "../../game/roster/kits";
import { leadsDuo } from "../../game/sim/duoStatus";
import { journalIngress } from "../../game/session/build";
import { type StartControl, matchHelp, matchStartNotice, resultNotice, waitingMessage } from "../../game/session/messages";
import { MATCH_NOTICE_BOX } from "../../game/ui/hudLayout";
import type { NoticePlace } from "../../game/ui/noticeLayout";
import { ultimateReady } from "../../game/presentation/meterCues";
import { keepNoticeClearOfMarkers } from "./fighterMarkers";
import { DEFAULT_RESULT_PICK, type MatchState, Phase, costumeFor, costumeTintFor, fighterColor, resultChoicesOpen, timedMatch } from "../../game/lobby/lobbyState";
import type { Fighter } from "../../game/sim/fighter";
import type { ParticipantSlot } from "../../game/input/participants";
import type { KeyBindings } from "../../game/input/keyBindings";
import { loreClears } from "../../game/classic/loreClears";
import { type UiObjects, layoutHuds, menuControlHit } from "./ui";
import { localDevice, localHints } from "./hints";
import { type ShellState, activeRollback, localSlot, playsOnKeyboard } from "./state";
import { warcraftMenuOpen } from "./warcraftMenu";
import { probeWaiting } from "./responseProbe";
import { clockSeconds } from "./trace";
import { fighterAt, isActive } from "../../game/sim/roster";
import { setFrameText, setFrameVisible } from "wisp/game/frames";

export const startControl = (s: Readonly<ShellState>): StartControl =>
  (journalIngress(s.build) === "editbox" && !playsOnKeyboard(s.rollback?.journal, localSlot()) ? "Start" : "Y");

const shownMessages: { frames: object | undefined; helpVisible: boolean | undefined; noticeVisible: boolean | undefined; help: string | undefined; notice: string | undefined; noticePlace: NoticePlace } = {
  frames: undefined, helpVisible: undefined, noticeVisible: undefined, help: undefined, notice: undefined, noticePlace: { left: MATCH_NOTICE_BOX.left, top: MATCH_NOTICE_BOX.top },
};

export function presentMatchPanels(s: ShellState, game: MatchState, ui: UiObjects, showMatch: boolean, local: ParticipantSlot | undefined, localKeys: KeyBindings): void {
  ui.clock.update(showMatch && game.phase === Phase.match && timedMatch(game), game.remainingFrames);
  ui.match.presentCountdown(game, showMatch);
  ui.training.update(showMatch && game.training && game.phase === Phase.match, game.trainer, localKeys);
  const hints = localHints(s);
  if (ui.hints.laidFor !== hints) layoutHuds(s, hints);
  ui.hints.update(showMatch && hints && game.phase === Phase.match && local !== undefined, s.participants[local ?? 0].bindings, localDevice(s));
  ui.classic?.updateCard(game);
}

export function markLoreClear(game: MatchState): void {
  const cleared = game.lore && game.phase === Phase.result && game.run.active && game.run.cleared ? game.run.current : undefined;
  if (cleared !== undefined && localSlot() === game.run.player) loreClears().mark(cleared.id);
}

export function updateSlotHud(s: ShellState, ui: UiObjects, slot: ParticipantSlot, game: MatchState, selecting: boolean, paused: boolean, menuTitle: boolean, showMatch: boolean): void {
  if (s.participants[slot].body !== undefined && isActive(s.world, slot)) {
    const fighter = fighterAt(s.world, slot);
    ui.huds[slot].update(showMatch, fighter.character, fighterColor(game, slot), fighter.status.damage, s.game.endless ? 0 : fighter.status.stocks, fighter.status.cursedBy !== undefined, costumeTintFor(game, slot, fighter.character), costumeFor(game, slot), leadsDuo(s.world, slot));
    ui.meterBars[slot].hud.update(showMatch, fighter.meter.ultimate, ultimateReady(fighter, game.ultimatesOff), fighter.visuals.manaDrained);
  } else {
    ui.huds[slot].update(false, DEFAULT_FIGHTER, slot, 0.0, 0);
    ui.meterBars[slot].hud.update(false, 0, false, 0);
  }
  ui.selections[slot].menuBindings(s.participants[slot].bindings.bindings);
  ui.selections[slot].update(game, s.startingChoicesReady === false, menuTitle || ui.settings[slot].isOpen(), selecting || game.phase === Phase.result || paused || menuTitle || ui.settings[slot].isOpen(), warcraftMenuOpen(s), s.sessionWins.counts, clockSeconds(s.trace), menuControlHit(ui, slot));
  ui.settings[slot].update();
}

export function presentMessages(s: ShellState, game: MatchState, ui: UiObjects, showMatch: boolean, paused: boolean, selecting: boolean, local: ParticipantSlot | undefined, localFighter: Readonly<Fighter> | undefined): void {
  const { help, notice } = s.frames;
  if (shownMessages.frames !== s.frames) {
    shownMessages.frames = s.frames;
    shownMessages.helpVisible = undefined;
    shownMessages.noticeVisible = undefined;
    shownMessages.help = undefined;
    shownMessages.notice = undefined;
    shownMessages.noticePlace.left = MATCH_NOTICE_BOX.left;
    shownMessages.noticePlace.top = MATCH_NOTICE_BOX.top;
  }
  const teaching = game.phase === Phase.match && game.training && s.trainingHints === true && !paused;
  const helpVisible = showMatch && teaching;
  if (shownMessages.helpVisible !== helpVisible) {
    shownMessages.helpVisible = helpVisible;
    setFrameVisible(help, helpVisible);
  }
  const waiting = game.phase === Phase.match ? activeRollback(s)?.waitingFor ?? 0 : 0;
  const starting = matchStartNotice(game);
  const noticeVisible = showMatch && (waiting !== 0 || starting !== "" || (game.phase === Phase.result && !ui.match.resultsShown()));
  if (shownMessages.noticeVisible !== noticeVisible) {
    shownMessages.noticeVisible = noticeVisible;
    setFrameVisible(notice, noticeVisible);
  }
  keepNoticeClearOfMarkers(notice, noticeVisible, shownMessages.noticePlace);
  if (!selecting) presentMessageText(s, game, ui, waiting, starting, local, localFighter);
}

function presentMessageText(s: ShellState, game: MatchState, ui: UiObjects, waiting: number, starting: string, local: ParticipantSlot | undefined, localFighter: Readonly<Fighter> | undefined): void {
  const { help, notice } = s.frames;
  if (game.phase === Phase.result) ui.results.update(resultNotice(game, s.status.text).replace("\n", "  ·  "), matchHelp(game, s.session.paused, startControl(s), localFighter, false), resultChoicesOpen(game) && local !== undefined ? s.resultFocus?.[local] ?? DEFAULT_RESULT_PICK : undefined);
  const helpText = matchHelp(game, s.session.paused, startControl(s), localFighter, game.phase === Phase.match);
  if (shownMessages.help !== helpText) {
    shownMessages.help = helpText;
    setFrameText(help, helpText);
  }
  probeWaiting(s.probe, waiting, localSlot());
  const noticeText = game.phase === Phase.result ? resultNotice(game, s.status.text) : waiting !== 0 ? waitingMessage(waiting) : starting;
  if (shownMessages.notice !== noticeText) {
    shownMessages.notice = noticeText;
    setFrameText(notice, noticeText);
  }
}
