import { Effect, Schema } from "effect";

export class ProcessStartFailure extends Schema.TaggedError<ProcessStartFailure, { readonly brand: unique symbol }>()("ProcessStartFailure", { command: Schema.String, cause: Schema.String }) {
  override get message(): string {
    return `could not start ${this.command}: ${this.cause}`;
  }
}

export interface Finished { readonly exitCode: number; readonly stdout: string; readonly stderr: string }

export interface GroupOptions {
  readonly cwd: string;
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly stdout?: "pipe" | "ignore";
}

const liveGroups = new Set<number>();

const signalGroup = (group: number, signal: NodeJS.Signals) => {
  try {
    process.kill(-group, signal);
  } catch {

  }
};


export function killChildren(): void {
  for (const group of liveGroups) signalGroup(group, "SIGKILL");
  liveGroups.clear();
}


export const runGroup = (command: readonly string[], options: GroupOptions) => Effect.acquireUseRelease(
  Effect.try({
    try: () => {
      const child = Bun.spawn([...command], { cwd: options.cwd, env: options.env ?? process.env, stdin: "ignore", stdout: options.stdout ?? "pipe", stderr: "pipe", detached: true });
      liveGroups.add(child.pid);
      return child;
    },
    catch: (cause) => new ProcessStartFailure({ command: command[0] ?? "", cause: String(cause) }),
  }),
  (child) => Effect.promise(async (): Promise<Finished> => {
    const output = Promise.all([child.stdout === null ? "" : new Response(child.stdout).text(), new Response(child.stderr).text()]);
    const exitCode = await child.exited;
    signalGroup(child.pid, "SIGKILL");
    const [out, err] = await output;
    return { exitCode, stdout: out, stderr: err };
  }),
  (child) => Effect.promise(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      signalGroup(child.pid, "SIGTERM");
      await Promise.race([child.exited, Bun.sleep(1000)]);
    }
    signalGroup(child.pid, "SIGKILL");
    liveGroups.delete(child.pid);
    await child.exited;
  }),
);
