import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { landedOnMain, repoGit } from "../scripts/autolandLanded";

const scratch: string[] = [];
afterEach(() => { for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true }); });

const fixture = () => {
  const dir = mkdtempSync(join(tmpdir(), "landed-"));
  scratch.push(dir);
  const git = repoGit(dir);
  const run = (...args: string[]) => { if (git(args) === undefined) throw new Error(`git ${args.join(" ")} failed`); };
  const commit = (path: string, text: string, message: string) => {
    writeFileSync(join(dir, path), text);
    run("add", "-A");
    run("-c", "user.name=fixture", "-c", "user.email=fixture@example.invalid", "-c", "commit.gpgsign=false", "commit", "-qm", message);
  };
  run("init", "-q", "-b", "main");
  commit("app.txt", "alpha\nbeta\ngamma\n", "base");
  run("branch", "lane");
  const lane = (text: string) => { run("checkout", "-q", "lane"); commit("app.txt", text, "lane change"); run("checkout", "-q", "main"); };
  return { git, commit, lane };
};

test("a lane rebased and landed by hand is landed by tree even though its commits are not ancestors [k1 scenario]", () => {
  const { git, commit, lane } = fixture();
  lane("alpha\nbeta changed\ngamma\n");
  commit("other.txt", "unrelated\n", "main moves");
  commit("app.txt", "alpha\nbeta changed\ngamma\n", "land rebased copy");
  expect(landedOnMain(git, "main", "lane")).toBe("tree already on main");
});

test("a landed lane whose lines main later rewrote is superseded [k1 scenario]", () => {
  const { git, commit, lane } = fixture();
  lane("alpha\nbeta changed\ngamma\n");
  commit("other.txt", "unrelated\n", "main moves");
  commit("app.txt", "alpha\nbeta changed\ngamma\n", "lane change");
  commit("app.txt", "alpha\nbeta changed twice\ngamma\n", "later rewrite of the same line");
  expect(landedOnMain(git, "main", "lane")).toBe("superseded on main");
});

test("a lane main never held is unlanded when main edits other lines [k1 scenario]", () => {
  const { git, commit, lane } = fixture();
  lane("alpha\nbeta\ngamma\ndelta\n");
  commit("app.txt", "alpha\nbeta two\ngamma\n", "lane change");
  expect(landedOnMain(git, "main", "lane")).toBeUndefined();
});

test("a lane whose deletion main kept is unlanded [k1 scenario]", () => {
  const { git, commit, lane } = fixture();
  lane("alpha\ngamma\n");
  commit("app.txt", "alpha\nbeta\ngamma\nzeta\n", "lane change");
  expect(landedOnMain(git, "main", "lane")).toBeUndefined();
});

test("a lane adding a line main already has elsewhere in the file is unlanded [k1 scenario]", () => {
  const { git, commit, lane } = fixture();
  lane("alpha\nbeta\nbeta\ngamma\n");
  commit("app.txt", "alpha\nbeta\ngamma\nzeta\n", "lane change");
  expect(landedOnMain(git, "main", "lane")).toBeUndefined();
});

test("lines superseded on main without the lane's commit message are unlanded [k1 scenario]", () => {
  const { git, commit, lane } = fixture();
  lane("alpha\nbeta changed\ngamma\n");
  commit("app.txt", "alpha\nbeta changed\ngamma\n", "an unrelated message");
  commit("app.txt", "alpha\nbeta changed twice\ngamma\n", "later rewrite of the same line");
  expect(landedOnMain(git, "main", "lane")).toBeUndefined();
});

test("a main commit with the lane's subject but other paths does not carry the lane [k1 scenario]", () => {
  const { git, commit, lane } = fixture();
  lane("alpha\nbeta changed\ngamma\n");
  commit("other.txt", "unrelated\n", "lane change");
  commit("app.txt", "alpha\nbeta changed\ngamma\n", "an unrelated message");
  commit("app.txt", "alpha\nbeta changed twice\ngamma\n", "later rewrite of the same line");
  expect(landedOnMain(git, "main", "lane")).toBeUndefined();
});
