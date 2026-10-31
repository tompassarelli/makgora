import { PARTICIPANT_SLOTS, isParticipantSlot } from "../../game/input/participants";
import { COMMANDS_DESCRIPTION, COMMANDS_TITLE, COMMANDS_COMMAND, CONTROLS_TITLE, HELP_COMMAND, HOW_TO_PLAY, HOW_TO_PLAY_TITLE, PLAYER_COMMANDS, controlsDescription } from "../../game/ui/helpText";
import { trampoline } from "wisp/src/platform/dispatch";
import { localParticipantSlot } from "./diagnostics";
import type { ShellState } from "./state";
import { createEvents, onEvents } from "wisp/game/events";
import { createQuest, displayTimedText, Quest, setQuestCompleted, setQuestDescription, setQuestDiscovered, setQuestIcon, setQuestRequired, setQuestTitle } from "wisp/game/frames";
import { addChatEvent } from "wisp/game/input";
import { eventPlayer, player, playerSlot } from "wisp/game/players";

export const HELP_EVENT = "shell.help";

const HELP_SECONDS = 30.0;

declare global {
  var __smashcraftHelpQuests: { readonly controls: Quest; revision: number } | undefined;
}

function addQuest(title: string, description: string, icon: string, required: boolean): Quest {
  const entry = createQuest();
  setQuestTitle(entry, title);
  setQuestDescription(entry, description);
  setQuestIcon(entry, icon);
  setQuestRequired(entry, required);
  setQuestDiscovered(entry, true);
  setQuestCompleted(entry, false);
  return entry;
}

export function startHelp(s: ShellState): void {
  const chat = createEvents();
  for (const slot of PARTICIPANT_SLOTS) {
    addChatEvent(chat, player(slot), HELP_COMMAND, true);
    addChatEvent(chat, player(slot), COMMANDS_COMMAND, true);
  }
  onEvents(chat, trampoline(HELP_EVENT));
  if (globalThis.__smashcraftHelpQuests === undefined) {
    const controls = addQuest(CONTROLS_TITLE, "", "ReplaceableTextures\\CommandButtons\\BTNSpellBookBLS.blp", true);
    addQuest(HOW_TO_PLAY_TITLE, HOW_TO_PLAY, "ReplaceableTextures\\CommandButtons\\BTNTomeOfRetraining.blp", true);
    addQuest(COMMANDS_TITLE, COMMANDS_DESCRIPTION, "ReplaceableTextures\\CommandButtons\\BTNSnazzyScroll.blp", false);
    globalThis.__smashcraftHelpQuests = { controls, revision: -1 };
  }
  serviceHelp(s);
}

export function serviceHelp(s: ShellState): void {
  const quests = globalThis.__smashcraftHelpQuests;
  const local = localParticipantSlot(s);
  if (quests === undefined || local === undefined) return;
  const settings = s.participants[local].bindings;
  if (quests.revision === settings.revision) return;
  quests.revision = settings.revision;
  setQuestDescription(quests.controls, controlsDescription(settings.bindings));
}

export function helpCommand(): void {
  const slot = playerSlot(eventPlayer());
  if (!isParticipantSlot(slot)) return;
  for (const line of PLAYER_COMMANDS) displayTimedText(player(slot), 0.0, 0.0, HELP_SECONDS, line);
}
