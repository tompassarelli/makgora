import { chmodSync, copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Effect } from "effect";
import { ChildProcess } from "effect/process";
import { runProcess } from "./hostProcess";
import { playerReadme } from "./playerArguments";
import { projectRoot } from "./wisp/projectRoot";
import { playName } from "./wisp/currentPlaytest";

const EXE = process.platform === "win32" ? ".exe" : "";
const WISP_WINDOW = join(import.meta.dir, "../node_modules/wisp/host/window");
const ENTRYPOINTS = [join(import.meta.dir, "player.ts"), join(import.meta.dir, "wisp/nativeGame.ts"), join(WISP_WINDOW, "simWorker.ts")];

function option(args: readonly string[], name: string): string {
  const at = args.indexOf(`--${name}`);
  const value = args[at + 1];
  if (at < 0 || value === undefined) throw new Error(`playerBuild needs --${name}`);
  return value;
}

const build = (args: readonly string[]) => Effect.gen(function*() {
  const commit = option(args, "commit");
  if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error("playerBuild needs --commit with a full commit hash");
  const version = yield* playName(commit, projectRoot);
  if (args.includes("--name-only")) return console.log(version);
  const out = resolve(option(args, "out")), library = resolve(option(args, "library")), tools = resolve(option(args, "tools"));
  if (!existsSync(library)) throw new Error(`no window library at ${library}`);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  yield* runProcess(ChildProcess.make("bun", ["build", "--compile", "--external", "pnpapi", "--entry-naming", "[name].[ext]", "--define", `PLAYER_COMMIT=${JSON.stringify(commit)}`, "--define", `PLAYER_VERSION=${JSON.stringify(version)}`, ...ENTRYPOINTS, "--outfile", join(out, `smashcraft-play${EXE}`)], { stdout: "pipe", stderr: "pipe" }));
  copyFileSync(library, join(out, basename(library)));
  for (const tool of readdirSync(tools)) {
    copyFileSync(join(tools, tool), join(out, tool));
    chmodSync(join(out, tool), 0o755);
  }
  copyFileSync(join(import.meta.dir, "../node_modules/wisp/src/natives/warcraft.d.ts"), join(out, "warcraft.d.ts"));
  writeFileSync(join(out, "README.txt"), playerReadme(version, EXE));
  console.log(`player package: ${out}`);
});

BunRuntime.runMain(build(process.argv.slice(2)).pipe(Effect.provide(BunServices.layer)));
