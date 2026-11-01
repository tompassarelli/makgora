import { BunServices } from "@effect/platform-bun";
import { Effect, Schema } from "effect";
import { ChildProcess } from "effect/process";
import { GAME_TITLE } from "../../src/game/ui/title";
import { runProcess } from "../hostProcess";
import { installName } from "./greenBuilds";
import { projectRoot } from "./projectRoot";

export class BuildNameProblem extends Schema.TaggedError<BuildNameProblem, { readonly brand: unique symbol }>()("BuildNameProblem", { problem: Schema.String }) {
  override get message() { return this.problem; }
}

const capture = (cwd: string, [program = "", ...args]: readonly string[]) =>
  runProcess(ChildProcess.make(program, args, { cwd, stdin: "ignore" })).pipe(Effect.orElseSucceed(() => undefined));

export const RELEASE_TAG_PATTERN = "v[0-9]*.[0-9]*";

export function releaseTarget(described: string | undefined): string | undefined {
  const match = /^v(\d+)\.(\d+)(\.\d+)?(-\d+-g[0-9a-f]+)?$/.exec(described?.trim() ?? "");
  if (match === null) return undefined;
  if (match[4] === undefined) return `${match[1]}.${match[2]}${match[3] ?? ""}`;
  return `${match[1]}.${Number(match[2]) + 1}`;
}

export function buildName(tags: readonly string[], target: string, build: number): string {
  if (tags.includes(`v${target}`)) return `${GAME_TITLE} ${target}`;
  const candidates = tags.flatMap((tag) => {
    const [version, number = ""] = tag.slice(1).split("-rc.");
    return tag.startsWith("v") && version === target && /^\d+$/.test(number) ? [Number(number)] : [];
  });
  if (candidates.length > 0) return `${GAME_TITLE} ${target} RC-${Math.max(...candidates)}`;
  return installName(target, build);
}

const tagsAt = (revision: string, repo: string) =>
  capture(repo, ["git", "tag", "--points-at", revision]).pipe(Effect.map((text) => (text ?? "").split("\n").map((tag) => tag.trim()).filter((tag) => tag !== "")));

/** The release `revision` builds toward: its own vX.Y tag (vX.Y.Z on tags before 0.2), else the minor after the newest one it descends from. */
export const playTarget = (revision: string, repo = projectRoot) => Effect.gen(function*() {
  const target = releaseTarget(yield* capture(repo, ["git", "describe", "--tags", "--match", RELEASE_TAG_PATTERN, "--exclude", "v*-*", revision]));
  if (target === undefined) return yield* new BuildNameProblem({ problem: `no vX.Y release tag is reachable from ${revision.slice(0, 12)}` });
  return target;
}).pipe(Effect.provide(BunServices.layer));

/** The first-parent commits `revision` is past the newest release tag it descends from: the number a dev build carries, which only grows along main. */
export const devBuild = (revision: string, repo = projectRoot) => Effect.gen(function*() {
  const tag = (yield* capture(repo, ["git", "describe", "--tags", "--abbrev=0", "--match", RELEASE_TAG_PATTERN, "--exclude", "v*-*", revision]))?.trim();
  const count = tag === undefined ? undefined : (yield* capture(repo, ["git", "rev-list", "--first-parent", "--count", `${tag}..${revision}`]))?.trim();
  if (count === undefined || !/^\d+$/.test(count)) return yield* new BuildNameProblem({ problem: `can't count first-parent commits past the newest release tag for ${revision.slice(0, 12)}` });
  return Number(count);
}).pipe(Effect.provide(BunServices.layer));

export const playName = (revision: string, repo = projectRoot) => Effect.gen(function*() {
  const target = yield* playTarget(revision, repo);
  return buildName(yield* tagsAt(revision, repo), target, yield* devBuild(revision, repo));
}).pipe(Effect.provide(BunServices.layer));
