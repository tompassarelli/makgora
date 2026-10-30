import { Effect } from "effect";

export const NO_FREE_SLOTS = "no free capacity for a farm";

export const BACKOFF = { first: 60, growth: 2, most: 600 } as const;

export const WAIT_MINUTES = 180;

export const isSlotShortage = (log: string): boolean => log.includes(NO_FREE_SLOTS);

export const backoffSeconds = (waits: number): number => Math.min(BACKOFF.most, BACKOFF.first * BACKOFF.growth ** waits);

export interface Attempt<A> {
  readonly value: A;
  readonly refusal: string | undefined;
}

export interface Clock {
  readonly sleep: (seconds: number) => Effect.Effect<void>;
  readonly elapsed: () => number;
}

export const realClock = (): Clock => {
  const started = performance.now();
  return { sleep: (seconds) => Effect.sleep(`${seconds} seconds`), elapsed: () => (performance.now() - started) / 1000 };
};

export type Waited<A> = { readonly admitted: true; readonly value: A } | { readonly admitted: false; readonly refusal: string; readonly waits: number };

export const untilAdmitted = <A, E, R>(attempt: () => Effect.Effect<Attempt<A>, E, R>, timeoutMinutes: number, clock: Clock = realClock()) => Effect.gen(function*() {
  for (let waits = 0;; waits++) {
    const result = yield* attempt();
    if (result.refusal === undefined) return { admitted: true, value: result.value } satisfies Waited<A>;
    const seconds = backoffSeconds(waits);
    if (clock.elapsed() + seconds > timeoutMinutes * 60) return { admitted: false, refusal: result.refusal, waits } satisfies Waited<A>;
    console.error(`waiting for a hosted slot (wait ${waits + 1}, retrying in ${seconds} s): ${result.refusal}`);
    yield* clock.sleep(seconds);
  }
});
