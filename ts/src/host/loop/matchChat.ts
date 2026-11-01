import { CHAT_STYLE, chatBox } from "../../game/ui/nativeChat";
import type { ChatBox } from "wisp/src/ui/chatPanel";
import { chatText } from "wisp/game/input";
import { eventPlayer, localPlayer } from "wisp/game/players";
import type { ShellState } from "./state";
import { views } from "./ui";

export function receiveChat(s: ShellState): void {
  views(s).chat.receive();
  if (!CHAT_STYLE.ignore(chatText())) s.chatLineSinceMatch = true;
}

export function toggleChatHistory(s: ShellState): void {
  views(s).chat.toggleHistory();
  if (eventPlayer() === localPlayer()) s.chatHistoryOpen = s.chatHistoryOpen !== true;
}

export const shellChatBox = (s: Readonly<ShellState>): ChatBox | undefined => chatBox(s.game.phase, s.chatLineSinceMatch !== false || s.chatHistoryOpen === true);
