import { join } from "node:path";
import { Effect } from "effect";
import { CaptureQueueFailure, git } from "./captureQueue";

/** Where a capture serve runs its tools from: a repository root and its `ts` folder. */
export interface Checkout { readonly root: string; readonly ts: string }

/** A detached worktree of `from`'s HEAD at `into` that the serve owns until its scope closes, so a lane that lands and removes the checkout the serve started in can't pull the working directory out from under the batch, pool and lease commands it spawns. */
export const servingCheckout = (from: string, into: string) => Effect.acquireRelease(
  Effect.gen(function*() {
    const common = (yield* git(from, ["rev-parse", "--path-format=absolute", "--git-common-dir"])).out;
    yield* git(from, ["worktree", "add", "--detach", into, "HEAD"]);
    const ts = join(into, "ts");
    const install = Bun.spawnSync(["bun", "install", "--frozen-lockfile"], { cwd: ts, stdin: "ignore", stdout: "ignore", stderr: "pipe" });
    if (install.exitCode !== 0) {
      yield* git(common, ["worktree", "remove", "--force", into], true);
      return yield* new CaptureQueueFailure({ problem: `bun install in the serve's checkout ${into}: ${install.stderr.toString().trim()}` });
    }
    return { root: into, ts, common };
  }),
  ({ root, common }) => git(common, ["worktree", "remove", "--force", root], true).pipe(Effect.ignore),
).pipe(Effect.map(({ root, ts }): Checkout => ({ root, ts })));
