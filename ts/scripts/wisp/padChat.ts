import type { NativeChatEntryReceipt } from "./boundary";

export interface CurrentChatEntry {
  readonly available: boolean;
  readonly open: boolean;
  readonly modified: number;
}

export function currentChatEntry(receipt: NativeChatEntryReceipt | undefined, modified: number, build: string, freshAfterMs: number): CurrentChatEntry | undefined {
  if (receipt === undefined || receipt.build !== build || modified <= freshAfterMs) return undefined;
  return { available: receipt.available === "1", open: receipt.open === "1", modified };
}


export function selectionChatBootstrapRequired(entry: CurrentChatEntry | undefined): boolean {
  return entry === undefined;
}


export interface JournalChatReceipt {
  readonly epoch: number;
  readonly chat: number;
  readonly chatState: number;
}

const RELEASED_SETTLE_MS = 500;

export function journalChatEntry(receipt: JournalChatReceipt | undefined, epoch: number, ageMs: number): CurrentChatEntry | undefined {
  if (receipt?.epoch !== epoch || receipt.chatState === 1 || (receipt.chatState === 2 && ageMs < RELEASED_SETTLE_MS)) return undefined;
  return { available: true, open: receipt.chatState === 3, modified: receipt.chat * 4 + receipt.chatState };
}
