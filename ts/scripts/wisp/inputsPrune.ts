import { existsSync, lstatSync, readdirSync, readlinkSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { removeTree } from "./buildInputs";

export const DERIVE_LEASE_SECONDS = 3600;

const LAYOUT = new Set(["store", "derive", "locks"]);

export interface Hold { readonly path: string; readonly reason: string }

export interface Pruning { readonly removed: readonly string[]; readonly refused: readonly Hold[] }

const inside = (parent: string, path: string) => {
  const away = relative(parent, path);
  return away === "" || !away.startsWith("..") && !away.startsWith("/");
};

export function openPaths(): Hold[] {
  const paths: Hold[] = [];
  for (const pid of readdirSync("/proc").filter((entry) => /^\d+$/.test(entry))) {
    const links = [join("/proc", pid, "cwd")];
    try { for (const fd of readdirSync(join("/proc", pid, "fd"))) links.push(join("/proc", pid, "fd", fd)); } catch {}
    for (const link of links) try { paths.push({ path: readlinkSync(link), reason: `is open in process ${pid}` }); } catch {}
  }
  return paths;
}

export function pruneInputs(root: string, scratch: readonly string[], holds: readonly Hold[], now = Date.now()): Pruning {
  const removed: string[] = [], refused: Hold[] = [];
  const held = (path: string) => holds.find((hold) => inside(path, hold.path))?.reason;
  const runs = join(root, "derive");
  for (const run of existsSync(runs) ? readdirSync(runs).filter((name) => name.startsWith("run-")).map((name) => join(runs, name)) : []) {
    if ((now - lstatSync(run).mtimeMs) / 1000 < DERIVE_LEASE_SECONDS || held(run) !== undefined) continue;
    removeTree(run);
    removed.push(run);
  }
  for (const name of scratch) {
    const path = join(root, name), stat = lstatSync(path, { throwIfNoEntry: false });
    const reason = basename(name) !== name || dirname(path) !== root ? "is not a folder directly under the build-inputs root"
      : LAYOUT.has(name) ? "is part of the build-inputs layout"
      : stat?.isDirectory() !== true ? "is not a folder"
      : held(path);
    if (reason !== undefined) { refused.push({ path, reason }); continue; }
    removeTree(path);
    removed.push(path);
  }
  return { removed, refused };
}
