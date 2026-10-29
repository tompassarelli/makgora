#!/usr/bin/env bun
// Git's post-checkout, post-merge and post-rewrite hooks; it runs before ts/node_modules exists, so it imports nothing from it.
import { lstatSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const fileCheckout = args.length === 3 && args[2] === "0";
if (fileCheckout || args[0] === "amend") process.exit(0);

const top = Bun.spawnSync(["git", "rev-parse", "--show-toplevel"]).stdout.toString().trim();
const project = resolve(top, "ts");
const modules = resolve(project, "node_modules");
const linked = (() => {
  try {
    return lstatSync(modules).isSymbolicLink();
  } catch {
    return false;
  }
})();
if (linked) unlinkSync(modules);

const install = Bun.spawnSync(["bun", "install", "--frozen-lockfile"], { cwd: project, stdout: "ignore", stderr: "pipe" });
// A hook's exit status becomes git checkout's, so a failed install warns rather than changing what git reports.
if (install.exitCode !== 0) {
  process.stderr.write(install.stderr);
  console.error(`\`bun install --frozen-lockfile\` failed in ${project}; run it there before \`bun run check\``);
}
