import { Effect, Layer } from "effect";
import { BunServices } from "@effect/platform-bun";
import { capture, loadClients } from "wisp/scripts/warcraft/desktop";
import { platformLayer } from "wisp/scripts/platform/layer";
import { encodePng } from "../scripts/wisp/hurtboxView";
const [file, out] = process.argv.slice(2);
await Effect.runPromise(Effect.gen(function*() {
  const client = (yield* loadClients(file!)).find(row => row.name === "a")!;
  const frame = yield* capture(client);
  yield* Effect.promise(() => Bun.write(out!, encodePng(frame.width, frame.height, frame.rgb)));
}).pipe(Effect.provide(Layer.merge(BunServices.layer, platformLayer()))) as any);
