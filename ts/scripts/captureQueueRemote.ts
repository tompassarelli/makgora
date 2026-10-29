import { closeSync, mkdirSync, openSync, readFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import { reuseStore } from "wisp/scripts/wisp/mapReuse";
import { CaptureQueueFailure } from "./captureQueue";

const fail = (problem: string) => new CaptureQueueFailure({ problem });

export const sshTo = (host: string): readonly string[] => ["ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=10", host];

export const quote = (text: string) => `'${text.replaceAll("'", "'\\''")}'`;

/** The key of the last map build `logFile` records, stored or reused. */
export const builtMapKey = (logFile: string) => [...readFileSync(logFile, "utf8").matchAll(/(?:stored|reused|copied) map build ([0-9a-f]{64})/g)].at(-1)?.[1];

interface Step { readonly command: readonly string[]; readonly stdin?: "ignore" | Bun.BunFile }

/** Runs `from`, piping its output into `into` when given, and fails naming `what` unless every process exits 0. */
const run = (what: string, logFile: string, from: Step, into?: Step) => Effect.tryPromise({
  try: async () => {
    const fd = openSync(logFile, "a");
    try {
      const first = Bun.spawn([...from.command], { stdin: from.stdin ?? "ignore", stdout: into === undefined ? fd : "pipe", stderr: fd });
      const second = into === undefined ? undefined : Bun.spawn([...into.command], { stdin: first.stdout as ReadableStream<Uint8Array>, stdout: fd, stderr: fd });
      const codes = await Promise.all([first.exited, ...(second === undefined ? [] : [second.exited])]);
      if (codes.some(code => code !== 0)) throw new Error(`exited ${codes.join(", ")}`);
    } finally {
      closeSync(fd);
    }
  },
  catch: cause => fail(`${what}: ${cause instanceof Error ? cause.message : String(cause)}; see ${logFile}`),
});

const output = (what: string, command: readonly string[]) => Effect.tryPromise({
  try: async () => {
    const child = Bun.spawn([...command], { stdin: "ignore", stdout: "pipe", stderr: "pipe" });
    const [text, problem, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
    if (code !== 0) throw new Error(problem.trim() || `exited ${code}`);
    return text;
  },
  catch: cause => fail(`${what}: ${cause instanceof Error ? cause.message : String(cause)}`),
});

export interface RemoteHost {
  readonly name: string;
  readonly shell: readonly string[];
  readonly home: string;
  readonly store: string;
}

/** The pair host's home and map store, read over its shell. */
export const remoteHost = (name: string, shell: readonly string[] = sshTo(name)) =>
  output(`reach ${name}`, [...shell, 'printf "%s\\n%s\\n" "$HOME" "${WISP_MAP_REUSE_STORE:-${XDG_CACHE_HOME:-$HOME/.cache}/wisp/maps}"']).pipe(Effect.flatMap(text => {
    const [home = "", store = ""] = text.split("\n");
    return home === "" || store === "" ? Effect.fail(fail(`${name} named no home or map store`)) : Effect.succeed({ name, shell, home, store } satisfies RemoteHost);
  }));

/** Copies this host's stored build of `key` into the pair host's map store under the same key, so its path there is `STORE/KEY/map.w3x`. */
export const shipStoredMap = (host: RemoteHost, key: string, logFile: string, store = reuseStore()) =>
  run(`copy map build ${key} to ${host.name}`, logFile,
    { command: ["tar", "-cf", "-", "-C", store, key] },
    { command: [...host.shell, `mkdir -p ${quote(host.store)} && tar -xf - -C ${quote(host.store)} && touch ${quote(`${host.store}/${key}`)}`] },
  ).pipe(Effect.as(join(host.store, key, "map.w3x")));

export const sendFile = (host: RemoteHost, from: string, to: string, logFile: string) =>
  run(`copy ${from} to ${host.name}`, logFile, { command: [...host.shell, `mkdir -p ${quote(to.slice(0, to.lastIndexOf("/")))} && cat > ${quote(to)}`], stdin: Bun.file(from) });

/** Runs `command` in the pair host's shell, from `directory` there. */
export const runThere = (host: RemoteHost, directory: string, command: readonly string[], logFile: string) =>
  run(`${command.slice(0, 3).join(" ")} on ${host.name}`, logFile, { command: [...host.shell, `cd ${quote(directory)} && ${command.map(quote).join(" ")}`] });

/** Copies the pair host's folder `from` to `to` here. */
export const fetchFolder = (host: RemoteHost, from: string, to: string, logFile: string) => Effect.gen(function*() {
  const staging = `${to}.fetch`;
  yield* Effect.sync(() => mkdirSync(staging, { recursive: true }));
  yield* run(`copy ${from} from ${host.name}`, logFile,
    { command: [...host.shell, `tar -cf - -C ${quote(from)} .`] },
    { command: ["tar", "-xf", "-", "-C", staging] },
  );
  yield* Effect.try({ try: () => renameSync(staging, to), catch: cause => fail(`place ${to}: ${String(cause)}`) });
});

export const manifestAt = (manifestText: string, map: string) => `${JSON.stringify({ ...(JSON.parse(manifestText) as Record<string, unknown>), map })}\n`;
