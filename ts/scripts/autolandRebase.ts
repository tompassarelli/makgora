import { execFileSync } from "node:child_process";
import type { Resolution } from "./autolandCore";

export interface Stages { readonly path: string; readonly base: string; readonly ours: string; readonly theirs: string }
export interface Rebased { readonly ok: boolean; readonly why: string; readonly files: string; readonly resolved: string }

const ROUNDS = 20;

export interface Ran { readonly ok: boolean; readonly out: string; readonly err: string }

export function run(cwd: string, command: string, ...args: string[]): Ran {
  try {
    const out = execFileSync(command, args, { cwd, encoding: "utf8", maxBuffer: 1 << 28, env: { ...process.env, GIT_EDITOR: "true" }, stdio: ["ignore", "pipe", "pipe"] });
    return { ok: true, out, err: "" };
  } catch (failure) {
    const { stdout, stderr } = failure as { stdout?: string; stderr?: string };
    return { ok: false, out: stdout ?? "", err: stderr ?? "" };
  }
}

const git = (repo: string, ...args: string[]): Ran => run(repo, "git", ...args);

const stage = (repo: string, number: number, path: string): string => git(repo, "show", `:${number}:${path}`).out;

export interface Rebase {
  readonly repo: string;
  readonly onto: string;
  readonly resolve: (stages: readonly Stages[]) => Promise<{ readonly resolution: Resolution; readonly note: string }>;
  readonly regenerate: (paths: readonly string[]) => string | undefined;
}

export async function rebaseLane({ repo, onto, resolve, regenerate }: Rebase): Promise<Rebased> {
  const first = git(repo, "rebase", "-q", onto);
  if (first.ok) return { ok: true, why: "", files: "", resolved: "" };
  const conflicted: string[] = [];
  const resolved: string[] = [];
  const code: string[] = [];
  let why = `the rebase stopped without a file conflict: ${(first.out + first.err).trim().split("\n").slice(-3).join(" ")}`;
  let done = false;
  for (let round = 0; round < ROUNDS && !done; round++) {
    const files = git(repo, "diff", "--name-only", "--diff-filter=U").out.split("\n").filter(Boolean);
    if (files.length === 0) break;
    conflicted.push(...files);
    const stages = files.map((path) => ({ path, base: stage(repo, 1, path), ours: stage(repo, 2, path), theirs: stage(repo, 3, path) }));
    const { resolution, note } = await resolve(stages);
    if (!resolution.resolve) { why = resolution.why; break; }
    for (const path of [...resolution.reports, ...resolution.code]) git(repo, "checkout", "-q", "--ours", "--", path);
    code.push(...resolution.code);
    git(repo, "add", "--", ...files);
    resolved.push(note);
    done = git(repo, "rebase", "--continue").ok;
    if (done) why = "";
  }
  const outcome = (): Rebased => ({ ok: why === "", why, files: conflicted.length > 0 ? [...new Set(conflicted)].join(" ") : why, resolved: resolved.join("; ") });
  if (why !== "") { git(repo, "rebase", "--abort"); return outcome(); }
  const failed = code.length > 0 ? regenerate([...new Set(code)]) : undefined;
  if (failed !== undefined) { why = failed; git(repo, "reset", "-q", "--hard"); }
  return outcome();
}
