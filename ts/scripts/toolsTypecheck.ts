import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const run = Bun.spawnSync(
  ["bun", resolve(root, "node_modules/typescript-native/bin/tsc"), "-p", "tsconfig.tools.json", "--pretty", "false"],
  { cwd: root, stdout: "pipe", stderr: "inherit" },
);

const diagnostic = /^\S.*error TS\d+/;
const reported: string[] = [];
let vendored = false;
for (const line of run.stdout.toString().split("\n")) {
  if (diagnostic.test(line)) vendored = line.includes("node_modules/");
  if (line !== "" && !vendored) reported.push(line);
}

if (reported.length > 0) {
  console.error(reported.join("\n"));
  process.exit(1);
}
if (run.exitCode !== 0 && !run.stdout.toString().includes("error TS")) {
  console.error(`tools typecheck exited ${run.exitCode} without a diagnostic`);
  process.exit(1);
}
