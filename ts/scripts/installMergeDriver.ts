import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Data, Effect } from "effect";

class MergeDriverFailure extends Data.TaggedError("MergeDriverFailure")<{ readonly key: string; readonly problem: string }> {}

const NAME = "per-entry merge of generated files";
const DRIVER = 'f=ts/scripts/mergeGenerated.ts; if [ -f "$f" ]; then bun "$f" %O %A %B %P; else git merge-file -L ours -L base -L theirs %A %O %B; fi';

const git = (...args: string[]) => Effect.sync(() => Bun.spawnSync(["git", ...args], { stdin: "ignore", stdout: "pipe", stderr: "pipe" }));

const ensure = (key: string, value: string) => Effect.gen(function*() {
  const held = yield* git("config", "--get", key);
  if (held.exitCode === 0 && held.stdout.toString().trimEnd() === value) return;
  const wrote = yield* git("config", key, value);
  if (wrote.exitCode !== 0) return yield* new MergeDriverFailure({ key, problem: wrote.stderr.toString().trim() });
});

const main = ensure("merge.makgora-generated.name", NAME).pipe(Effect.andThen(ensure("merge.makgora-generated.driver", DRIVER)));

if (import.meta.main) BunRuntime.runMain(main.pipe(Effect.provide(BunServices.layer)));
