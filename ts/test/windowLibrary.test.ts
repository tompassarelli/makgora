import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { type WatchFiles, type WatchSteps, watchOnce } from "../scripts/tomBuildWatch";
import { LIBRARY_FILE, type WindowResolver, libraryFor, libraryMissing, loadResolver, prepareWindowLibrary, windowLine } from "../scripts/wisp/windowLibrary";

const SHA = "1e47721".padEnd(40, "0");
let directory: string;
let cache: string | undefined;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "window-library-"));
  cache = process.env.XDG_CACHE_HOME;
  process.env.XDG_CACHE_HOME = join(directory, "cache");
});

afterEach(() => {
  if (cache === undefined) delete process.env.XDG_CACHE_HOME;
  else process.env.XDG_CACHE_HOME = cache;
  rmSync(directory, { recursive: true });
});

const windowSource = () => {
  const source = join(directory, "window");
  mkdirSync(join(source, "wisp-window/src"), { recursive: true });
  writeFileSync(join(source, "Cargo.toml"), "[workspace]\n");
  writeFileSync(join(source, "wisp-window/src/lib.rs"), "fn a() {}\n");
  return source;
};

const prepare = (resolver: WindowResolver, source: string) =>
  Effect.runPromise(prepareWindowLibrary(resolver, source, join(directory, "copy"), join(directory, "lock")).pipe(Effect.result));

describe("window library prebuild", () => {
  test("the pinned Wisp's window library is built exactly when its source hash is new [k1 scenario]", async () => {
    const real = await loadResolver();
    const source = windowSource();
    const builds: string[] = [];
    const resolver: WindowResolver = {
      cachedWindowLibrary: real.cachedWindowLibrary,
      buildWindowLibrary: (path, from) => Effect.sync(() => {
        builds.push(readFileSync(join(from, "wisp-window/src/lib.rs"), "utf8"));
        mkdirSync(join(path, ".."), { recursive: true });
        writeFileSync(path, "library");
        return path;
      }),
    };
    expect(libraryMissing(resolver, source)).toBe(true);
    const first = await prepare(resolver, source);
    expect(first._tag === "Success" && first.success.built).toBe(true);
    expect(existsSync(libraryFor(resolver, source))).toBe(true);
    expect(libraryMissing(resolver, source)).toBe(false);

    const again = await prepare(resolver, source);
    expect(again._tag === "Success" && again.success.built).toBe(false);
    expect(builds).toEqual(["fn a() {}\n"]);

    writeFileSync(join(source, "wisp-window/src/lib.rs"), "fn b() {}\n");
    const edited = await prepare(resolver, source);
    expect(edited._tag === "Success" && edited.success.built).toBe(true);
    expect(builds).toEqual(["fn a() {}\n", "fn b() {}\n"]);
    expect(libraryFor(resolver, source).endsWith(LIBRARY_FILE)).toBe(true);
  });

  test("the log line names the landing, the step, its seconds, the cache key and the library [k1 scenario]", () => {
    const line = windowLine(Date.parse("2026-10-31T20:00:00Z"), SHA, { path: "/cache/wisp/window/0123456789abcdef/release/libwisp_window.so", built: true, millis: 12_345 });
    expect(line).toBe(`2026-10-31T20:00:00.000Z ${SHA} window-library 12.3 0123456789abcdef /cache/wisp/window/0123456789abcdef/release/libwisp_window.so`);
  });
});

const landing = (bootRefusal: string | undefined) => {
  const calls: string[] = [];
  const steps: WatchSteps<never> = {
    tip: () => Effect.succeed(SHA),
    decision: () => Effect.succeed("build"),
    landedAt: () => Effect.succeed(0),
    onMain: () => Effect.succeed(undefined),
    measured: (work) => work.pipe(Effect.map((value) => [value, { pressure: 0, clients: 0 }] as const)),
    held: Effect.succeed(undefined),
    build: () => Effect.succeed({ version: "0.1.0-main", source: "map.w3x", stages: [] }),
    prepareBoot: Effect.void,
    boot: () => Effect.succeed(bootRefusal),
    tidy: Effect.succeed(undefined),
    fetchInputs: Effect.succeed(false),
    install: ({ version }) => Effect.sync(() => { calls.push("install"); return { version, path: "Maps/00-Smashcraft/map.w3x" }; }),
    notes: () => Effect.succeed("checklist.md"),
    windowLibrary: (sha) => Effect.sync(() => { calls.push(`window ${sha}`); }),
    budget: () => Effect.void,
  };
  const files: WatchFiles = { log: join(directory, "tom-build.log"), attempts: join(directory, "attempted"), refused: join(directory, "refused.log") };
  Effect.runSync(watchOnce(steps, files));
  return calls;
};

describe("tom build watcher window step", () => {
  test("an installed build starts the window library after the map is in Maps and the build line is logged [k1 scenario]", () => {
    expect(landing(undefined)).toEqual(["install", `window ${SHA}`]);
  });

  test("a map that does not boot starts no window library [k1 scenario]", () => {
    expect(landing("stuck")).toEqual([]);
  });
});
