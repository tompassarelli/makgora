import { NATIVE_SOAK_FILE } from "../game/core/gameFiles";
import { PARTICIPANT_SLOTS } from "../game/input/participants";
import { Phase, computerActive, cycleSlotMode, firstHumanSlot, selectCpuCharacter, setCpuOpponent, setCpuTier, setTimeLimit } from "../game/match/rules";
import { SELECTABLE_CHARACTERS } from "../game/sim/heroes/registry";
import { at } from "wisp/src/runtime/lookup";
import { floorMod } from "wisp/src/sim/intMath";
import { writeLines } from "wisp/src/platform/fileio";
import { startQuickMatch } from "./shell/menus";
import { type ShellState } from "./shell/state";
import { liveSoakHandles } from "./soakHandles";

interface Soak {
  callbacks: number;
  frames: number;
  matches: number;
  results: number;
  previousPhase: Phase;
  before: number;
  phaseBefore: Phase;
}

declare global {
  var __smashcraftNativeSoak: Soak | undefined;
  var __smashcraftNativeSoakStart: boolean | undefined;
}
declare const collectgarbage: ((this: void, option: "count") => number) | undefined;



function lineup(s: ShellState, match: number): void {
  for (const slot of PARTICIPANT_SLOTS) s.game.characterChoices[slot] = at(SELECTABLE_CHARACTERS, floorMod(match * 4 + slot, SELECTABLE_CHARACTERS.length));
}

export function startNativeSoak(s: ShellState): boolean {
  const actor = firstHumanSlot(s.game);
  if (actor === undefined || s.game.phase !== Phase.characterMenu || globalThis.__smashcraftSoakHandles === undefined) {
    writeLines(NATIVE_SOAK_FILE, [`dev: native soak requires a soak ledger at selection; phase=${s.game.phase} actor=${actor ?? "none"} ledger=${globalThis.__smashcraftSoakHandles === undefined ? "missing" : "installed"}`]);
    return false;
  }
  for (const slot of PARTICIPANT_SLOTS) {
    while (!computerActive(s.game, slot)) if (!cycleSlotMode(s.game, actor, slot)) return false;
    setCpuOpponent(s.game, actor, slot, "wren");
    setCpuTier(s.game, actor, slot, "expert");
    selectCpuCharacter(s.game, actor, slot, at(SELECTABLE_CHARACTERS, slot));
  }
  setTimeLimit(s.game, actor, 1);
  s.game.automaticRematch = true;
  s.dev.rematchSeconds = 1;
  globalThis.__smashcraftNativeSoak = { callbacks: 0, frames: 0, matches: 1, results: 0, previousPhase: Phase.match, before: 0, phaseBefore: Phase.match };
  startQuickMatch(s, 0, s.build.scenario, undefined, 1);
  sample(s);
  return true;
}

export function beforeNativeSoakTick(s: ShellState): void {
  if (globalThis.__smashcraftNativeSoakStart && s.game.phase === Phase.characterMenu) {
    globalThis.__smashcraftNativeSoakStart = false;
    startNativeSoak(s);
  }
  const soak = globalThis.__smashcraftNativeSoak;
  if (soak === undefined) return;
  if (s.game.phase === Phase.result && soak.previousPhase !== Phase.result) {
    soak.results++;
    lineup(s, soak.matches);
  }
  soak.previousPhase = s.game.phase;
  soak.before = s.runtime.simulationFrame;
  soak.phaseBefore = s.game.phase;
}

function sample(s: ShellState): void {
  const soak = globalThis.__smashcraftNativeSoak;
  if (soak === undefined) return;
  const heap = typeof collectgarbage === "function" ? `heapKb=${R2I(collectgarbage("count"))}` : "heapKbAbsent=no-collectgarbage";
  writeLines(NATIVE_SOAK_FILE, ["dev: native soak four CPUs", `soak callbacks=${soak.callbacks} frames=${soak.frames} matches=${soak.matches} results=${soak.results} phase=${s.game.phase} stage=${s.game.stageChoice} characters=${s.game.characterChoices.join(",")} cpu=${s.game.computerMask} ${heap} handles=${liveSoakHandles()}`]);
}

export function afterNativeSoakTick(s: ShellState): void {
  const soak = globalThis.__smashcraftNativeSoak;
  if (soak === undefined) return;
  soak.callbacks++;
  if (soak.phaseBefore === Phase.match) {
    const delta = s.runtime.simulationFrame - soak.before;
    soak.frames += delta;
  }
  if (soak.phaseBefore !== Phase.match && s.game.phase === Phase.match) soak.matches++;
  if (floorMod(soak.callbacks, 60) === 0) sample(s);
}
