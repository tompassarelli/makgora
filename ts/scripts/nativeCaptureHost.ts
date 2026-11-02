import { existsSync } from "node:fs";
import { hostname } from "node:os";
import { dirname, join, relative } from "node:path";
import { Effect, Result, Schema } from "effect";
import { ChildProcess } from "effect/process";
import { quote, sshTo } from "./captureQueueRemote";
import { runProcess } from "./hostProcess";

export const NATIVE_CAPTURE_HOST = "gex45";

const REMOTE_RUNS = "$HOME/.local/state/smashcraft/remote-runs";

export class NativeCaptureHostFailure extends Schema.TaggedError<NativeCaptureHostFailure, { readonly brand: unique symbol }>()("NativeCaptureHostFailure", { problem: Schema.String }) {
  override get message(): string {
    return this.problem;
  }
}

/** Native-window captures need the NVIDIA host's GPU lease and its assets, and the laptop's gaming mode holds that lease for Tom's play, so every other host ships the run to the capture host. */
export const captureRoute = (local: string = hostname()): "here" | "ship" => (local === NATIVE_CAPTURE_HOST ? "here" : "ship");

/** A path on the capture host, written for its shell: `$HOME/...` expands there, anything else is quoted. */
export const remotePath = (path: string) => (path.startsWith("$HOME/") ? `"$HOME"/${quote(path.slice("$HOME/".length))}` : quote(path));

export interface RunFolders {
  readonly dir: string;
  readonly src: string;
  readonly input: string;
  readonly out: string;
  readonly config: string;
}

export const runFolders = (id: string): RunFolders => {
  const dir = `${REMOTE_RUNS}/${id}`;
  return { dir, src: `${dir}/src`, input: `${dir}/in`, out: `${dir}/out`, config: `${dir}/config` };
};

/** The shell text that runs `script` from the shipped copy of the `ts` folder, installing its packages first. */
export const remoteCommand = (folders: RunFolders, tsFolder: string, script: string, args: readonly string[], env: Readonly<Record<string, string>>) => {
  const assignments = Object.entries(env).map(([name, value]) => `${name}=${remotePath(value)}`);
  return [
    `cd ${remotePath(folders.src)}`,
    "git init -q",
    "git add -A",
    `cd ${remotePath(`${folders.src}/${tsFolder}`)}`,
    "bun install --frozen-lockfile >&2",
    `exec env ${assignments.join(" ")} bun ${quote(script)} ${args.map(arg => (arg.startsWith("$HOME/") ? remotePath(arg) : quote(arg))).join(" ")}`,
  ].join(" && ");
};

interface Step {
  readonly command: readonly string[];
  readonly stdin?: string;
}

const stepsOk = (what: string, from: Step, into?: Step) => Effect.tryPromise({
  try: async (signal) => {
    const first = Bun.spawn([...from.command], { stdin: from.stdin === undefined ? "ignore" : new Blob([from.stdin]), stdout: into === undefined ? 2 : "pipe", stderr: 2, signal });
    const second = into === undefined ? undefined : Bun.spawn([...into.command], { stdin: first.stdout as ReadableStream<Uint8Array>, stdout: 2, stderr: 2, signal });
    const codes = await Promise.all([first.exited, ...(second === undefined ? [] : [second.exited])]);
    if (codes.some(code => code !== 0)) throw new Error(`exited ${codes.join(", ")}`);
  },
  catch: cause => new NativeCaptureHostFailure({ problem: `${what} on ${NATIVE_CAPTURE_HOST}: ${cause instanceof Error ? cause.message : String(cause)}` }),
});

const remote = (script: string) => [...sshTo(NATIVE_CAPTURE_HOST), "-o", "ServerAliveInterval=30", "--", script];

const git = (root: string, args: readonly string[]) => runProcess(ChildProcess.make("git", ["-C", root, ...args])).pipe(
  Effect.mapError(cause => new NativeCaptureHostFailure({ problem: cause.message })),
);

/** The repository files a shipped run needs: tracked and unignored untracked files that exist in the working tree. */
export const shippedFiles = (root: string) => git(root, ["ls-files", "-z", "-co", "--exclude-standard"]).pipe(
  Effect.map(text => text.split("\0").filter(file => file !== "" && existsSync(join(root, file)))),
);

export interface Shipment {
  /** The `ts` folder of the lane that holds `script`. */
  readonly project: string;
  /** The script to run there, such as `scripts/windowStrip.ts`. */
  readonly script: string;
  readonly args: (folders: RunFolders) => readonly string[];
  readonly env?: (folders: RunFolders) => Readonly<Record<string, string>>;
  /** Local files copied into the run's folders before it starts; `to` is relative to the run folder. */
  readonly send: readonly { readonly from: string; readonly to: string }[];
  /** The local folder that receives everything the script leaves in the run's `out` folder. */
  readonly fetchInto: string;
}

/** Runs the script on the capture host from a copy of this lane, then brings its `out` folder back, whether or not the script succeeded, and removes the run's folder. */
export const runOnCaptureHost = (shipment: Shipment) => {
  const id = `${new Date().toISOString().replace(/[:.]/g, "-")}-${process.pid}`;
  const folders = runFolders(id);
  const present = shipment.send.filter(file => existsSync(file.from));
  return Effect.acquireUseRelease(
    stepsOk("create the run folder", { command: remote(`mkdir -p ${["src", "in", "out", "config"].map(name => remotePath(`${folders.dir}/${name}`)).join(" ")}`) }),
    () => Effect.gen(function*() {
      const root = yield* git(shipment.project, ["rev-parse", "--show-toplevel"]);
      const tsFolder = relative(root, shipment.project);
      console.error(`native capture: running on ${NATIVE_CAPTURE_HOST} (this host is not the capture host); run folder ${folders.dir}`);
      const files = yield* shippedFiles(root);
      yield* stepsOk("copy the lane", { command: ["tar", "-cf", "-", "-C", root, "--null", "-T", "-"], stdin: files.join("\0") }, { command: remote(`tar -xf - -C ${remotePath(folders.src)}`) });
      for (const file of present) {
        yield* stepsOk(`copy ${file.from}`, { command: ["cat", file.from] }, { command: remote(`mkdir -p ${remotePath(dirname(`${folders.dir}/${file.to}`))} && cat > ${remotePath(`${folders.dir}/${file.to}`)}`) });
      }
      const ran = yield* stepsOk("run the capture", { command: remote(remoteCommand(folders, tsFolder, shipment.script, shipment.args(folders), shipment.env?.(folders) ?? {})) }).pipe(Effect.result);
      yield* Effect.sync(() => Bun.spawnSync(["mkdir", "-p", shipment.fetchInto]));
      const fetched = yield* stepsOk("bring the results back", { command: remote(`tar -cf - -C ${remotePath(folders.out)} .`) }, { command: ["tar", "-xf", "-", "-C", shipment.fetchInto] }).pipe(Effect.result);
      if (Result.isFailure(ran)) return yield* ran.failure;
      if (Result.isFailure(fetched)) return yield* fetched.failure;
    }),
    () => stepsOk("remove the run folder", { command: remote(`rm -rf ${remotePath(folders.dir)}`) }).pipe(Effect.ignore),
  );
};
