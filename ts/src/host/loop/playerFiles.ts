



import type { BindingPersistence } from "../../game/ui/bindingSettings";
import { PARTICIPANT_SLOTS } from "../../game/input/participants";
import { trampoline } from "wisp/src/platform/dispatch";
import { readChunk, readChunks, writeChunks } from "wisp/src/platform/fileio";
import { LOBBY_COUNTER_FILE, PLAYER_FILE_CHUNK } from "../../game/core/gameFiles";
import { departPlayerFiles, enqueuePlayerFile, lobbyCounter, receiveLobbyCounter, receivePlayerFileChunk, type PlayerFileQueue } from "./playerFileQueue";
import { createEvents, onEvents } from "wisp/game/events";
import { eventPlayer, localPlayer, player, playerSlot, playerSlotState } from "wisp/game/players";

export const PLAYER_FILE_RECEIVED = "shell.playerFileReceived";
const MORE_PREFIX = "SC_FL";
const LAST_PREFIX = "SC_FE";
const COUNTER_END = ":";

const CHUNK = PLAYER_FILE_CHUNK;
const BINDINGS_FILE = "MeleePrototypeBindings.pld";

declare global {
  var __smashcraftPlayerFiles: PlayerFileQueue | undefined;
  var __smashcraftSavedBindings: string | undefined;
  var __smashcraftLobbyCounter: number | undefined;
}

function files(): PlayerFileQueue {
  return (globalThis.__smashcraftPlayerFiles ??= { queue: [] });
}


// Engine: Preloader replays the first content it read from a path for the whole session, so a file saved this session is resent from memory.
const localBindingsText = (): string => globalThis.__smashcraftSavedBindings ?? readChunks(BINDINGS_FILE).join("");

function sendFile(owner: number): void {
  if (localPlayer() !== player(owner)) return;
  const text = localBindingsText();
  let offset = 0;
  while (text.length - offset > CHUNK) {
    BlzSendSyncData(MORE_PREFIX, text.substring(offset, offset + CHUNK));
    offset += CHUNK;
  }
  BlzSendSyncData(LAST_PREFIX, `${globalThis.__smashcraftLobbyCounter ?? 0}${COUNTER_END}${text.substring(offset)}`);
}


export function playerFileReceived(): void {
  const owner = playerSlot(eventPlayer());
  const data = BlzGetTriggerSyncData();
  if (BlzGetTriggerSyncPrefix() !== LAST_PREFIX) {
    receivePlayerFileChunk(files(), owner, data, false, sendFile);
    return;
  }
  const end = data.indexOf(COUNTER_END);
  receiveLobbyCounter(files(), owner, S2I(data.substring(0, end)));
  receivePlayerFileChunk(files(), owner, data.substring(end + 1), true, sendFile);
}

export function playerFilesOwnerLeft(owner: number): void {
  departPlayerFiles(files(), owner, sendFile);
}


export const receivedLobbyCounter = (owner: number): number => lobbyCounter(files(), owner) ?? 0;

// Engine: Preloader replays the first counter it read for the whole process, so the latest counter written is kept in memory.
function takeLobbyCounter(): void {
  const counter = (globalThis.__smashcraftLobbyCounter ?? S2I(readChunk(LOBBY_COUNTER_FILE) ?? "")) + 1;
  globalThis.__smashcraftLobbyCounter = counter;
  writeChunks(LOBBY_COUNTER_FILE, [`${counter}`]);
}

export function startPlayerFiles(): void {
  takeLobbyCounter();
  delete files().lobbyCounters;
  const trigger = createEvents();
  for (const slot of PARTICIPANT_SLOTS) {
    BlzTriggerRegisterPlayerSyncEvent(trigger, player(slot), MORE_PREFIX, false);
    BlzTriggerRegisterPlayerSyncEvent(trigger, player(slot), LAST_PREFIX, false);
  }
  onEvents(trigger, trampoline(PLAYER_FILE_RECEIVED));
}

function chunks(text: string): string[] {
  const parts: string[] = [];
  for (let offset = 0; offset < text.length; offset += CHUNK) parts.push(text.substring(offset, offset + CHUNK));
  return parts;
}

export const bindingFiles: BindingPersistence = {
  load(owner, complete) {
    if (playerSlotState(player(owner)) !== PLAYER_SLOT_STATE_PLAYING) {
      complete({ kind: "unavailable" });
      return;
    }
    enqueuePlayerFile(files(), owner, complete, sendFile);
  },
  readLocal(owner) {
    if (localPlayer() !== player(owner)) return undefined;
    const text = localBindingsText();
    return text === "" ? { kind: "empty" } : { kind: "loaded", encoded: text };
  },
  save(owner, encoded) {
    if (localPlayer() === player(owner) && writeChunks(BINDINGS_FILE, chunks(encoded))) globalThis.__smashcraftSavedBindings = encoded;
  },
};
