import { VOICE_CHECK_SCRIPT, VOICE_LOG_FILE } from "../game/core/gameFiles";
import { PARTICIPANT_SLOTS } from "../game/input/participants";
import { Phase, computerActive, cycleSlotMode, firstHumanSlot, selectCpuCharacter, setCpuOpponent, setCpuTier, setTimeLimit } from "../game/lobby/lobbyState";
import { SELECTABLE_CHARACTERS } from "../game/roster/kits";
import { at } from "wisp/src/runtime/lookup";
import { writeLines } from "wisp/src/platform/fileio";
import { startQuickMatch } from "../host/loop/menus";
import { paintDrawnStamp } from "../host/loop/drawnStamp";
import { presentedFrame } from "../host/loop/presentedMatch";
import { type ShellState } from "../host/loop/state";
import { type SoundPlayed, installTickProbe } from "../host/loop/tickProbe";

const MATCH_MINUTES = 2;
const MATCH_STOCKS = 3;

interface VoiceCheck {
  started: boolean;
  written: boolean;
  readonly lines: string[];
  readonly pending: string[];
}

declare global { var __smashcraftVoiceCheck: VoiceCheck | undefined; }

export function armVoiceCheck(): void {
  globalThis.__smashcraftVoiceCheck = { started: false, written: false, lines: [], pending: [] };
  installTickProbe({ before: beforeVoiceCheckTick, after: afterVoiceCheckTick, soundPlayed: voicePlayed });
}

function startMatch(s: ShellState, check: VoiceCheck): void {
  const actor = firstHumanSlot(s.game);
  if (actor === undefined) return;
  for (const slot of PARTICIPANT_SLOTS) {
    while (!computerActive(s.game, slot)) if (!cycleSlotMode(s.game, actor, slot)) return;
    setCpuOpponent(s.game, actor, slot, "wren");
    setCpuTier(s.game, actor, slot, "expert");
    selectCpuCharacter(s.game, actor, slot, at(SELECTABLE_CHARACTERS, slot));
  }
  setTimeLimit(s.game, actor, MATCH_MINUTES);
  check.started = true;
  writeLines(VOICE_LOG_FILE, [`VOICE CHECK START characters ${s.game.characterChoices.join(",")}`]);
  startQuickMatch(s, 0, s.build.scenario, undefined, MATCH_STOCKS);
}

function beforeVoiceCheckTick(s: ShellState): void {
  const check = globalThis.__smashcraftVoiceCheck;
  if (check !== undefined && !check.started && s.game.phase === Phase.characterMenu) startMatch(s, check);
}

function voicePlayed(frame: number, fighter: number): SoundPlayed | undefined {
  const check = globalThis.__smashcraftVoiceCheck;
  if (check === undefined || check.written) return undefined;
  return (sound, volume, _pitch, cls, slot, live) => {
    check.pending.push(`${frame} ${fighter} ${cls} ${slot} ${live} ${volume} ${sound}`);
  };
}

function afterVoiceCheckTick(s: ShellState): void {
  const check = globalThis.__smashcraftVoiceCheck;
  if (check === undefined || !check.started || check.written) return;
  const drawn = presentedFrame(s);
  for (const line of check.pending) check.lines.push(`${drawn} ${line}`);
  check.pending.length = 0;
  if (s.game.phase === Phase.match) {
    paintDrawnStamp(VOICE_CHECK_SCRIPT, drawn);
    return;
  }
  if (check.lines.length === 0 && s.game.phase !== Phase.result) return;
  check.written = true;
  writeLines(VOICE_LOG_FILE, [`VOICE CHECK END frame ${drawn} voices ${check.lines.length}`, ...check.lines]);
}
