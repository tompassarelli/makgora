import { mkdirSync, mkdtempSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, relative } from "node:path";
import { Effect } from "effect";
import { MapBuildFailure } from "wisp/scripts/wisp/mapBuild";
import { stopBunProcess } from "../hostProcess";
import { type Family, INPUTS_STORE, hashTree, publish, removeTree, seal } from "./buildInputs";

export type Fetched = "fetched" | "absent";

const ABSENT = 23;
const SEEDS = 20;

const REMOTE_STORE = relative(homedir(), INPUTS_STORE);

const spawn = (command: readonly string[], path: string) => Effect.acquireRelease(
  Effect.try({
    try: () => Bun.spawn([...command], { stdin: "ignore", stdout: "ignore", stderr: "pipe" }),
    catch: (cause) => new MapBuildFailure({ operation: `start ${command[0]}`, path, cause: String(cause) }),
  }),
  stopBunProcess,
);

/** The family's newest stored entries, whose files a fetch of another entry links instead of copying when their bytes match. */
export const seedEntries = (parent: string, hash: string): readonly string[] =>
  readdirSync(parent).filter((name) => /^[0-9a-f]{64}$/.test(name) && name !== hash).map((name) => join(parent, name))
    .sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs).slice(0, SEEDS);

export const fetchEntry = (host: string, family: Family, hash: string, store = INPUTS_STORE, origin = `${host}:${REMOTE_STORE}`) => Effect.scoped(Effect.gen(function*() {
  const parent = join(store, family), path = `${host}:${family}/${hash}`;
  const fail = (operation: string, cause: string) => new MapBuildFailure({ operation, path, cause });
  const staging = yield* Effect.acquireRelease(
    Effect.try({ try: () => (mkdirSync(parent, { recursive: true }), mkdtempSync(join(parent, ".fetch-"))), catch: (cause) => fail("stage fetched build input", String(cause)) }),
    (folder) => Effect.sync(() => removeTree(folder)),
  );
  const seeds = yield* Effect.try({ try: () => seedEntries(parent, hash), catch: (cause) => fail("list stored entries", String(cause)) });
  const transfer = yield* spawn(["rsync", "-a", "--checksum", "-e", "ssh -o BatchMode=yes", ...seeds.map((seed) => `--link-dest=${seed}`), `${origin}/${family}/${hash}/`, `${staging}/`], path);
  const [code, errors] = yield* Effect.all([Effect.promise(() => transfer.exited), Effect.promise(() => new Response(transfer.stderr).text())], { concurrency: 2 });
  if (code === ABSENT && errors.includes("No such file or directory")) return "absent" satisfies Fetched;
  if (code !== 0) return yield* fail("fetch build input", `rsync from ${host} exited ${code}: ${errors.trim()}`);
  const actual = yield* Effect.tryPromise({ try: () => hashTree(staging), catch: (cause) => fail("hash fetched build input", String(cause)) });
  if (actual !== hash) return yield* fail("verify fetched build input", `it hashes to ${actual}; ${host}'s copy was changed in place, so fetch it from another host or produce it again`);
  yield* Effect.try({ try: () => (seal(staging), publish(staging, join(parent, hash))), catch: (cause) => fail("publish fetched build input", String(cause)) });
  return "fetched" satisfies Fetched;
}));
