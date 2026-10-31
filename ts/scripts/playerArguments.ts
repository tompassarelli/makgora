import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

export const PRODUCT = "Mak'gora";

export const PLAYER_USAGE = `${PRODUCT} player\nusage: smashcraft-play [MAP.w3x] [--host [--relay REGION] | --join CODE] [--storage WARCRAFT_DIR]\n       smashcraft-play --version`;

/** The map to play: the first `.w3x` argument, else the only `.w3x` in the first folder that holds exactly one. */
export function playerMap(args: readonly string[], folders: readonly string[]): { readonly map: string; readonly rest: readonly string[] } | string {
  const at = args.findIndex((arg) => !arg.startsWith("--") && arg.toLowerCase().endsWith(".w3x"));
  if (at >= 0) return { map: args[at]!, rest: args.filter((_, index) => index !== at) };
  for (const folder of folders) {
    const found = existsSync(folder) ? readdirSync(folder).filter((name) => name.toLowerCase().endsWith(".w3x")) : [];
    if (found.length === 1) return { map: join(folder, found[0]!), rest: args };
  }
  return "no map: give the .w3x you downloaded as the first argument";
}

/** The play command's own arguments for the native window over the player's own art. */
export const playerArguments = (map: string, rest: readonly string[]) => ["--standalone", "--window", "native", "--player-assets-only", "--map", map, ...rest];
