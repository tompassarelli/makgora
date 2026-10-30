import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import { bundleConfig } from "../../scripts/wisp/bundleConfigs";
import { stockLua } from "../../scripts/wisp/luaRuntimes";

const ts = join(import.meta.dir, "../..");

export const goldenFile = (name: string): string => join(ts, "test/fixtures", name);

export function recordedLines(name: string, actual: readonly string[]): string[] {
  const path = goldenFile(name);
  if (process.env.RECORD_GOLDEN === "1" || !existsSync(path)) writeFileSync(path, `${actual.join("\n")}\n`);
  return readFileSync(path, "utf8").trimEnd().split("\n");
}

export async function luaLines(config: Parameters<typeof bundleConfig>[0], bundle: string, args: readonly string[] = []): Promise<string[]> {
  const compile = Bun.spawnSync([process.execPath, "--bun", "node_modules/typescript-to-lua/dist/tstl.js", "-p", bundleConfig(config)], { cwd: ts, stdout: "pipe", stderr: "pipe" });
  if (compile.exitCode !== 0) throw new Error(`compile ${config}: ${compile.stdout.toString()}${compile.stderr.toString()}`);
  const lua = await Effect.runPromise(stockLua);
  const run = Bun.spawnSync([lua, join(ts, "build", bundle), ...args], { cwd: ts, stdout: "pipe", stderr: "pipe" });
  if (run.exitCode !== 0) throw new Error(`run ${config} in 32-bit Lua: ${run.stdout.toString()}${run.stderr.toString()}`);
  return run.stdout.toString().trimEnd().split("\n");
}
