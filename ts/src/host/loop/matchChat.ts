import { CHAT_STYLE, chatBox } from "../../game/ui/nativeChat";
import { plateRow } from "../../game/ui/plateLayout";
import type { ChatBox, ChatSlot } from "wisp/src/ui/chatPanel";
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

/** Where the chat shows; none while a Controls panel covers the screen, which draws beneath the chat. */
export function shellChatBox(s: Readonly<ShellState>): ChatBox | ChatSlot | undefined {
  for (const panel of views(s).settings) if (panel.covers()) return undefined;
  const ui = views(s);
  return chatBox(s.game.phase, ui.plateRow ?? plateRow(0), s.chatLineSinceMatch !== false || s.chatHistoryOpen === true || ui.chat.isTyping());
}
