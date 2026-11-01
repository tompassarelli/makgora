import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { playerArguments, playerMap, playerReadme, playerVersion } from "../scripts/playerArguments";
import { playName } from "../scripts/wisp/currentPlaytest";

test("the player takes the map from its first .w3x argument and keeps the other flags [k2 property]", () => {
  expect(playerMap(["Makgora.w3x", "--host", "--relay", "eu"], [])).toEqual({ map: "Makgora.w3x", rest: ["--host", "--relay", "eu"] });
  expect(playerArguments("Makgora.w3x", ["--join", "CODE"])).toEqual(["--standalone", "--window", "native", "--player-assets-only", "--map", "Makgora.w3x", "--join", "CODE"]);
});

test("with no map argument the player takes the only .w3x beside it, and refuses none or two [k2 property]", () => {
  const folder = mkdtempSync(join(tmpdir(), "player-map-"));
  expect(typeof playerMap([], [folder])).toBe("string");
  writeFileSync(join(folder, "a.w3x"), "");
  expect(playerMap([], [folder])).toEqual({ map: join(folder, "a.w3x"), rest: [] });
  writeFileSync(join(folder, "b.w3x"), "");
  expect(typeof playerMap([], [folder])).toBe("string");
});

const git = (repo: string, ...args: string[]) => {
  const run = Bun.spawnSync(["git", "-C", repo, "-c", "user.name=lane", "-c", "user.email=lane@example.invalid", ...args]);
  expect(run.exitCode).toBe(0);
  return run.stdout.toString().trim();
};

test("the packaged player reports the build name play-current gives its commit, and its README opens with it [k5 boundary git-player-version]", async () => {
  const repo = mkdtempSync(join(tmpdir(), "smashcraft-player-version-"));
  try {
    git(repo, "init", "-q", "-b", "main");
    git(repo, "commit", "-q", "--allow-empty", "-m", "before the release");
    git(repo, "tag", "v0.2");
    for (const message of ["one", "two", "three"]) git(repo, "commit", "-q", "--allow-empty", "-m", message);
    const named = await Effect.runPromise(playName(git(repo, "rev-parse", "HEAD"), repo));
    expect(named).toBe("Mak'gora 0.3-dev.3");
    expect(playerVersion(named)).toBe(named);
    expect(playerReadme(named, ".exe").split("\n")[0]).toBe(named);
    expect(playerVersion(undefined)).toBe("Mak'gora dev");
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});
