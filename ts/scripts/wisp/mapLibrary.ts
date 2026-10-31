import { copyFileSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from "node:fs";
import { basename, isAbsolute, join, relative, resolve } from "node:path";
import { documentsFolder } from "wisp/scripts/warcraft/battleNet";
import { PLAYABLE_FILE, parseInstalled } from "./greenBuilds";
import { PLAYTEST_PREFIX } from "./project";

export const LIBRARY_FOLDER = "Maps/00-Smashcraft";
export const MAP_FOLDER = "00-Smashcraft";
export const OLD_FOLDER = "old";

export const library = (documents: string) => {
  if (!isAbsolute(documents)) throw new Error(`documents folder must be absolute: ${JSON.stringify(documents)}`);
  return join(documents, LIBRARY_FOLDER);
};

export const tomsLibrary = () => library(documentsFolder(PLAYTEST_PREFIX));

export const insideTomsLibrary = (path: string) => {
  const from = relative(tomsLibrary(), resolve(path));
  return from === "" || (!from.startsWith("..") && !isAbsolute(from));
};

export const RELEASE_FILE = /^(?:Mak'gora|Smashcraft) \d+\.\d+(?:\.\d+)?\.w3x$/;
const DEV_FILE = (file: string) => parseInstalled(file)?.build !== undefined;
const KEPT_FILE = (file: string) => PLAYABLE_FILE.test(file) && !DEV_FILE(file);

function place(documents: string, map: string): { root: string; name: string } {
  const name = basename(map);
  const root = library(documents);
  mkdirSync(root, { recursive: true });
  const staged = join(root, `${name}.${process.pid}.next`);
  copyFileSync(map, staged);
  renameSync(staged, join(root, name));
  return { root, name };
}

const files = (root: string) => (existsSync(root) ? readdirSync(root).filter((entry) => statSync(join(root, entry)).isFile()) : []);

const remove = (root: string, entries: readonly string[]) => {
  for (const entry of entries) rmSync(join(root, entry), { force: true });
};

const releaseRank = (file: string) => {
  const { version, candidate } = parseInstalled(file) ?? { version: [0, 0, 0] as const, candidate: undefined };
  return [...version, candidate ?? Infinity];
};

const devRank = (file: string) => {
  const { version, build } = parseInstalled(file) ?? { version: [0, 0, 0] as const, build: undefined };
  return [...version, build ?? 0];
};

const newerFirst = (rank: (file: string) => readonly number[]) => (a: string, b: string) =>
  rank(b).reduce((order, part, index) => order !== 0 ? order : part - (rank(a)[index] ?? 0), 0);

export interface Tidy {
  readonly remove: readonly string[];
  readonly archive: readonly string[];
}

export function pendingTidy(documents: string): Tidy {
  const root = library(documents);
  return {
    remove: files(root).filter(DEV_FILE).sort(newerFirst(devRank)).slice(1),
    archive: files(root).filter(KEPT_FILE).sort(newerFirst(releaseRank)).slice(1),
  };
}

export function tidyLibrary(documents: string): Tidy {
  const root = library(documents);
  const pending = pendingTidy(documents);
  remove(root, pending.remove);
  if (pending.archive.length > 0) mkdirSync(join(root, OLD_FOLDER), { recursive: true });
  for (const entry of pending.archive) renameSync(join(root, entry), join(root, OLD_FOLDER, entry));
  return pending;
}

/** With `held` set a client may have the old maps open, so the new file is only added and the tidy waits for `tidyLibrary`. */
export function installLatest(documents: string, map: string, held = false): void {
  if (!PLAYABLE_FILE.test(basename(map))) throw new Error(`not a playable map: ${basename(map)}`);
  const { root, name } = place(documents, map);
  if (held) return;
  if (DEV_FILE(name)) remove(root, files(root).filter((entry) => entry !== name && !KEPT_FILE(entry)));
  tidyLibrary(documents);
}

export function installTryout(documents: string, map: string): string {
  if (PLAYABLE_FILE.test(basename(map))) throw new Error(`a main build installs through installLatest: ${basename(map)}`);
  const { root, name } = place(documents, map);
  remove(root, files(root).filter((entry) => entry !== name && entry.endsWith(".w3x") && !PLAYABLE_FILE.test(entry)));
  return join(root, name);
}

const newest = (entries: readonly string[]) => [...entries].sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))[0];

export const installedMaps = (documents: string): string[] => files(library(documents));

export function newestPlayable(documents: string): { folder: string; file: string } | undefined {
  const installed = installedMaps(documents);
  const file = newest(installed.filter((entry) => RELEASE_FILE.test(entry))) ?? newest(installed.filter((entry) => PLAYABLE_FILE.test(entry)));
  return file === undefined ? undefined : { folder: MAP_FOLDER, file };
}
