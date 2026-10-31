





import { on, trampoline } from "wisp/src/platform/dispatch";
import { installFrameMeter as installWispFrameMeter, startFrameCostCapture, startFrameMeter } from "wisp/src/platform/frameMeter";
import { PARTICIPANT_SLOTS } from "../game/input/participants";
import { Phase } from "../game/lobby/lobbyState";
import { parseDecimal } from "../game/netcode/journal/decimal";
import { activeRollback, shellState } from "../host/loop/state";
import { FRAME_SECTIONS } from "../host/loop/frameSections";
import { createEvents, onEvents } from "wisp/game/events";
import { displayTimedText } from "wisp/game/frames";
import { addChatEvent, chatText } from "wisp/game/input";
import { eventPlayer, player } from "wisp/game/players";


const PERF_COMMAND = "-dev perf";

function speculativeFrame(): number {
  const state = shellState();
  const rollback = state === undefined ? undefined : activeRollback(state);
  return rollback?.schedule.nextSpeculative ?? -1;
}

const CAPTURE_STAMPS = [
  { name: "frame", read: () => shellState()?.runtime.simulationFrame ?? -1 },
  { name: "speculative", read: speculativeFrame },
  { name: "replay", read: () => shellState()?.replay.serial ?? -1 },
];

const CAPTURE_COMMAND = "-dev capture ";
const CAPTURE_HANDLER = "frameMeter.capture";

function captureCommand(): void {
  const text = chatText().substring(CAPTURE_COMMAND.length);
  if (text === "clear" || text.includes(" ")) return;
  const state = shellState();
  if (state === undefined || state.game.phase !== Phase.match) throw new Error("start a match before capturing frame cost");
  const frames = parseDecimal(text);
  if (frames === undefined || `${frames}` !== text) throw new Error("capture needs a whole frame count");
  const run = startFrameCostCapture(frames);
  displayTimedText(eventPlayer(), 0, 0, 5, `dev: capture run=${run} frames=${frames} match-frame=${state.game.matchFrame}`);
}


export function installFrameMeter(): void {
  installWispFrameMeter();
  on(CAPTURE_HANDLER, captureCommand);
}


export function startMatchFrameMeter(): void {
  startFrameMeter({
    frame: "shell.tick",

    simulationFrame: () => shellState()?.runtime.simulationFrame ?? 0,
    toggle: PERF_COMMAND,
    sections: FRAME_SECTIONS,
    stamps: CAPTURE_STAMPS,
  });
  on(CAPTURE_HANDLER, captureCommand);
  const chat = createEvents();
  for (const slot of PARTICIPANT_SLOTS) addChatEvent(chat, player(slot), CAPTURE_COMMAND, false);
  onEvents(chat, trampoline(CAPTURE_HANDLER));
}
