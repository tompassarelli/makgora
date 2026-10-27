import { TRAILER_LOG_FILE, TRAILER_SCRIPT } from "../game/core/gameFiles";
import { PARTICIPANT_SLOTS } from "../game/input/participants";
import { Phase, copyMatchState } from "../game/lobby/lobbyState";
import { fieldMatch } from "../game/match/fieldMatch";
import { TRAILER_SHOTS, type TrailerShot } from "../game/session/trailerShots";
import { clearVisualCapture, holdEveryVisualFrame } from "../game/session/visualCapture";
import { selectableCharacterBySlug } from "../game/roster/kits";
import { fighterAt, isActive } from "../game/sim/roster";
import { writeLines } from "wisp/src/platform/fileio";
import { confirmedChecksum } from "../host/loop/diagnostics";
import { drawnFrame } from "../host/loop/drawnFrame";
import { paintDrawnStamp } from "../host/loop/drawnStamp";
import { startMatch } from "../host/loop/matchStart";
import { resetToStartingSelection } from "../host/loop/menus";
import { type ShellState, localSlot } from "../host/loop/state";
import { installTickProbe } from "../host/loop/tickProbe";

const HOLD_TICKS = 5;

interface Trailer {
  shot: number;
  playing: boolean;
  opened: boolean;
  readonly stocks: number[];
  readonly lines: string[];
}

declare global { var __smashcraftTrailer: Trailer | undefined; }

export function armTrailer(): void {
  globalThis.__smashcraftTrailer = { shot: 0, playing: false, opened: false, stocks: [0, 0, 0, 0], lines: ["TRAILER START"] };
  installTickProbe({ before: beforeTrailerTick, after: afterTrailerTick, soundPlayed: () => undefined });
}

function startShot(s: ShellState, trailer: Trailer, shot: TrailerShot): void {
  const a = selectableCharacterBySlug(shot.fighters[0]);
  const b = selectableCharacterBySlug(shot.fighters[1]);
  if (a === undefined || b === undefined) {
    trailer.lines.push(`SHOT ${trailer.shot} seed ${shot.seed} refused unknown fighter`);
    trailer.shot++;
    return;
  }
  copyMatchState(s.game, fieldMatch(a, b, { stage: shot.stage, seed: shot.seed }).match);
  startMatch(s);
  holdEveryVisualFrame(localSlot(), shot.start, HOLD_TICKS);
  trailer.playing = true;
  trailer.opened = false;
  for (const slot of PARTICIPANT_SLOTS) trailer.stocks[slot] = isActive(s.world, slot) ? fighterAt(s.world, slot).status.stocks : 0;
  trailer.lines.push(`SHOT ${trailer.shot} seed ${shot.seed} start ${shot.start} end ${shot.end}`);
}

function beforeTrailerTick(s: ShellState): void {
  const trailer = globalThis.__smashcraftTrailer;
  if (trailer === undefined || trailer.playing || s.game.phase !== Phase.characterMenu) return;
  const shot = TRAILER_SHOTS[trailer.shot];
  if (shot !== undefined) startShot(s, trailer, shot);
}

function finishShot(s: ShellState, trailer: Trailer, frame: number): void {
  trailer.lines.push(`checksum ${frame} ${confirmedChecksum(s)}`);
  trailer.playing = false;
  clearVisualCapture(localSlot());
  trailer.shot++;
  if (trailer.shot >= TRAILER_SHOTS.length) trailer.lines.push(`TRAILER END shots ${trailer.shot}`);
  writeLines(TRAILER_LOG_FILE, trailer.lines);
  resetToStartingSelection(s);
}

function afterTrailerTick(s: ShellState): void {
  const trailer = globalThis.__smashcraftTrailer;
  const shot = trailer === undefined ? undefined : TRAILER_SHOTS[trailer.shot];
  if (trailer === undefined || shot === undefined || !trailer.playing) return;
  const frame = s.runtime.simulationFrame;
  if (s.game.phase !== Phase.match) {
    trailer.lines.push(`ended ${frame} phase ${s.game.phase}`);
    finishShot(s, trailer, frame);
    return;
  }
  paintDrawnStamp(TRAILER_SCRIPT, drawnFrame(s).frame);
  if (!trailer.opened && frame >= 1) {
    trailer.opened = true;
    trailer.lines.push(`checksum ${frame} ${confirmedChecksum(s)}`);
  }
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(s.world, slot)) continue;
    const stocks = fighterAt(s.world, slot).status.stocks;
    if (stocks !== trailer.stocks[slot]) trailer.lines.push(`stock ${frame} ${slot} ${stocks}`);
    trailer.stocks[slot] = stocks;
  }
  if (frame >= shot.end) finishShot(s, trailer, frame);
}
