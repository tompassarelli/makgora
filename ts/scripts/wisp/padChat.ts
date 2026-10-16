import type { NativeChatEntryReceipt } from "./boundary";

export interface CurrentChatEntry {
  readonly available: boolean;
  readonly open: boolean;
  readonly modified: number;
}

export function currentChatEntry(receipt: NativeChatEntryReceipt | undefined, modified: number, build: string, expected: { readonly epoch: number; readonly sessionStartedMs: number } | { readonly afterMs: number }): CurrentChatEntry | undefined {
  if (receipt === undefined || receipt.build !== build) return undefined;
  if ("epoch" in expected ? receipt.epoch !== expected.epoch : modified <= expected.afterMs) return undefined;
  return { available: receipt.available === "1", open: receipt.open === "1", modified };
}
