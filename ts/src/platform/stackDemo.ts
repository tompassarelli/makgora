


import { on, trampoline } from "wisp/src/platform/dispatch";
import { PARTICIPANT_SLOTS } from "../game/input/participants";
import type { MapBuild } from "../game/session/build";
import { createEvents, onEvents } from "wisp/game/events";
import { addChatEvent, chatText } from "wisp/game/input";
import { player } from "wisp/game/players";

export const STACK_DEMO_COMMAND = "-dev stack-demo";
export const STACK_DEMO_HANDLER = "stackDemo.command";

function failInnermost(label: string): never {
  throw new Error(`stack demo failure: ${label}`);
}

function runMiddle(label: string): void {
  failInnermost(label);
}

function runOuter(label: string): void {
  runMiddle(label);
}

function stackDemoCommand(): void {
  runOuter(chatText());
}


export function installStackDemo(build: Readonly<MapBuild>): void {
  if (build.devConsole) on(STACK_DEMO_HANDLER, stackDemoCommand);
}

export function startStackDemo(build: Readonly<MapBuild>): void {
  if (!build.devConsole) return;
  const chat = createEvents();
  for (const slot of PARTICIPANT_SLOTS) addChatEvent(chat, player(slot), STACK_DEMO_COMMAND, false);
  onEvents(chat, trampoline(STACK_DEMO_HANDLER));
}
