import { execFileSync } from "node:child_process";

export type Git = (args: readonly string[]) => string | undefined;
export type Landed = "tree already on main" | "superseded on main";

interface Lines { readonly added: string[]; readonly removed: string[] }

const PATH_CHUNK = 400;
const meaningful = (line: string): boolean => /\w/.test(line);
const chunks = <T>(items: readonly T[], size: number): T[][] => Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));
const nulPaths = (output: string): string[] => output.split("\0").filter(Boolean);

export const parsePatch = (patch: string): Map<string, Lines> => {
  const files = new Map<string, Lines>();
  let current: Lines | undefined;
  let inHeader = false;
  for (const line of patch.split("\n")) {
    if (line.startsWith("diff --git ")) {
      const rest = line.slice("diff --git ".length);
      const path = rest.slice(2, 2 + Math.floor((rest.length - 5) / 2));
      current = files.get(path) ?? { added: [], removed: [] };
      files.set(path, current);
      inHeader = true;
    } else if (line.startsWith("@@")) inHeader = false;
    else if (current !== undefined && !inHeader && line.startsWith("+")) current.added.push(line.slice(1).trim());
    else if (current !== undefined && !inHeader && line.startsWith("-")) current.removed.push(line.slice(1).trim());
  }
  return files;
};

const commits = (log: string): { subject: string; files: Set<string> }[] => log.split("\x01").filter((entry) => entry.trim() !== "").map((entry) => {
  const [subject = "", ...files] = entry.split("\n");
  return { subject, files: new Set(files.filter(Boolean)) };
});

export const landedOnMain = (git: Git, base: string, tip: string): Landed | undefined => {
  const mergeBase = git(["merge-base", base, tip])?.trim();
  if (mergeBase === undefined || mergeBase === "") return undefined;
  const changedOut = git(["diff", "--name-only", "-z", "--no-renames", mergeBase, tip]);
  if (changedOut === undefined || changedOut.includes("\uFFFD")) return undefined;
  const changed = nulPaths(changedOut);
  if (changed.length === 0) return "tree already on main";
  const open: string[] = [];
  for (const part of chunks(changed, PATH_CHUNK)) {
    const out = git(["diff", "--name-only", "-z", "--no-renames", base, tip, "--", ...part]);
    if (out === undefined) return undefined;
    open.push(...nulPaths(out));
  }
  if (open.length === 0) return "tree already on main";
  const branch = new Map<string, Lines>();
  const main = new Map<string, Lines>();
  for (const part of chunks(open, PATH_CHUNK)) {
    parsePatch(git(["diff", "-U0", "--no-color", "--no-renames", mergeBase, tip, "--", ...part]) ?? "").forEach((lines, path) => branch.set(path, lines));
    parsePatch(git(["log", "-p", "-U0", "--no-color", "--no-renames", "--format=", `${mergeBase}..${base}`, "--", ...part]) ?? "").forEach((lines, path) => main.set(path, lines));
  }
  for (const path of open) {
    const mine = branch.get(path);
    if (mine === undefined || !(mine.added.some(meaningful) || mine.removed.some(meaningful))) return undefined;
    const spec = `${base}:${path}`;
    const shown = git(["show", spec]);
    if (shown === undefined && git(["cat-file", "-e", spec]) !== undefined) return undefined;
    const current = new Set((shown ?? "").split("\n").map((line) => line.trim()));
    const later = new Set(main.get(path)?.added ?? []);
    if (!mine.added.filter(meaningful).every((line) => later.has(line))) return undefined;
    if (!mine.removed.filter(meaningful).every((line) => !current.has(line) || later.has(line))) return undefined;
  }
  const onMainLog = git(["log", "--format=%x01%s", "--name-only", "--no-renames", `${mergeBase}..${base}`]);
  const laneLog = git(["log", "--format=%x01%s", "--name-only", "--no-renames", `${mergeBase}..${tip}`]);
  if (onMainLog === undefined || laneLog === undefined) return undefined;
  const onMain = commits(onMainLog);
  const carried = commits(laneLog).every((commit) => onMain.some((landed) => landed.subject === commit.subject && [...commit.files].every((file) => landed.files.has(file))));
  return carried ? "superseded on main" : undefined;
};

export const repoGit = (cwd: string): Git => (args) => {
  try {
    return execFileSync("git", ["-c", "core.quotePath=false", "--literal-pathspecs", ...args], { cwd, encoding: "utf8", maxBuffer: 1 << 28, stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return undefined;
  }
};

if (import.meta.main) {
  const [base, tip] = process.argv.slice(2);
  if (base === undefined || tip === undefined) {
    console.error("usage: autolandLanded.ts BASE TIP");
    process.exit(2);
  }
  const verdict = landedOnMain(repoGit(process.cwd()), base, tip);
  if (verdict === undefined) process.exit(1);
  console.log(verdict);
}
