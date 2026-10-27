import { expect, test } from "bun:test";
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { PLAYABLE_FILE, parseInstalled } from "../scripts/wisp/greenBuilds";
import { playName } from "../scripts/wisp/currentPlaytest";
import { OLD_FOLDER, installLatest, library, pendingTidy } from "../scripts/wisp/mapLibrary";

const git = (repo: string, ...args: string[]) => {
  const run = Bun.spawnSync(["git", "-C", repo, "-c", "user.name=lane", "-c", "user.email=lane@example.invalid", ...args]);
  expect(run.exitCode).toBe(0);
  return run.stdout.toString().trim();
};

const commit = (repo: string, message: string) => git(repo, "commit", "-q", "--allow-empty", "-m", message);
const head = (repo: string) => git(repo, "rev-parse", "HEAD");
const name = (repo: string, revision: string) => Effect.runPromise(playName(revision, repo));

test("a dev build is named for the next release and the first-parent commits since the last release tag, growing with each main commit and ignoring a merged side branch's own commits [k5 boundary git-dev-build-number]", async () => {
  const repo = mkdtempSync(join(tmpdir(), "smashcraft-dev-build-"));
  try {
    git(repo, "init", "-q", "-b", "main");
    commit(repo, "before the release");
    git(repo, "tag", "v0.1.5");
    commit(repo, "first");
    const first = head(repo);
    commit(repo, "second");
    const second = head(repo);
    git(repo, "checkout", "-q", "-b", "side");
    commit(repo, "side one");
    commit(repo, "side two");
    git(repo, "checkout", "-q", "main");
    git(repo, "merge", "-q", "--no-ff", "-m", "merge side", "side");
    const merged = head(repo);
    expect(await name(repo, first)).toBe("Smashcraft 0.2-dev.1");
    expect(await name(repo, second)).toBe("Smashcraft 0.2-dev.2");
    expect(await name(repo, merged)).toBe("Smashcraft 0.2-dev.3");
    expect(await name(repo, "v0.1.5")).toBe("Smashcraft 0.1.5");
    git(repo, "tag", "v0.2");
    expect(await name(repo, head(repo))).toBe("Smashcraft 0.2");
    commit(repo, "after the next release");
    expect(await name(repo, head(repo))).toBe("Smashcraft 0.3-dev.1");
    git(repo, "tag", "v0.3-rc.2");
    expect(await name(repo, head(repo))).toBe("Smashcraft 0.3 RC-2");
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("a dev build file name parses back to its version and number, and a release or candidate file carries no number [k2 property]", () => {
  for (const build of [1, 9, 830, 12345]) {
    expect(parseInstalled(`Smashcraft 0.1.5-dev.${build}.w3x`)).toEqual({ version: [0, 1, 5], build, candidate: undefined });
  }
  expect(parseInstalled("Smashcraft 0.2-dev.830.w3x")).toEqual({ version: [0, 2, 0], build: 830, candidate: undefined });
  expect(parseInstalled("Smashcraft 0.2.w3x")).toEqual({ version: [0, 2, 0], build: undefined, candidate: undefined });
  expect(parseInstalled("Smashcraft 0.1.4.w3x")).toEqual({ version: [0, 1, 4], build: undefined, candidate: undefined });
  expect(parseInstalled("Smashcraft 0.1.5 RC-2.w3x")).toEqual({ version: [0, 1, 5], build: undefined, candidate: 2 });
  expect(PLAYABLE_FILE.exec("Smashcraft 0.1.5-dev c9e5fbd.w3x")).toBeNull();
});

test("installing a dev build leaves the latest release and the newest dev build at the top of the Maps folder and moves older releases to old/ [k5 boundary maps-folder]", () => {
  const documents = mkdtempSync(join(tmpdir(), "smashcraft-maps-folder-"));
  const staging = mkdtempSync(join(tmpdir(), "smashcraft-maps-staging-"));
  const root = library(documents);
  try {
    mkdirSync(root, { recursive: true });
    for (const file of ["Smashcraft 0.1.3.w3x", "Smashcraft 0.1.4.w3x", "Smashcraft 0.1.5.w3x", "Smashcraft 0.1.6-dev.829.w3x", "Smashcraft 0.1.5-dev c9e5fbd.w3x"]) writeFileSync(join(root, file), file);
    const next = join(staging, "Smashcraft 0.2-dev.830.w3x");
    writeFileSync(next, "next");
    installLatest(documents, next);
    expect(readdirSync(root).filter((entry) => entry.endsWith(".w3x")).sort()).toEqual(["Smashcraft 0.1.5.w3x", "Smashcraft 0.2-dev.830.w3x"]);
    expect(readdirSync(join(root, OLD_FOLDER)).sort()).toEqual(["Smashcraft 0.1.3.w3x", "Smashcraft 0.1.4.w3x"]);
    expect(existsSync(join(root, "Smashcraft 0.1.6-dev.829.w3x"))).toBe(false);
    const after = join(staging, "Smashcraft 0.2.w3x");
    writeFileSync(after, "release");
    installLatest(documents, after);
    expect(readdirSync(join(root, OLD_FOLDER)).sort()).toEqual(["Smashcraft 0.1.3.w3x", "Smashcraft 0.1.4.w3x", "Smashcraft 0.1.5.w3x"]);
    writeFileSync(join(root, "Smashcraft 0.1.6-dev.900.w3x"), "old patch line");
    writeFileSync(join(root, "Smashcraft 0.3-dev.2.w3x"), "next minor");
    expect(pendingTidy(documents)).toEqual({ remove: ["Smashcraft 0.2-dev.830.w3x", "Smashcraft 0.1.6-dev.900.w3x"], archive: [] });
  } finally {
    rmSync(documents, { recursive: true, force: true });
    rmSync(staging, { recursive: true, force: true });
  }
});
