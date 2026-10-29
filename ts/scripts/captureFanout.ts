import { readFileSync, writeFileSync } from "node:fs";
import { homedir, hostname } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { attempt, fail, spawnLogged } from "./captureQueueProcess";
import { tsDirectory } from "./wisp/projectRoot";

export interface Slot { readonly host: string; readonly pair: number }

const LAPTOP_ALIAS = "whiterabbit";
const BIG_HOST = "gex45";

/** The host a capture batch may also fan clips to: the laptop from gex45, gex45 from the laptop. */
export const peerOf = (local: string) => (local === BIG_HOST ? LAPTOP_ALIAS : BIG_HOST);

/** Pairs a host's `lan setup` made: `lanKa` and `lanKb` installs both present. */
export const pairsOf = (installs: readonly string[]) => {
  const names = new Set(installs);
  return [...names].flatMap(name => /^lan(\d+)a$/.exec(name)?.[1] ?? []).map(Number).filter(pair => names.has(`lan${pair}b`)).sort((left, right) => left - right);
};

export const pairRemoteSpec = (peer: string, pairs: readonly number[]) => (pairs.length === 0 ? "" : `${peer}=${pairs.join(",")}`);

const peerSpec = Effect.promise(async () => {
  const given = process.env.WISP_PAIR_REMOTE;
  if (given !== undefined) return given;
  const peer = peerOf(hostname());
  const run = Bun.spawn(["ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=5", "--", peer, "ls ~/.local/share/wisp/lan/clients"], { stdin: "ignore", stdout: "pipe", stderr: "ignore" });
  const text = await new Response(run.stdout).text();
  return await run.exited === 0 ? pairRemoteSpec(peer, pairsOf(text.split("\n"))) : "";
}).pipe(Effect.orElseSucceed(() => ""));

const lanLease = (verb: "take" | "release", extra: readonly string[], remote: string) => Effect.promise(async () => {
  const run = Bun.spawn([process.execPath, "scripts/wisp.ts", "lan", "lease", verb, ...extra], { cwd: tsDirectory, stdin: "ignore", stdout: "pipe", stderr: "inherit", env: { ...process.env, WISP_PAIR_REMOTE: remote } });
  const text = await new Response(run.stdout).text();
  return { code: await run.exited, text };
});

/** The next free pair on this host or its peer from the shared pair queue, held until the scope ends; the lease also ends with this process. */
export const leaseAnyPair = (owner: string, waitSeconds: number) => Effect.acquireRelease(
  peerSpec.pipe(Effect.flatMap(remote => lanLease("take", ["--owner", owner, "--pid", String(process.pid), "--hosts", "any", "--wait", String(waitSeconds)], remote).pipe(
    Effect.flatMap(({ code, text }) => {
      const slot = code === 0 ? (JSON.parse(text.trim().split("\n").at(-1) ?? "{}") as { host?: string; pair?: number }) : undefined;
      return slot?.host === undefined || slot.pair === undefined ? Effect.fail(fail(`no free pair for ${owner} from the shared pair queue`)) : Effect.succeed({ slot: { host: slot.host, pair: slot.pair } satisfies Slot, remote });
    }),
  ))),
  ({ slot, remote }) => lanLease("release", ["--host", slot.host, "--pair", String(slot.pair)], remote),
).pipe(Effect.map(({ slot }) => slot));

export const isLocal = (slot: Slot) => slot.host === hostname();

const quoted = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;
const underHome = (path: string) => (path.startsWith(`${homedir()}/`) ? `"$HOME/${path.slice(homedir().length + 1).replaceAll(/(["$`\\])/g, "\\$1")}"` : quoted(path));

export interface RemoteGroup {
  readonly slot: Slot;
  readonly batch: string;
  readonly index: number;
  readonly directory: string;
  readonly map: string;
  readonly manifest: string;
  readonly plan: string;
  readonly minutes: number;
  readonly clientsFile: string;
  readonly desktop: string;
  readonly capacity: string;
  readonly install: string;
}

export const remoteDirectory = (batch: string, index: number) => `.local/state/smashcraft/capture-queue/${batch}-g${index}`;

/** The commands that carry one group to a peer host, run its capture batch there and bring the frames back. */
export const remoteInvocations = (group: RemoteGroup, remotePlan: string) => {
  const target = remoteDirectory(group.batch, group.index), host = group.slot.host, native = join(group.directory, `native-${group.index}`);
  const sync = (from: string, to: string) => ["rsync", "-a", "--protect-args", "-e", "ssh -o BatchMode=yes", "--", from, to];
  const batch = ["bun", "scripts/nativeCapture.ts", "batch", "--plan", `"$HOME/${target}/plan.json"`, "--out", `"$HOME/${target}/native"`, "--pair", String(group.slot.pair), "--desktop", underHome(group.desktop), "--capacity", underHome(group.capacity), "--clients-file", underHome(group.clientsFile), "--client", `lan${group.slot.pair}a`, "--install", underHome(group.install), "--minutes", String(group.minutes)].join(" ");
  return [
    ["ssh", "-o", "BatchMode=yes", "--", host, `mkdir -p ${target}/native`],
    sync(group.map, `${host}:${target}/`),
    sync(group.manifest, `${host}:${target}/`),
    sync(remotePlan, `${host}:${target}/plan.json`),
    ["ssh", "-o", "BatchMode=yes", "--", host, `cd "$HOME/code/smashcraft/main/ts" && ${batch}`],
    sync(`${host}:${target}/native/`, `${native}/`),
  ] as const;
};

const remotePlanFile = (group: RemoteGroup) => {
  const target = join(homedir(), remoteDirectory(group.batch, group.index));
  const plan = JSON.parse(readFileSync(group.plan, "utf8")) as { rows: { map: string; manifest: string }[] };
  const base = (path: string) => path.slice(path.lastIndexOf("/") + 1);
  const rewritten = { ...plan, rows: plan.rows.map(row => ({ ...row, map: `${target}/${base(row.map)}`, manifest: `${target}/${base(row.manifest)}` })) };
  const file = `${group.plan}.remote`;
  writeFileSync(file, `${JSON.stringify(rewritten)}\n`);
  return file;
};

export const remoteCapture = (group: RemoteGroup, logFile: string) => Effect.gen(function*() {
  const remotePlan = yield* attempt("write the remote plan", () => remotePlanFile(group));
  for (const invocation of remoteInvocations(group, remotePlan)) yield* spawnLogged(invocation, tsDirectory, logFile);
});
