import { expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { git as gitEffect } from "../scripts/captureQueue";
import { servingCheckout } from "../scripts/captureQueueCheckout";

const git = (repo: string, args: readonly string[]) => Effect.runSync(gitEffect(repo, args));

test("a capture serve keeps spawning its tools after the lane checkout it started in is removed, from a checkout it owns and removes when it ends [k1 scenario]", async () => {
  const root = mkdtempSync(join(tmpdir(), "capture-serve-checkout-"));
  try {
    const repo = join(root, "main"), lane = join(root, "lane"), owned = join(root, "serve");
    mkdirSync(join(repo, "ts"), { recursive: true });
    git(repo, ["init", "-q", "-b", "main"]);
    writeFileSync(join(repo, "ts/package.json"), `${JSON.stringify({ name: "serve-checkout", private: true })}\n`);
    expect(Bun.spawnSync(["bun", "install"], { cwd: join(repo, "ts"), stdout: "ignore", stderr: "ignore" }).exitCode).toBe(0);
    git(repo, ["add", "ts"]);
    git(repo, ["commit", "-q", "-m", "base"]);
    git(repo, ["worktree", "add", "-q", "--detach", lane, "HEAD"]);
    const ran = await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const checkout = yield* servingCheckout(lane, owned);
      git(repo, ["worktree", "remove", "--force", lane]);
      const child = Bun.spawn([process.execPath, "-e", "process.stdout.write(process.cwd())"], { cwd: checkout.ts, stdout: "pipe" });
      return { cwd: yield* Effect.promise(() => new Response(child.stdout).text()), code: yield* Effect.promise(() => child.exited), ts: checkout.ts };
    })));
    expect(ran).toEqual({ cwd: join(owned, "ts"), code: 0, ts: join(owned, "ts") });
    expect(existsSync(owned)).toBe(false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
