

import { dlopen } from "bun:ffi";
import { closeSync, mkdirSync, openSync } from "node:fs";
import { dirname } from "node:path";
import { Effect } from "effect";

const LOCK_EX = 2;
const LOCK_NB = 4;
const libc = dlopen("libc.so.6", { flock: { args: ["i32", "i32"], returns: "i32" } });


export function tryLock(path: string): number | undefined {
  mkdirSync(dirname(path), { recursive: true });
  const fd = openSync(path, "a");
  if (libc.symbols.flock(fd, LOCK_EX | LOCK_NB) === 0) return fd;
  closeSync(fd);
  return undefined;
}





export const withLock = <A, E, R>(path: string, waiting: string, effect: Effect.Effect<A, E, R>) =>
  Effect.acquireUseRelease(
    Effect.gen(function*() {
      let announced = false;
      while (true) {
        const fd = tryLock(path);
        if (fd !== undefined) return fd;
        if (!announced) console.log(waiting);
        announced = true;
        yield* Effect.sleep("250 millis");
      }
    }),
    () => effect,
    (fd) => Effect.sync(() => closeSync(fd)),
  );

export const withLocks = <A, E, R>(locks: readonly { readonly path: string; readonly waiting: string }[], effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
  [...locks].sort((a, b) => a.path.localeCompare(b.path)).reduceRight<Effect.Effect<A, E, R>>((inner, lock) => withLock(lock.path, lock.waiting, inner), effect);
