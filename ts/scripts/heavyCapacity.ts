





import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Effect, Schema } from "effect";

const capacityHelperCandidates = [
  join(homedir(), ".claude/skills/machine-capacity/scripts/machine-capacity.mjs"),
  join(homedir(), "code/north/main/harness/skills/machine-capacity/scripts/machine-capacity.mjs"),
];

export const capacityHelper = capacityHelperCandidates.find((path) => existsSync(path)) ?? capacityHelperCandidates[0]!;


export function insideCapacityScope(): boolean {
  try {
    return /\/agent-capacity-[0-9a-z]+\.scope(\/|$)/m.test(readFileSync("/proc/self/cgroup", "utf8"));
  } catch {
    return false;
  }
}


export const admitsThroughHelper = () => existsSync(capacityHelper) && !insideCapacityScope();

class CapacityFailure extends Schema.TaggedError<CapacityFailure, { readonly brand: unique symbol }>()("CapacityFailure", { problem: Schema.String }) {}







export type CapacityClass = "moderate" | "heavy" | "critical" | "tom";

export const admitted = (capacityClass: CapacityClass, owner: string, timeoutSeconds: number, command: readonly string[]): string[] => admitsThroughHelper()
  ? [process.execPath, capacityHelper, "run", "--class", capacityClass, "--owner", owner, "--timeout-seconds", String(timeoutSeconds), "--", ...command]
  : [...command];

export const admit = (capacityClass: "moderate" | "heavy", owner: string, timeoutSeconds: number) => Effect.gen(function*() {
  if (!admitsThroughHelper()) return undefined;
  return yield* Effect.tryPromise({
    try: () => Bun.spawn(admitted(capacityClass, owner, timeoutSeconds, [process.execPath, ...process.argv.slice(1)]), {
      stdin: "inherit", stdout: "inherit", stderr: "inherit",
    }).exited,
    catch: (cause) => new CapacityFailure({ problem: String(cause) }),
  });
});


export async function runAdmitted(capacityClass: "moderate" | "heavy", owner: string, timeoutSeconds: number): Promise<void> {
  const code = await Effect.runPromise(admit(capacityClass, owner, timeoutSeconds));
  if (code !== undefined) process.exit(code);
}
