import { expect, test } from "bun:test";
import { cpSync, lstatSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const HOOKS = resolve(import.meta.dir, "../../.githooks");

const run = (cwd: string, ...argv: string[]) => {
  const result = Bun.spawnSync(argv, { cwd, stdout: "pipe", stderr: "pipe" });
  if (result.exitCode !== 0) throw new Error(`${argv.join(" ")} in ${cwd}: ${result.stderr.toString()}`);
  return result.stdout.toString().trim();
};
const git = (cwd: string, ...args: string[]) => run(cwd, "git", "-c", "user.name=lane", "-c", "user.email=lane@example.invalid", ...args);

const writePackage = (directory: string, name: string, body: Record<string, unknown>) => {
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, "package.json"), JSON.stringify({ name, version: "1.0.0", ...body }));
};

const project = (root: string, dependencies: Record<string, string>) => {
  writePackage(join(root, "ts"), "lane-fixture", {
    private: true,
    dependencies,
    scripts: { check: "bun check.ts", test: "bun test.ts" },
  });
  const imports = Object.keys(dependencies).map((name) => `import "${name}";`).join("\n");
  writeFileSync(join(root, "ts/check.ts"), imports);
  writeFileSync(join(root, "ts/test.ts"), imports);
  run(join(root, "ts"), "bun", "install");
};

test("a lane made by git worktree add runs bun run check and bun run test with no install or link step, and after its hand-made node_modules link dangles from a removed lane a rebase onto a new dependency replaces the link with that lane's own install [k5 boundary git-lane-dependencies]", () => {
  const root = mkdtempSync(join(tmpdir(), "smashcraft-lane-deps-"));
  try {
    for (const name of ["first", "second"]) writePackage(join(root, "packages", name), name, { main: "index.js" });
    for (const name of ["first", "second"]) writeFileSync(join(root, "packages", name, "index.js"), "");
    const main = join(root, "main");
    cpSync(HOOKS, join(main, ".githooks"), { recursive: true, verbatimSymlinks: true });
    writeFileSync(join(main, ".gitignore"), "node_modules/\n");
    project(main, { first: `file:${join(root, "packages/first")}` });
    git(main, "init", "-q", "-b", "main");
    git(main, "config", "core.hooksPath", ".githooks");
    git(main, "add", "-A");
    git(main, "commit", "-q", "-m", "first dependency");

    const done = join(root, "done");
    const lane = join(root, "lane");
    git(main, "worktree", "add", "-q", done, "-b", "done");
    git(main, "worktree", "add", "-q", lane, "-b", "lane");
    run(join(lane, "ts"), "bun", "run", "check");
    run(join(lane, "ts"), "bun", "run", "test");
    expect(lstatSync(join(lane, "ts/node_modules")).isSymbolicLink()).toBe(false);

    rmSync(join(lane, "ts/node_modules"), { recursive: true });
    symlinkSync(join(done, "ts/node_modules"), join(lane, "ts/node_modules"));
    git(lane, "commit", "-q", "--allow-empty", "-m", "lane work");
    git(main, "worktree", "remove", "--force", done);
    project(main, { first: `file:${join(root, "packages/first")}`, second: `file:${join(root, "packages/second")}` });
    git(main, "add", "-A");
    git(main, "commit", "-q", "-m", "second dependency");

    git(lane, "rebase", "-q", "main");
    expect(lstatSync(join(lane, "ts/node_modules")).isSymbolicLink()).toBe(false);
    run(join(lane, "ts"), "bun", "run", "check");
    run(join(lane, "ts"), "bun", "run", "test");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
