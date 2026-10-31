import { copyFileSync, mkdtempSync, rmSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { MapBuildFailure } from "wisp/scripts/wisp/mapBuild";
import { captureProcess } from "wisp/scripts/wisp/hostProcess";
import { mapReuseKey } from "wisp/scripts/wisp/mapReuse";

const git = (cwd: string, args: readonly string[], env: Record<string, string> = {}) =>
  captureProcess(`git ${args[0]}`, cwd, ["git", ...args], { cwd, env: { ...process.env as Record<string, string>, ...env } }).pipe(
    Effect.flatMap(({ exitCode, stdout, stderr }) => exitCode === 0
      ? Effect.succeed(stdout.trim())
      : Effect.fail(new MapBuildFailure({ operation: `git ${args.join(" ")}`, path: cwd, cause: stderr.trim() }))),
  );

/** The tree of the checkout as it is on disk (tracked and untracked files, ignored ones left out), the same whether or not it is committed; it holds ts/wisp.lock, the build-input pins and the sources. */
const workingTree = (cwd: string) => Effect.acquireUseRelease(
  Effect.try({ try: () => mkdtempSync(join(tmpdir(), "smashcraft-key-")), catch: (cause) => new MapBuildFailure({ operation: "make the key's scratch index", path: tmpdir(), cause }) }),
  (scratch) => Effect.gen(function*() {
    const index = join(scratch, "index");
    // An index dated 1970 makes git treat every entry as racily clean and hash its file, so a same-size edit within one timestamp tick is still seen.
    const source = yield* git(cwd, ["rev-parse", "--path-format=absolute", "--git-path", "index"]);
    yield* Effect.try({ try: () => { copyFileSync(source, index); utimesSync(index, 1, 1); }, catch: (cause) => new MapBuildFailure({ operation: "copy the git index", path: source, cause }) });
    yield* git(cwd, ["add", "--all", "."], { GIT_INDEX_FILE: index });
    return yield* git(cwd, ["write-tree"], { GIT_INDEX_FILE: index });
  }),
  (scratch) => Effect.sync(() => rmSync(scratch, { recursive: true, force: true })),
);

/** The key of `map build ARGS`: its checkout's working tree and every argument but where the map goes (the profile and edition are among them). */
export const mapBuildKey = (cwd: string, args: readonly string[]) => workingTree(cwd).pipe(
  Effect.map((tree) => {
    const output = args.indexOf("--out");
    const inputs = output < 0 ? args : args.filter((_, index) => index !== output && index !== output + 1);
    return mapReuseKey({ tree, args: inputs.join("\0") });
  }),
);
