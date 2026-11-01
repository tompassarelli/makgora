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

/** What `--version` prints: the build name the build stamped in (the name play-current gives the same commit), else the product name alone for a source run. */
export const playerVersion = (stamped: string | undefined) => stamped ?? `${PRODUCT} dev`;

export const playerReadme = (name: string, exe: string) => `${name}

Run smashcraft-play${exe} with the .w3x map you downloaded:

  smashcraft-play${exe} Makgora.w3x                         play offline against the computer
  smashcraft-play${exe} Makgora.w3x --host --relay REGION   host an online match through the relay
  smashcraft-play${exe} Makgora.w3x --join CODE             join a match by its code

The art comes from your own Warcraft III: Reforged install (add --storage DIR if it is not found) and the map you give it.
Controllers work through SDL3. Nothing else needs installing.
`;
