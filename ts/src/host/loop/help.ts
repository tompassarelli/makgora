import { PARTICIPANT_SLOTS, isParticipantSlot } from "../../game/input/participants";
import { COMMANDS_DESCRIPTION, COMMANDS_TITLE, COMMANDS_COMMAND, CONTROLS_TITLE, HELP_COMMAND, HOW_TO_PLAY, HOW_TO_PLAY_TITLE, PLAYER_COMMANDS, controlsDescription } from "../../game/ui/helpText";
import { trampoline } from "wisp/src/platform/dispatch";
import { localParticipantSlot } from "./diagnostics";
import type { ShellState } from "./state";

export const HELP_EVENT = "shell.help";

const HELP_SECONDS = 30.0;

declare global {
  var __smashcraftHelpQuests: { readonly controls: quest; revision: number } | undefined;
}

function addQuest(title: string, description: string, icon: string, required: boolean): quest {
  const entry = CreateQuest();
  QuestSetTitle(entry, title);
  QuestSetDescription(entry, description);
  QuestSetIconPath(entry, icon);
  QuestSetRequired(entry, required);
  QuestSetDiscovered(entry, true);
  QuestSetCompleted(entry, false);
  return entry;
}

export function startHelp(s: ShellState): void {
  const chat = CreateTrigger();
  for (const slot of PARTICIPANT_SLOTS) {
    TriggerRegisterPlayerChatEvent(chat, Player(slot), HELP_COMMAND, true);
    TriggerRegisterPlayerChatEvent(chat, Player(slot), COMMANDS_COMMAND, true);
  }
  TriggerAddAction(chat, trampoline(HELP_EVENT));
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
  QuestSetDescription(quests.controls, controlsDescription(settings.bindings));
}

export function helpCommand(): void {
  const slot = GetPlayerId(GetTriggerPlayer());
  if (!isParticipantSlot(slot)) return;
  for (const line of PLAYER_COMMANDS) DisplayTimedTextToPlayer(Player(slot), 0.0, 0.0, HELP_SECONDS, line);
}
