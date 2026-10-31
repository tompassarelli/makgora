import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { Clock, Effect, Schema } from "effect";
import { admitted } from "../heavyCapacity";
import { withLock } from "./fileLock";
import { tsDirectory } from "./projectRoot";

const inputsRoot = join(homedir(), ".local/share/smashcraft-build-inputs");
export const WINDOW_SOURCE_COPY = join(inputsRoot, "window-source");
export const WINDOW_LOCK = join(inputsRoot, "locks/window-library.lock");
export const WINDOW_OWNER = "smashcraft:tom-build-window";
export const WINDOW_TIMEOUT_SECONDS = 3600;
export const LIBRARY_FILE = process.platform === "win32" ? "wisp_window.dll" : "libwisp_window.so";

export class WindowLibraryProblem extends Schema.TaggedError<WindowLibraryProblem, { readonly brand: unique symbol }>()("WindowLibraryProblem", { problem: Schema.String }) {
  override get message() { return this.problem; }
}

export interface WindowResolver {
  readonly cachedWindowLibrary: (windowDirectory: string, libraryFile: string) => string;
  readonly buildWindowLibrary: (path: string, windowDirectory: string) => Effect.Effect<string, { readonly message: string }>;
}

export interface WindowBuild {
  readonly path: string;
  readonly built: boolean;
  readonly millis: number;
}

export const packageWindow = (ts = tsDirectory) => join(ts, "node_modules/wisp/window");

// The pinned package exports no window resolver, so this reads its cache key from the file the player itself resolves with.
export const loadResolver = (ts = tsDirectory): Promise<WindowResolver> => import(join(ts, "node_modules/wisp/host/window/library.ts"));

export const libraryFor = (resolver: WindowResolver, windowDirectory: string) => resolver.cachedWindowLibrary(windowDirectory, LIBRARY_FILE);

export const libraryMissing = (resolver: WindowResolver, windowDirectory: string) => !existsSync(libraryFor(resolver, windowDirectory));

export const prepareWindowLibrary = (resolver: WindowResolver, source: string, copy = WINDOW_SOURCE_COPY, lock = WINDOW_LOCK) =>
  withLock(lock, "Waiting for another window library build", Effect.gen(function*() {
    const path = libraryFor(resolver, source);
    if (existsSync(path)) return { path, built: false, millis: 0 } satisfies WindowBuild;
    const started = yield* Clock.currentTimeMillis;
    yield* Effect.try({
      try: () => {
        rmSync(copy, { recursive: true, force: true });
        mkdirSync(dirname(copy), { recursive: true });
        cpSync(source, copy, { recursive: true, preserveTimestamps: true });
      },
      catch: (cause) => new WindowLibraryProblem({ problem: `can't stage ${source}: ${String(cause)}` }),
    });
    yield* resolver.buildWindowLibrary(path, copy).pipe(Effect.mapError((failure) => new WindowLibraryProblem({ problem: failure.message })));
    return { path, built: true, millis: (yield* Clock.currentTimeMillis) - started } satisfies WindowBuild;
  }));

export const windowLine = (finished: number, sha: string, { path, millis }: WindowBuild) =>
  [new Date(finished).toISOString(), sha, "window-library", (millis / 1000).toFixed(1), basename(dirname(dirname(path))), path].join(" ");

export const windowCommand = (sha: string) =>
  admitted("tom", WINDOW_OWNER, WINDOW_TIMEOUT_SECONDS, [process.execPath, "scripts/prepareWindowLibrary.ts", "--sha", sha]);

export const startWindowLibrary = (sha: string) => Effect.tryPromise({
  try: async () => {
    const resolver = await loadResolver();
    const path = libraryFor(resolver, packageWindow());
    if (existsSync(path)) {
      console.log(`Window library already built: ${path}`);
      return;
    }
    Bun.spawn(windowCommand(sha), { cwd: tsDirectory, stdin: "ignore", stdout: "inherit", stderr: "inherit", detached: true }).unref();
    console.log(`Building the window library in the background: ${path}`);
  },
  catch: (cause) => new WindowLibraryProblem({ problem: String(cause) }),
}).pipe(Effect.catch((failure) => Effect.sync(() => console.error(`Window library not started: ${failure.message}`))));
