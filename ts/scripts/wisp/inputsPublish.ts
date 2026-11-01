import { existsSync } from "node:fs";
import { homedir, hostname } from "node:os";
import { join, relative } from "node:path";
import { Effect } from "effect";
import { MapBuildFailure } from "wisp/scripts/wisp/mapBuild";
import { stopBunProcess } from "../hostProcess";
import { type Family, INPUTS_STORE, type Manifest, FAMILY_NAMES, hashTree, pinHashes } from "./buildInputs";

export const PIN_HOST = "gex45";

const SEEDS = 20;
const HASH = /^[0-9a-f]{64}$/;
const SAFE_PATH = /^[A-Za-z0-9._/-]+$/;
const STAGING = /\/\.publish-[A-Za-z0-9]{6}$/;

export interface Entry { readonly family: Family; readonly hash: string }

export interface Finished { readonly code: number; readonly stdout: string; readonly stderr: string }

export interface Remote {
  readonly name: string;
  readonly store: string;
  readonly shell: (script: string) => Effect.Effect<Finished, MapBuildFailure>;
  readonly rsyncShell: readonly string[];
  readonly target: (path: string) => string;
}

const execute = (command: readonly string[], path: string) => Effect.scoped(Effect.gen(function*() {
  const child = yield* Effect.acquireRelease(
    Effect.try({
      try: () => Bun.spawn([...command], { stdin: "ignore", stdout: "pipe", stderr: "pipe" }),
      catch: (cause) => new MapBuildFailure({ operation: `start ${command[0]}`, path, cause: String(cause) }),
    }),
    stopBunProcess,
  );
  const [code, stdout, stderr] = yield* Effect.all([
    Effect.promise(() => child.exited),
    Effect.promise(() => new Response(child.stdout).text()),
    Effect.promise(() => new Response(child.stderr).text()),
  ], { concurrency: "unbounded" });
  return { code, stdout, stderr } satisfies Finished;
}));

const SSH = ["ssh", "-o", "BatchMode=yes"] as const;

export const sshRemote = (host: string): Remote => ({
  name: host,
  store: relative(homedir(), INPUTS_STORE),
  shell: (script) => execute([...SSH, host, script], host),
  rsyncShell: ["-e", SSH.join(" ")],
  target: (path) => `${host}:${path}`,
});

export const pinnedEntries = (manifest: Manifest): Entry[] =>
  FAMILY_NAMES.flatMap((family) => pinHashes(manifest[family]).map((hash) => ({ family, hash })));

const quoted = (path: string) => {
  if (!SAFE_PATH.test(path)) throw new Error(`refusing to quote ${path} into a remote shell`);
  return `'${path}'`;
};

export const treeHash = (sums: string) => {
  const tree = new Bun.CryptoHasher("sha256");
  for (const line of sums.split("\n").filter((row) => row !== "")) {
    const [content, file] = [line.slice(0, 64), line.slice(66)];
    tree.update(`${file}\0${content}\n`);
  }
  return tree.digest("hex");
};

const remoteStep = (remote: Remote, operation: string, script: string) => remote.shell(script).pipe(
  Effect.flatMap((finished) => finished.code === 0
    ? Effect.succeed(finished.stdout)
    : Effect.fail(new MapBuildFailure({ operation, path: `${remote.name}:${remote.store}`, cause: `exited ${finished.code}: ${finished.stderr.trim()}` }))),
);

export const absentOn = (remote: Remote, entries: readonly Entry[]) => Effect.gen(function*() {
  if (entries.length === 0) return [];
  const listed = entries.map(({ family, hash }) => quoted(`${family}/${hash}`)).join(" ");
  const stdout = yield* remoteStep(remote, "list stored build inputs", `for entry in ${listed}; do [ -d ${quoted(remote.store)}/"$entry" ] || echo "$entry"; done`);
  const absent = new Set(stdout.split("\n").filter((line) => line !== ""));
  return entries.filter(({ family, hash }) => absent.has(`${family}/${hash}`));
});

export const publishEntry = (remote: Remote, { family, hash }: Entry, store = INPUTS_STORE) => Effect.scoped(Effect.gen(function*() {
  const source = join(store, family, hash), path = `${remote.name}:${family}/${hash}`;
  const fail = (operation: string, cause: string) => new MapBuildFailure({ operation, path, cause });
  if (!HASH.test(hash)) return yield* fail("publish build input", "the pin is not a SHA-256");
  if (!existsSync(source)) return yield* fail("find build input", `neither this host nor ${remote.name} stores it; produce it again here and land the pin from here, or land it from the host that stored it`);
  const local = yield* Effect.tryPromise({ try: () => hashTree(source), catch: (cause) => fail("hash build input", String(cause)) });
  if (local !== hash) return yield* fail("verify build input", `this host's copy hashes to ${local}; it was changed in place, so produce it again`);
  const parent = `${remote.store}/${family}`;
  const [staging = "", ...seeds] = yield* Effect.acquireRelease(
    remoteStep(remote, "stage published build input", `mkdir -p ${quoted(parent)} && cd ${quoted(parent)} && mktemp -d .publish-XXXXXX && { ls -t | grep -E '^[0-9a-f]{64}$' | head -n ${SEEDS}; true; }`)
      .pipe(Effect.map((stdout) => stdout.split("\n").map((line) => line.trim()).filter((line) => line !== ""))),
    ([folder = ""]) => STAGING.test(`/${folder}`)
      ? remote.shell(`cd ${quoted(parent)} && if [ -d ${quoted(folder)} ]; then chmod -R u+w ${quoted(folder)} && rm -rf ${quoted(folder)}; fi`).pipe(Effect.ignore)
      : Effect.void,
  );
  if (!STAGING.test(`/${staging}`)) return yield* fail("stage published build input", `${remote.name} named the staging folder ${staging}`);
  const folder = `${parent}/${staging}`;
  const transfer = yield* execute(["rsync", "-a", "--checksum", ...remote.rsyncShell, ...seeds.filter((seed) => HASH.test(seed)).map((seed) => `--link-dest=../${seed}`), `${source}/`, `${remote.target(folder)}/`], path);
  if (transfer.code !== 0) return yield* fail("publish build input", `rsync to ${remote.name} exited ${transfer.code}: ${transfer.stderr.trim()}`);
  const sums = yield* remoteStep(remote, "hash published build input", `cd ${quoted(folder)} && find . -type f -printf '%P\\0' | LC_ALL=C sort -z | xargs -0 -r sha256sum`);
  const copied = treeHash(sums);
  if (copied !== hash) return yield* fail("verify published build input", `${remote.name}'s copy hashes to ${copied}`);
  yield* remoteStep(remote, "seal published build input", `cd ${quoted(parent)} && find ${quoted(staging)} -type f -exec chmod 444 {} + && find ${quoted(staging)} -type d -exec chmod 555 {} + && { mv -T ${quoted(staging)} ${quoted(hash)} 2>/dev/null || [ -d ${quoted(hash)} ]; }`);
}));

export const publishPins = (remote: Remote, entries: readonly Entry[], store = INPUTS_STORE) => Effect.gen(function*() {
  const absent = yield* absentOn(remote, entries);
  yield* Effect.forEach(absent, (entry) => publishEntry(remote, entry, store), { concurrency: 4, discard: true });
  return absent;
});

export const isThisHost = (host: string) => hostname() === host;
