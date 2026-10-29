import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { BunRuntime } from "@effect/platform-bun";
import { Duration, Effect, Schema } from "effect";
import { hostPath, linePreloadFile, payloadPreloadFile, preloadLines } from "wisp/scripts/wisp/preloadRecord";
import { driverCommandFile, driverReadyFile, driverStatusFile } from "wisp/src/runtime/nativeDriver";
import { pollUntil } from "./hostPoll";

const FILE_PREFIX = "smashcraft";

export class ShowcaseFailure extends Schema.TaggedError<ShowcaseFailure, { readonly brand: unique symbol }>()("ShowcaseFailure", { problem: Schema.String }) {
  override get message(): string {
    return this.problem;
  }
}

const failure = (cause: unknown) => new ShowcaseFailure({ problem: cause instanceof Error ? cause.message : String(cause) });

export function statusSerial(directory: string): number | undefined {
  let text: string;
  try { text = readFileSync(hostPath(directory, driverStatusFile(FILE_PREFIX)), "latin1"); } catch { return undefined; }
  const fields = preloadLines(text)?.[0]?.split(" ");
  const serial = fields?.[0] === "drive" ? Number(fields[1]) : Number.NaN;
  return Number.isInteger(serial) ? serial : undefined;
}

function writeFileAt(path: string, content: string | Uint8Array): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

export const send = (directory: string, text: string, timeoutSeconds = 60) => Effect.gen(function*() {
  const serial = statusSerial(directory);
  if (serial === undefined) return yield* new ShowcaseFailure({ problem: `${directory}: no driver status; the showcase map is not running here` });
  const next = serial + 1;
  yield* Effect.try({
    try: () => {
      writeFileAt(hostPath(directory, driverCommandFile(FILE_PREFIX, next)), payloadPreloadFile(new TextEncoder().encode(text)));
      writeFileAt(hostPath(directory, driverReadyFile(FILE_PREFIX, next)), linePreloadFile("ready"));
    },
    catch: failure,
  });
  yield* pollUntil(Effect.sync(() => (statusSerial(directory) ?? 0) >= next ? next : undefined), {
    every: "200 millis",
    within: Duration.seconds(timeoutSeconds),
    orElse: () => Effect.fail(new ShowcaseFailure({ problem: `driver command ${next} was not applied within ${timeoutSeconds} seconds` })),
  });
  return next;
});

const main = Effect.gen(function*() {
  const [verb, directory, ...words] = Bun.argv.slice(2);
  if (verb !== "send" || directory === undefined || words.length === 0) return yield* new ShowcaseFailure({ problem: "usage: showcase send CLIENT_DATA_DIR TEXT" });
  const serial = yield* send(directory, words.join(" "));
  console.log(`applied ${serial}`);
});

if (import.meta.main) BunRuntime.runMain(main);
