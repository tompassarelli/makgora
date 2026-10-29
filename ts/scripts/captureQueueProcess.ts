import { appendFileSync, closeSync, openSync } from "node:fs";
import { Effect } from "effect";
import { CaptureQueueFailure } from "./captureQueue";

export const option = (args: readonly string[], name: string) => {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
};
export const fail = (problem: string) => new CaptureQueueFailure({ problem });
export const attempt = <A>(problem: string, run: () => A) => Effect.try({ try: run, catch: cause => fail(`${problem}: ${cause instanceof Error ? cause.message : String(cause)}`) });
export const seconds = (since: number) => Math.round((performance.now() - since) / 100) / 10;

export const logTo = (file: string) => (row: Record<string, unknown>) => Effect.sync(() => {
  const line = JSON.stringify({ at: new Date().toISOString(), ...row });
  appendFileSync(file, `${line}\n`);
  console.log(line);
});

export const spawnLogged = (command: readonly string[], cwd: string, logFile: string) => Effect.acquireUseRelease(
  attempt(`start ${command.slice(0, 4).join(" ")}`, () => {
    const fd = openSync(logFile, "a");
    const child = Bun.spawn([...command], { cwd, stdin: "ignore", stdout: fd, stderr: fd });
    closeSync(fd);
    return child;
  }),
  child => Effect.promise(() => child.exited).pipe(Effect.flatMap(code => code === 0 ? Effect.void : Effect.fail(fail(`${command.slice(1, 4).join(" ")} exited ${code}; see ${logFile}`)))),
  child => Effect.sync(() => { if (child.exitCode === null) child.kill("SIGINT"); }),
);
