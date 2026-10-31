import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Effect } from "effect";
import { ChildProcess } from "effect/process";
import { runProcess } from "./hostProcess";

const EXE = process.platform === "win32" ? ".exe" : "";
const WISP_WINDOW = join(import.meta.dir, "../node_modules/wisp/host/window");
const ENTRYPOINTS = [join(import.meta.dir, "player.ts"), join(import.meta.dir, "wisp/nativeGame.ts"), join(WISP_WINDOW, "simWorker.ts")];

const README = (version: string) => `Mak'gora ${version}

Run smashcraft-play${EXE} with the .w3x map you downloaded:

  smashcraft-play${EXE} Makgora.w3x                         play offline against the computer
  smashcraft-play${EXE} Makgora.w3x --host --relay REGION   host an online match through the relay
  smashcraft-play${EXE} Makgora.w3x --join CODE             join a match by its code

The art comes from your own Warcraft III: Reforged install (add --storage DIR if it is not found) and the map you give it.
Controllers work through SDL3. Nothing else needs installing.
`;

function option(args: readonly string[], name: string): string {
  const at = args.indexOf(`--${name}`);
  const value = args[at + 1];
  if (at < 0 || value === undefined) throw new Error(`playerBuild needs --${name}`);
  return value;
}

const build = (args: readonly string[]) => Effect.gen(function*() {
  const out = resolve(option(args, "out")), library = resolve(option(args, "library")), tools = resolve(option(args, "tools")), commit = option(args, "commit");
  if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error("playerBuild needs --commit with a full commit hash");
  if (!existsSync(library)) throw new Error(`no window library at ${library}`);
  const version = readFileSync(join(import.meta.dir, "../../map-version"), "utf8").trim();
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  yield* runProcess(ChildProcess.make("bun", ["build", "--compile", "--external", "pnpapi", "--entry-naming", "[name].[ext]", "--define", `PLAYER_COMMIT=${JSON.stringify(commit)}`, "--define", `PLAYER_VERSION=${JSON.stringify(version)}`, ...ENTRYPOINTS, "--outfile", join(out, `smashcraft-play${EXE}`)], { stdout: "pipe", stderr: "pipe" }));
  copyFileSync(library, join(out, basename(library)));
  for (const tool of readdirSync(tools)) {
    copyFileSync(join(tools, tool), join(out, tool));
    chmodSync(join(out, tool), 0o755);
  }
  writeFileSync(join(out, "README.txt"), README(version));
  console.log(`player package: ${out}`);
});

BunRuntime.runMain(build(process.argv.slice(2)).pipe(Effect.provide(BunServices.layer)));
