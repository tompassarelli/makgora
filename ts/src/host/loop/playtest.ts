








import { isParticipantSlot } from "../../game/input/participants";
import { Phase, firstHumanSlot } from "../../game/lobby/lobbyState";
import { parsePlaytestRequest } from "../../game/session/playtest";
import { PLAYTEST_GO_FILE, PLAYTEST_REQUEST_FILE, playtestReceiptFile } from "../../game/core/gameFiles";
import { readChunk, writeLine } from "wisp/src/platform/fileio";
import { startPlaytest } from "./menus";
import { type ShellState, localSlot, playtestProgress } from "./state";
import { eventPlayer, playerSlot } from "wisp/game/players";
import { sendSync, syncData } from "wisp/game/sync";

export const PLAYTEST = "shell.playtest";
export const PLAYTEST_PREFIX = "SC_PLAY";
const LOOK_FRAMES = 30;
const PLAYTEST_HOLD = "HOLD";


export function readPlaytestRequest(s: ShellState): void {
  if (firstHumanSlot(s.game) !== localSlot()) return;
  const line = readChunk(PLAYTEST_REQUEST_FILE);
  playtestProgress().request = line !== undefined && parsePlaytestRequest(line) !== undefined ? line : undefined;
}


export function servicePlaytestRequest(s: ShellState): void {
  const state = playtestProgress();
  if (state.request === undefined || state.sent || s.game.phase !== Phase.characterMenu) return;
  if (++state.looked < LOOK_FRAMES) return;
  state.looked = 0;
  if (!state.starting) {
    if (readChunk(PLAYTEST_GO_FILE) === undefined) return;
    state.starting = true;
    sendSync(PLAYTEST_PREFIX, PLAYTEST_HOLD);
    return;
  }
  state.sent = true;
  sendSync(PLAYTEST_PREFIX, state.request);
}


export function playtestRequested(s: ShellState): void {
  if (playerSlot(eventPlayer()) !== firstHumanSlot(s.game)) return;
  const line = syncData();
  if (line === PLAYTEST_HOLD) {
    playtestProgress().starting = true;
    return;
  }
  const request = parsePlaytestRequest(line);
  const started = !playtestProgress().cancelled && request !== undefined && startPlaytest(s, request);
  playtestProgress().starting = false;
  const slot = localSlot();
  if (isParticipantSlot(slot)) writeLine(playtestReceiptFile(slot), `${line} ${started ? "started" : "refused"}`);
}
