




import { dirname, join } from "node:path";
import { Effect } from "effect";
import { type Command, UsageFailure, flagValues } from "wisp/scripts/wisp/command";
import { MapBuildFailure } from "wisp/scripts/wisp/mapBuild";
import { runAdmitted } from "../../heavyCapacity";
import { DERIVED_PATHS, buildFighterArt, planFighters } from "../fighterArt";
import * as fighterArtData from "../../../codegen/fighterArtData";
import { syncGenerated } from "../../../codegen/sync";
import { DERIVE_LEASE_SECONDS, openPaths, pruneInputs } from "../inputsPrune";
import { projectRoot } from "../project";
import { HERO_STRIKE_MOMENTS } from "../../../src/game/presentation/heroStrikeMomentInfo";
import { measureStrikeMoments, staleStrikeFighters } from "../strikeMoments";
import { heroModelSource } from "../../heroModelSource";
import { FAMILIES, FAMILY_NAMES, type Family, INPUTS_STORE, MANIFEST, checkoutInputs, isSharded, readManifest, readPins, storeFamily, storeShards, unstoredPins, writePin, writeShardPins } from "../buildInputs";
import { fetchEntry } from "../inputsFetch";

const isFamily = (name: string): name is Family => name in FAMILIES;

const ADD_USAGE = "inputs add FAMILY PATH [--fighter SHARD]... | inputs add FAMILY PATH --all (a sharded family needs --fighter for the shards to pin, or --all)";

const add = (family: string, source: string, scope: readonly string[], all: boolean) => Effect.gen(function*() {
  if (!isFamily(family)) return yield* new UsageFailure({ problem: `inputs add takes one of ${FAMILY_NAMES.join(", ")}` });
  if (isSharded(family)) {
    if (all === (scope.length > 0)) return yield* new UsageFailure({ problem: ADD_USAGE });
    return yield* addShards(family, source, all ? undefined : new Set(scope));
  }
  if (all || scope.length > 0) return yield* new UsageFailure({ problem: `${family} is not sharded; ${ADD_USAGE}` });
  const hash = yield* Effect.tryPromise({ try: () => storeFamily(family, source), catch: (cause) => new MapBuildFailure({ operation: "store build input", path: source, cause }) });
  yield* Effect.try({ try: () => writePin(family, hash), catch: (cause) => new MapBuildFailure({ operation: "write build inputs", path: MANIFEST, cause }) });
  console.log(`${family} ${hash}\nwrote it into ${MANIFEST}/${family}; commit the change to build with it`);
});

const addShards = (family: Family, source: string, only: ReadonlySet<string> | undefined) => Effect.gen(function*() {
  const shards = yield* Effect.tryPromise({ try: () => storeShards(family, source, INPUTS_STORE, only), catch: (cause) => new MapBuildFailure({ operation: "store build input", path: source, cause }) });
  const before = yield* Effect.try({ try: () => readPins()[family], catch: (cause) => new MapBuildFailure({ operation: "read build inputs", path: MANIFEST, cause }) });
  const old = typeof before === "object" ? before : {};
  const missing = [...only ?? []].filter((shard) => !(shard in shards));
  if (missing.length > 0) return yield* new UsageFailure({ problem: `${family} has no files for ${missing.join(" ")} in ${source}` });
  const pinned = only === undefined ? shards : { ...old, ...shards };
  yield* Effect.try({ try: () => writeShardPins(family, pinned), catch: (cause) => new MapBuildFailure({ operation: "write build inputs", path: MANIFEST, cause }) });
  const changed = [...new Set([...Object.keys(old), ...Object.keys(pinned)])].sort().filter((shard) => old[shard] !== pinned[shard]);
  console.log(`${family}: ${Object.keys(pinned).length} shards, changed ${changed.length === 0 ? "none" : changed.join(" ")}\nwrote them into ${MANIFEST}/${family}/; commit the change to build with it`);
});

