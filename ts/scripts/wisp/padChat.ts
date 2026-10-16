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
