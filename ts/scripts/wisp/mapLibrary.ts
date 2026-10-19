import { copyFileSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync } from "node:fs";
import { basename, isAbsolute, join, relative, resolve } from "node:path";
import { documentsFolder } from "wisp/scripts/warcraft/battleNet";
import { PLAYABLE_FILE } from "./greenBuilds";
import { PLAYTEST_PREFIX } from "./project";

export const LIBRARY_FOLDER = "Maps/00-Smashcraft";

export const library = (documents: string) => {
  if (!isAbsolute(documents)) throw new Error(`documents folder must be absolute: ${JSON.stringify(documents)}`);
  return join(documents, LIBRARY_FOLDER);
};

export const tomsLibrary = () => library(documentsFolder(PLAYTEST_PREFIX));

export const insideTomsLibrary = (path: string) => {
  const from = relative(tomsLibrary(), resolve(path));
  return from === "" || (!from.startsWith("..") && !isAbsolute(from));
};

export const RELEASE_FILE = /^Smashcraft \d+\.\d+\.\d+\.w3x$/;
export type Shelf = "releases" | "dev";
export const shelfOf = (file: string): Shelf => (RELEASE_FILE.test(file) ? "releases" : "dev");
export const shelfFolder = (file: string) => `00-Smashcraft/${shelfOf(file)}`;

function place(documents: string, map: string): { root: string; name: string } {
  const name = basename(map);
  const root = join(library(documents), shelfOf(name));
  mkdirSync(root, { recursive: true });
  const staged = join(root, `${name}.${process.pid}.next`);
  copyFileSync(map, staged);
  renameSync(staged, join(root, name));
  return { root, name };
}

const remove = (root: string, entries: readonly string[]) => {
  for (const entry of entries) rmSync(join(root, entry), { recursive: true, force: true });
};

export function installLatest(documents: string, map: string): void {
  if (!PLAYABLE_FILE.test(basename(map))) throw new Error(`not a playable map: ${basename(map)}`);
  const { root, name } = place(documents, map);
  if (shelfOf(name) === "dev") remove(root, readdirSync(root).filter((entry) => entry !== name));
}

export function installTryout(documents: string, map: string): string {
  if (PLAYABLE_FILE.test(basename(map))) throw new Error(`a main build installs through installLatest: ${basename(map)}`);
  const { root, name } = place(documents, map);
  remove(root, readdirSync(root).filter((entry) => entry !== name && !PLAYABLE_FILE.test(entry)));
  return join(root, name);
}

const newest = (entries: readonly string[]) => entries.filter((entry) => PLAYABLE_FILE.test(entry)).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))[0];

export const installedMaps = (documents: string): string[] => (["releases", "dev"] as const)
  .flatMap((shelf) => { const root = join(library(documents), shelf); return existsSync(root) ? readdirSync(root) : []; });

export function newestPlayable(documents: string): { folder: string; file: string } | undefined {
  for (const shelf of ["releases", "dev"] as const) {
    const root = join(library(documents), shelf);
    const file = existsSync(root) ? newest(readdirSync(root)) : undefined;
    if (file !== undefined) return { folder: `00-Smashcraft/${shelf}`, file };
  }
  return undefined;
}
