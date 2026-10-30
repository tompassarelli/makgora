import { Action } from "../../game/input/actions";
import { type KeyBindings, keyNames } from "../../game/input/keyBindings";
import { PAD_PRESENT_KEY } from "../../game/input/padCapture";
import { chordLabels } from "../../game/input/pauseChord";
import { remainingSeconds, timedMatch } from "../../game/lobby/lobbyState";
import { formatClock } from "../../game/ui/matchHud";
import type { PauseView } from "../../game/ui/pauseScreen";
import { osKeyDown } from "../../platform/osKeys";
import { localHints, localHintsKey } from "./hints";
import type { ShellState } from "./state";

const PAD_CAMERA = "Camera: stick moves · C-stick zooms";

function keyboardCamera(bindings: Readonly<KeyBindings>): string {
  const move = [Action.moveUp, Action.moveLeft, Action.moveDown, Action.moveRight].map(action => keyNames(bindings, action)).join(" ");
  return `Camera: ${move} move · ${keyNames(bindings, Action.cUp)} / ${keyNames(bindings, Action.cDown)} zoom`;
}

export const pauseScreenUp = (s: Readonly<ShellState>): boolean => s.session.paused || s.dev.pauseLook !== undefined;

export function pauseView(s: Readonly<ShellState>, bindings: Readonly<KeyBindings>): PauseView {
  const pad = s.dev.pauseLook === undefined ? BlzIsLocalClientActive() && osKeyDown(PAD_PRESENT_KEY) : s.dev.pauseLook === "pad";
  return {
    player: s.pausedBy === undefined ? undefined : s.pausedBy + 1,
    clock: timedMatch(s.game) ? formatClock(remainingSeconds(s.game)) : undefined,
    pad,
    chord: chordLabels(bindings),
    camera: pad ? PAD_CAMERA : keyboardCamera(bindings),
    pauseKey: "Esc",
    hints: localHints(s),
    hintsKey: localHintsKey(s),
  };
}

export const EMPTY_PAUSE_VIEW: PauseView = { player: undefined, clock: undefined, pad: false, chord: { left: "", right: "", attack: "" }, camera: "", pauseKey: "" };
