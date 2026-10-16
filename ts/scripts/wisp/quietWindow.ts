import { loadavg } from "node:os";
import { Context, Effect } from "effect";
import { withQuietNativeCapacity } from "wisp/scripts/wisp/quietNativeCapacity";

export class QuietNativeWindow extends Context.Service<QuietNativeWindow, { readonly owner: string }>()("smashcraft/wisp/QuietNativeWindow") {}

export const inQuietNativeWindow = <A, E, R>(owner: string, run: Effect.Effect<A, E, R>, quiet: typeof withQuietNativeCapacity = withQuietNativeCapacity): ReturnType<typeof withQuietNativeCapacity<A, E, Exclude<R, QuietNativeWindow>>> =>
  quiet(owner, run.pipe(Effect.provideService(QuietNativeWindow, { owner })));

export const hostLoad = () => ({ load_average: loadavg() });

export const windowLoad = Effect.gen(function*() {
  const { owner } = yield* QuietNativeWindow;
  return { ...hostLoad(), quiet_window: owner };
});