const git = (...args: string[]) => Effect.try({
  try: () => {
    const child = Bun.spawnSync(["git", ...args], { cwd: projectRoot, stdout: "pipe", stderr: "pipe" });
    if (child.exitCode !== 0) throw new Error(child.stderr.toString().trim());
    return child.stdout.toString().trim();
  },
  catch: (cause) => new MapBuildFailure({ operation: `git ${args[0]}`, path: projectRoot, cause: String(cause) }),
});

const derive = (args: readonly string[]) => Effect.gen(function*() {
  const names = flagValues(args, "fighter"), rebuild = args.includes("--rebuild"), check = args.includes("--check");
  if (args.length !== names.length * 2 + (rebuild ? 1 : 0) + (check ? 1 : 0) || (rebuild && check)) return yield* new UsageFailure({ problem: "inputs derive takes [--fighter NAME]... [--rebuild | --check]" });
  if (check && (yield* git("status", "--porcelain", "--", ...DERIVED_PATHS)) !== "") return yield* new UsageFailure({ problem: `inputs derive --check needs ${DERIVED_PATHS.join(", ")} committed` });
  const rules = yield* Effect.try({ try: () => syncGenerated(fighterArtData.producers(), [fighterArtData.rulesDirectory], check), catch: (cause) => new MapBuildFailure({ operation: "render fighter rules", path: fighterArtData.rulesDirectory, cause: String(cause) }) });
  if (check && rules.length > 0) return yield* new UsageFailure({ problem: `fighter rules drift from the game data; run bun run generate in ts/ and commit: ${rules.join(", ")}` });
  if (rules.length > 0) console.log(`regenerated ${rules.join(", ")}`);
  const { manifest, assets, plans } = yield* planFighters(names, rebuild);
  const steps = plans.reduce((sum, plan) => sum + plan.keys.length - plan.cached, 0);
  const building = plans.filter((plan) => plan.cached < plan.keys.length).length;
  const capacity = building <= 2 ? { class: "moderate" as const, jobs: 2 } : { class: "heavy" as const, jobs: 6 };
  console.log(`${plans.length} fighters: ${steps} steps to run, ${plans.reduce((sum, plan) => sum + plan.cached, 0)} reused`);
  if (building > 0) yield* Effect.promise(() => runAdmitted(capacity.class, "smashcraft:inputs-derive", DERIVE_LEASE_SECONDS));
  const differing = yield* buildFighterArt(plans, manifest, assets, capacity.jobs, !check);
  if (!check) return;
  const characters = plans.map(({ fighter }) => fighter.character);
  const measured = yield* Effect.tryPromise({
    try: () => measureStrikeMoments((model) => Bun.file(join(assets, heroModelSource(model))).arrayBuffer(), new Set(characters)),
    catch: (cause) => new MapBuildFailure({ operation: "measure strike moments", path: assets, cause }),
  });
  const staleStrikes = plans.filter(({ fighter }) => staleStrikeFighters(measured, HERO_STRIKE_MOMENTS, [fighter.character]).length > 0).map(({ fighter }) => fighter.slug);
  if (staleStrikes.length > 0) {
    return yield* new MapBuildFailure({ operation: "check strike moments", path: "ts/src/game/fighters", cause: `the committed strike tables of ${staleStrikes.join(", ")} differ from what they measure from their committed models; run bun wisp view strikes --assets "$(bun wisp inputs path assets)" and commit the tables` });
  }
  if (differing.length === 0) return console.log(`${plans.length} fighters reproduce their committed pins and generated files from this checkout's producers`);
  return yield* new MapBuildFailure({ operation: "check derived fighter art", path: MANIFEST, cause: `these committed outputs differ from what this checkout's producers derive; run bun wisp inputs derive --fighter NAME for each and commit the result:\n${differing.join("\n")}` });
});

