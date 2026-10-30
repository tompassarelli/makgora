import { closeSync, openSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import { reuseStore } from "wisp/scripts/wisp/mapReuse";
import { CaptureQueueFailure } from "./captureQueue";

const fail = (problem: string) => new CaptureQueueFailure({ problem });

export const sshTo = (host: string): readonly string[] => ["ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=10", host];

export const quote = (text: string) => `'${text.replaceAll("'", "'\\''")}'`;

/** The key of the last map build `logFile` records, stored or reused. */
export const builtMapKey = (logFile: string) => [...readFileSync(logFile, "utf8").matchAll(/(?:stored|reused|copied) map build ([0-9a-f]{64})/g)].at(-1)?.[1];

interface Step { readonly command: readonly string[] }

/** Runs `from`, piping its output into `into` when given, and fails naming `what` unless every process exits 0. */
const run = (what: string, logFile: string, from: Step, into?: Step) => Effect.tryPromise({
  try: async () => {
    const fd = openSync(logFile, "a");
    try {
      const first = Bun.spawn([...from.command], { stdin: "ignore", stdout: into === undefined ? fd : "pipe", stderr: fd });
      const second = into === undefined ? undefined : Bun.spawn([...into.command], { stdin: first.stdout as ReadableStream<Uint8Array>, stdout: fd, stderr: fd });
      const codes = await Promise.all([first.exited, ...(second === undefined ? [] : [second.exited])]);
      if (codes.some(code => code !== 0)) throw new Error(`exited ${codes.join(", ")}`);
    } finally {
      closeSync(fd);
    }
  },
  catch: cause => fail(`${what}: ${cause instanceof Error ? cause.message : String(cause)}; see ${logFile}`),
});

/** The host that queued a leased-pair capture: the pair's host reaches it with `shell`, because the pair's host takes no inbound ssh. */
export interface Origin {
  readonly name: string;
  readonly shell: readonly string[];
}

export const originOf = (name: string, shell: readonly string[] = sshTo(name)): Origin => ({ name, shell });

/** Copies the origin's stored build of `key` from its map store `from` into this host's map store under the same key, so its path here is `STORE/KEY/map.w3x`. */
export const pullStoredMap = (origin: Origin, from: string, key: string, logFile: string, store = reuseStore()) =>
  run(`copy map build ${key} from ${origin.name}`, logFile,
    { command: [...origin.shell, `tar -cf - -C ${quote(from)} ${quote(key)}`] },
    { command: ["sh", "-c", 'mkdir -p "$1" && tar -xf - -C "$1" && touch "$1/$2"', "pull", store, key] },
  ).pipe(Effect.as(join(store, key, "map.w3x")));

export const pullFile = (origin: Origin, from: string, to: string, logFile: string) =>
  run(`copy ${from} from ${origin.name}`, logFile,
    { command: [...origin.shell, `cat ${quote(from)}`] },
    { command: ["sh", "-c", 'mkdir -p "$(dirname "$1")" && cat > "$1"', "pull", to] },
  );

/** Replaces the origin's folder `to` with this host's folder `from`, whole or not at all. */
export const pushFolder = (origin: Origin, from: string, to: string, logFile: string) =>
  run(`copy ${from} to ${origin.name}`, logFile,
    { command: ["tar", "-cf", "-", "-C", from, "."] },
    { command: [...origin.shell, `rm -rf ${quote(`${to}.push`)} && mkdir -p ${quote(`${to}.push`)} && tar -xf - -C ${quote(`${to}.push`)} && rm -rf ${quote(to)} && mv ${quote(`${to}.push`)} ${quote(to)}`] },
  );

export const manifestAt = (manifestText: string, map: string) => `${JSON.stringify({ ...(JSON.parse(manifestText) as Record<string, unknown>), map })}\n`;

/** The plan with every row's map and manifest moved to this host's paths. */
export const planAt = (planText: string, map: string, manifest: string) => {
  const plan = JSON.parse(planText) as { readonly rows: readonly Record<string, unknown>[] };
  return `${JSON.stringify({ ...plan, rows: plan.rows.map(row => ({ ...row, map, manifest })) })}\n`;
};
