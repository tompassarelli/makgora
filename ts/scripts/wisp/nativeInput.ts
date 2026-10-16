import { join } from "node:path";
import { Effect } from "effect";
import { type Client, Clients, DesktopFailure, waitFor } from "wisp/scripts/wisp/clients";
import { GameFiles, dataDirectory } from "wisp/scripts/wisp/gameFiles";
import { preloadLines } from "wisp/scripts/wisp/preloadRecord";
import { INPUT_PREFLIGHT_FILE, inputPreflightLine } from "../../src/game/core/gameFiles";
import { NATIVE_PREFLIGHT_KEY } from "../../src/game/input/nativePreflight";

export const verifyNativeInput = (client: Client, build: string) => Effect.gen(function*() {
  const clients = yield* Clients;
  const files = yield* GameFiles;
  const path = join(dataDirectory(client.documents), INPUT_PREFLIGHT_FILE);
  const before = yield* files.read(path);
  yield* clients.preflight(client);
  yield* clients.keys(client, NATIVE_PREFLIGHT_KEY.name);
  yield* waitFor(client, "input preflight key trace", 5, files.read(path).pipe(Effect.map(file => file !== undefined && file.modified > (before?.modified ?? 0) && preloadLines(file.text)?.includes(inputPreflightLine(build)) ? file : undefined)));
  console.log(`input preflight PASS ${client.name}: focus, pointer motion and ${NATIVE_PREFLIGHT_KEY.name} map trace`);
}).pipe(
  Effect.timeoutOrElse({ duration: "12 seconds", orElse: () => Effect.fail(new DesktopFailure({ operation: "input preflight", client: client.name, cause: "display/focus/pointer/key trace check exceeded 12 s" })) }),
);
