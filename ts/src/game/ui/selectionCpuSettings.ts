import { SELECT_LEVELS } from "./selectLevels";
import { type MatchState, canChooseComputer } from "../lobby/lobbyState";
import { floorMod } from "wisp/src/sim/intMath";
import { Action } from "../input/actions";
import { CPU_OPPONENT_COPY } from "./cpuOpponentCopy";
import { createOpponentSettings } from "./opponentSettingsFrames";
import { type ClickBox, gameUi, setMenuText } from "./frames";
import { CPU_SETTINGS_BOXES } from "./cpuSettingsLayout";
import { titleCase } from "./selectionFrames";
import { setFrameEnabled, setFrameLevel, setFrameVisible } from "wisp/game/frames";

export interface CpuDefaults {
  readonly opponent: MatchState["cpuOpponents"][number];
  readonly tier: MatchState["cpuTiers"][number];
}

export type CpuButton = { kind: "cpuStep"; row: 0 | 1; direction: -1 | 1 } | { kind: "cpuClose" };

export interface CpuSettingsFrames {
  readonly root: framehandle;
  readonly title: framehandle;
  readonly values: readonly framehandle[];
  readonly preview: framehandle;
  readonly prompt: framehandle;
  readonly done: framehandle;
  readonly steps: readonly framehandle[];
}

export function createCpuSettings(participantId: number, add: (frame: framehandle, target: CpuButton, text: string, box: ClickBox) => framehandle): CpuSettingsFrames {
  const cpu = createOpponentSettings(gameUi(), participantId);
  if (cpu === undefined) throw new Error("the Opponent settings frames did not load");
  setFrameLevel(cpu.root, SELECT_LEVELS.cpuSettings);
  const steps: framehandle[] = [];
  const cpuButton = (frame: framehandle, button: CpuButton, box: ClickBox) => {
    if (button.kind === "cpuStep") steps.push(frame);
    return add(frame, button, button.kind === "cpuStep" ? button.direction < 0 ? "<" : ">" : frame === cpu.close ? "Close" : "Done", box);
  };
  cpuButton(cpu.close, { kind: "cpuClose" }, CPU_SETTINGS_BOXES.close);
  cpuButton(cpu.opponentPrevious, { kind: "cpuStep", row: 0, direction: -1 }, CPU_SETTINGS_BOXES.opponentPrevious);
  cpuButton(cpu.opponentNext, { kind: "cpuStep", row: 0, direction: 1 }, CPU_SETTINGS_BOXES.opponentNext);
  cpuButton(cpu.difficultyPrevious, { kind: "cpuStep", row: 1, direction: -1 }, CPU_SETTINGS_BOXES.difficultyPrevious);
  cpuButton(cpu.difficultyNext, { kind: "cpuStep", row: 1, direction: 1 }, CPU_SETTINGS_BOXES.difficultyNext);
  const values = [cpu.opponentValue, cpu.difficultyValue];
  const done = cpuButton(cpu.done, { kind: "cpuClose" }, CPU_SETTINGS_BOXES.done);
  setFrameVisible(cpu.root, false);
  return { root: cpu.root, title: cpu.title, values, preview: cpu.preview, prompt: cpu.prompt, done, steps };
}

export function showCpuSettings(frames: CpuSettingsFrames, game: Readonly<MatchState>, participantId: number, slot: number, focus: 0 | 1 | 2, prompt: string, defaults: CpuDefaults): void {
  const opponent = game.cpuOpponents[slot] ?? defaults.opponent;
  const tier = game.cpuTiers[slot] ?? defaults.tier;
  setMenuText(frames.title, `CPU ${slot + 1} — Opponent settings`);
  for (let row = 0; row < frames.values.length; row++) {
    const frame = frames.values[row];
    if (frame !== undefined) setMenuText(frame, `${focus === row ? "> " : ""}${titleCase(row === 0 ? opponent : tier)}${focus === row ? " <" : ""}`);
  }
  const copy = opponent === "random" ? "A different opponent each match." : `${CPU_OPPONENT_COPY[opponent].description}\n${CPU_OPPONENT_COPY[opponent].tags}\n\n${CPU_OPPONENT_COPY[opponent].previews[tier]}`;
  const permission = canChooseComputer(game, participantId, slot) ? "" : "\n\nOnly the slot owner or first player can change this opponent.";
  for (const button of frames.steps) setFrameEnabled(button, permission === "");
  setMenuText(frames.preview, copy + permission);
  setMenuText(frames.done, focus === 2 ? "> Done <" : "Done");
  setMenuText(frames.prompt, prompt);
}

export function cpuMenuFocus(focus: 0 | 1 | 2, action: Action, close: () => void, step: (row: 0 | 1, direction: -1 | 1) => void): 0 | 1 | 2 {
  if (action === Action.special) close();
  else if (action === Action.moveUp || action === Action.moveDown) {
    const next = floorMod(focus + (action === Action.moveUp ? -1 : 1), 3);
    return next === 0 ? 0 : next === 1 ? 1 : 2;
  }
  else if (action === Action.moveLeft || action === Action.moveRight) {
    if (focus !== 2) step(focus, action === Action.moveLeft ? -1 : 1);
  } else if (action === Action.attack) {
    if (focus === 2) close();
    else return focus === 0 ? 1 : 2;
  }
  return focus;
}