const prune = (args: readonly string[]) => Effect.gen(function*() {
  const scratch = flagValues(args, "scratch"), root = dirname(INPUTS_STORE);
  if (args.length !== scratch.length * 2) return yield* new UsageFailure({ problem: "inputs prune takes [--scratch NAME]..." });
  const worktrees = (yield* git("worktree", "list", "--porcelain")).split("\n").filter((line) => line.startsWith("worktree ")).map((line) => ({ path: line.slice("worktree ".length), reason: "holds a git worktree" }));
  const { removed, refused } = yield* Effect.try({
    try: () => pruneInputs(root, scratch, [...openPaths(), ...worktrees]),
    catch: (cause) => new MapBuildFailure({ operation: "prune build inputs", path: root, cause: String(cause) }),
  });
  for (const path of removed) console.log(`removed ${path}`);
  if (refused.length > 0) return yield* new MapBuildFailure({ operation: "prune build inputs", path: root, cause: refused.map(({ path, reason }) => `kept ${path}: it ${reason}`).join("\n") });
  console.log(removed.length === 0 ? "nothing to prune" : `removed ${removed.length} folders`);
});

const fetch = (hosts: readonly string[]) => Effect.gen(function*() {
  if (hosts.length === 0 || hosts.some((host) => host.startsWith("-"))) return yield* new UsageFailure({ problem: "inputs fetch takes HOST..., the ssh hosts to copy missing store entries from, tried in order" });
  const missing = unstoredPins(yield* readManifest());
  if (missing.length === 0) return console.log(`every entry ${MANIFEST} pins is already in ${INPUTS_STORE}`);
  const unfetched = yield* Effect.forEach(missing, ({ family, hash }) => Effect.gen(function*() {
    for (const host of hosts) {
      const result = yield* fetchEntry(host, family, hash);
      if (result === "fetched") return void console.log(`fetched ${family} ${hash} from ${host}`);
    }
    return `${family} ${hash}`;
  }), { concurrency: 4 });
  const absent = unfetched.filter((entry) => entry !== undefined);
  if (absent.length > 0) return yield* new MapBuildFailure({ operation: "fetch build inputs", path: INPUTS_STORE, cause: `no host of ${hosts.join(", ")} stores these; fetch them from the host that stored them or produce them again:\n${absent.join("\n")}` });
  console.log(`fetched ${missing.length} entries, each verified by its hash`);
});

export const inputs: Command = (args) => Effect.gen(function*() {
  const [verb, ...rest] = args;
  const [family, source, ...flags] = rest;
  const scope = flagValues(flags, "fighter"), all = flags.includes("--all");
  if (verb === "add" && family !== undefined && source !== undefined && flags.length === scope.length * 2 + (all ? 1 : 0)) return yield* add(family, source, scope, all);
  if (verb === "derive") return yield* derive(rest);
  if (verb === "prune") return yield* prune(rest);
  if (verb === "fetch") return yield* fetch(rest);
  if (verb === "check" && rest.length === 0) {
    const paths = yield* checkoutInputs();
    console.log(`every family in ${MANIFEST} is stored and unchanged\n--assets ${paths.assets}`);
    return;
  }
  if (verb === "path" && rest.length <= 1) {
    const paths = yield* checkoutInputs();
    const name = rest[0];
    if (name === undefined) return console.log(`--base ${paths.base} --container ${paths.container} --assets ${paths.assets} --summon ${paths.summon}`);
    if (name === "base" || name === "container" || name === "assets" || name === "summon") return console.log(paths[name]);
    return yield* new UsageFailure({ problem: "inputs path takes base, container, assets or summon" });
  }
  return yield* new UsageFailure({ problem: "inputs takes add FAMILY PATH [--fighter SHARD]... [--all] | derive [--fighter NAME]... [--rebuild | --check] | fetch HOST... | prune [--scratch NAME]... | check | path [base|container|assets|summon]" });
});
