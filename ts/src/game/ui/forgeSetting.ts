import { readChunks, writeChunks } from "wisp/src/platform/fileio";

const FORGE_FILE = "MakgoraShowForge.pld";
const ON = "1";

declare global {
  var __makgoraForgeShown: boolean | undefined;
}

// Engine: Preloader replays the first content it read from a path for the whole session, so the latest choice is kept in memory.
export function forgeShown(): boolean {
  return (globalThis.__makgoraForgeShown ??= readChunks(FORGE_FILE).join("") === ON);
}

export function setForgeShown(shown: boolean): void {
  globalThis.__makgoraForgeShown = shown;
  writeChunks(FORGE_FILE, [shown ? ON : "0"]);
}

export const toggleForgeShown = (): void => setForgeShown(!forgeShown());

export const forgeSettingText = (shown: boolean, gold: string): string => `Show the Forge: ${shown ? `${gold}On|r` : "Off"}`;
