import { mkdirSync, mkdtempSync } from "node:fs";
import { homedir } from "node:os";
import { join, relative } from "node:path";
import { Effect } from "effect";
import { MapBuildFailure } from "wisp/scripts/wisp/mapBuild";
import { stopBunProcess } from "../hostProcess";
import { type Family, INPUTS_STORE, hashTree, publish, removeTree, seal } from "./buildInputs";

export type Fetched = "fetched" | "absent";

const ABSENT = 3;

const REMOTE_STORE = relative(homedir(), INPUTS_STORE);

const spawn = (command: readonly string[], options: { readonly stdin?: ReadableStream<Uint8Array> }, path: string) => Effect.acquireRelease(
  Effect.try({
    try: () => Bun.spawn([...command], { stdin: options.stdin ?? "ignore", stdout: "pipe", stderr: "pipe" }),
    catch: (cause) => new MapBuildFailure({ operation: `start ${command[0]}`, path, cause: String(cause) }),
  }),
  stopBunProcess,
);

const stderr = (child: { readonly stderr: ReadableStream<Uint8Array> }) => Effect.promise(() => new Response(child.stderr).text()).pipe(Effect.map((text) => text.trim()));

export const fetchEntry = (host: string, family: Family, hash: string, store = INPUTS_STORE) => Effect.scoped(Effect.gen(function*() {
  const parent = join(store, family), path = `${host}:${family}/${hash}`;
  const fail = (operation: string, cause: string) => new MapBuildFailure({ operation, path, cause });
  const staging = yield* Effect.acquireRelease(
    Effect.try({ try: () => (mkdirSync(parent, { recursive: true }), mkdtempSync(join(parent, ".fetch-"))), catch: (cause) => fail("stage fetched build input", String(cause)) }),
    (folder) => Effect.sync(() => removeTree(folder)),
  );
  const remote = yield* spawn(["ssh", "-o", "BatchMode=yes", "--", host, `cd ${REMOTE_STORE}/${family} 2>/dev/null && test -d ${hash} || exit ${ABSENT}; tar -cf - ${hash}`], {}, path);
  const local = yield* spawn(["tar", "-x", "--strip-components=1", "-C", staging], { stdin: remote.stdout }, path);
  const [remoteCode, localCode] = yield* Effect.all([Effect.promise(() => remote.exited), Effect.promise(() => local.exited)], { concurrency: 2 });
  if (remoteCode === ABSENT) return "absent" satisfies Fetched;
  if (remoteCode !== 0) return yield* fail("fetch build input", `ssh ${host} exited ${remoteCode}: ${yield* stderr(remote)}`);
  if (localCode !== 0) return yield* fail("unpack fetched build input", `tar exited ${localCode}: ${yield* stderr(local)}`);
  const actual = yield* Effect.tryPromise({ try: () => hashTree(staging), catch: (cause) => fail("hash fetched build input", String(cause)) });
  if (actual !== hash) return yield* fail("verify fetched build input", `it hashes to ${actual}; ${host}'s copy was changed in place, so fetch it from another host or produce it again`);
  yield* Effect.try({ try: () => (seal(staging), publish(staging, join(parent, hash))), catch: (cause) => fail("publish fetched build input", String(cause)) });
  return "fetched" satisfies Fetched;
}));
