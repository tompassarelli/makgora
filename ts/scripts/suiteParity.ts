import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Console, Effect } from "effect";

export const FARM_TEST = "./.github/workflows/farm-test.yml";
const root = join(import.meta.dir, "../..");

export interface Job { readonly uses?: string; readonly with?: Readonly<Record<string, unknown>>; readonly if?: unknown; readonly [key: string]: unknown }
export interface Workflow {
  readonly on?: { readonly workflow_dispatch?: { readonly inputs?: Readonly<Record<string, unknown>> }; readonly workflow_call?: { readonly inputs?: Readonly<Record<string, unknown>> } };
  readonly env?: Readonly<Record<string, unknown>>;
  readonly jobs: Readonly<Record<string, Job>>;
}

export const readWorkflow = (path: string): Workflow => Bun.YAML.parse(readFileSync(join(root, path), "utf8")) as Workflow;

export function suiteGaps(farm: Workflow, autoland: Workflow): string[] {
  const calls = Object.entries(autoland.jobs).filter(([, job]) => job.uses === FARM_TEST);
  const inlined = Object.values(autoland.jobs).filter((job) => job.uses !== FARM_TEST);
  const dispatched = Object.keys(farm.on?.workflow_dispatch?.inputs ?? {}).toSorted();
  const called = Object.keys(farm.on?.workflow_call?.inputs ?? {}).toSorted();
  return [
    ...(Bun.deepEquals(dispatched, called) ? [] : [`farm-test.yml takes inputs ${called.join(", ")} from Autoland but ${dispatched.join(", ")} from bun wisp farm test`]),
    ...calls.flatMap(([name, job]) => Object.keys(job.with ?? {}).filter((input) => !called.includes(input)).map((input) => `Autoland's ${name} job passes farm-test.yml the undeclared input ${input}`)),
    ...Object.entries(farm.jobs).flatMap(([name, job]) => [
      ...(/\b(inputs|github\.event_name)\b/.test(String(job.if ?? "")) ? [`farm-test job ${name} runs only for some callers (if: ${String(job.if)})`] : []),
      ...(calls.length > 0 || inlined.some((candidate) => Bun.deepEquals(candidate, job)) ? [] : [`Autoland's suite lacks farm-test job ${name}`]),
    ]),
    ...(calls.length > 0 ? [] : Object.entries(farm.env ?? {}).filter(([key, value]) => !Bun.deepEquals(autoland.env?.[key], value)).map(([key]) => `Autoland's suite runs with a different ${key} than farm-test.yml`)),
  ];
}

const check = Effect.gen(function*() {
  const gaps = suiteGaps(readWorkflow(".github/workflows/farm-test.yml"), readWorkflow(".github/workflows/autoland.yml"));
  if (gaps.length === 0) return yield* Console.log("suite parity: Autoland runs every farm-test job with the same test selection");
  yield* Effect.forEach(gaps, (gap) => Console.error(`suite parity: ${gap}`), { discard: true });
  process.exit(1);
});

if (import.meta.main) await Effect.runPromise(check);
