import { afterEach, expect, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { packagerSource } from "wisp/scripts/wisp/mapBuild";
import { ownerWalkStart, poolUnitCommand, unitPairIds } from "../scripts/wisp/commands/lanPoolUnit";
import { NATIVE_OUTER_PID } from "../scripts/wisp/commands/pairGuard";

const ts = join(import.meta.dir, "..");
const fixtures = join(import.meta.dir, "fixtures/lan-pool");
const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

const sandbox = () => {
  const folder = mkdtempSync(join(tmpdir(), "smashcraft-lan-pool-"));
  cleanups.push(() => rmSync(folder, { recursive: true, force: true }));
  const bin = join(folder, "bin");
  mkdirSync(bin);
  writeFileSync(join(bin, "pw-dump"), "#!/bin/sh\nexit 0\n");
  writeFileSync(join(bin, "pw-cli"), "#!/bin/sh\nexit 1\n");
  writeFileSync(join(bin, "systemctl"), `#!/bin/sh\nexec "$WISP_TEST_BUN" "${join(fixtures, "systemctl.ts")}" "$@"\n`);
  for (const tool of ["pw-dump", "pw-cli", "systemctl"]) chmodSync(join(bin, tool), 0o755);
  // An empty stand-in for the LAN plugin: the pool only checks that the plugin is installed, and nothing here loads it.
  const plugin = join(folder, ".local/share/wisp-private/lan");
  mkdirSync(plugin, { recursive: true });
  writeFileSync(join(plugin, "index.ts"), "export {};\n");
  // The pool only checks that its map packager is current; this one never packs a map, so nothing compiles it.
  const packager = join(folder, ".cache/wisp/lan/map-pack");
  mkdirSync(join(packager, ".."), { recursive: true });
  writeFileSync(packager, "");
  writeFileSync(`${packager}.source-sha256`, `${packagerSource()}\n`);
  writeFileSync(`${packager}.stormlib-gc-root`, "");
  const { NORTH_FLEET_SESSION: _session, XDG_CACHE_HOME: _cache, ...inherited } = process.env;
  return {
    ...inherited,
    HOME: folder,
    PATH: `${bin}:${process.env["PATH"] ?? ""}`,
    XDG_STATE_HOME: join(folder, "state"),
    XDG_DATA_HOME: join(folder, "data"),
    WISP_XDOTOOL: "/bin/true",
    WISP_TEST_SESSIONS: join(folder, "sessions"),
    WISP_TEST_DESKTOPS: join(folder, "desktops"),
    WISP_TEST_BUN: process.execPath,
    PLAYTEST_STATE: join(folder, ".local/state/playtest/state.json"),
  };
};

const PAIR = 93;
const HELD_SECONDS = 3;

test("two smashcraft sessions waiting on a held pair get it one at a time, in the order they asked, through wisp's queue [k5 boundary lan-pool-queue]", async () => {
  const env = sandbox();
  const claimFile = join(env.XDG_STATE_HOME, "wisp/lan", `pair-${PAIR}`, "claim.json");
  const queue = join(env.XDG_STATE_HOME, "wisp/lan", `pair-${PAIR}`, "queue");
  const holderOf = () => {
    try { return (JSON.parse(readFileSync(claimFile, "utf8")) as { session: string }).session; } catch { return undefined; }
  };
  const waiting = () => {
    try { return readdirSync(queue).filter((name) => name.endsWith(".json")).length; } catch { return 0; }
  };
  const holders: string[] = [];
  const watch = setInterval(() => {
    const holder = holderOf();
    if (holder !== undefined && holders.at(-1) !== holder) holders.push(holder);
  }, 50);
  cleanups.push(() => clearInterval(watch));
  const until = async (check: () => boolean, what: string) => {
    for (const deadline = Date.now() + 30_000; !check();) {
      if (Date.now() > deadline) throw new Error(`${what} not within 30 s`);
      await Bun.sleep(50);
    }
  };
  const session = (name: string, hold: readonly string[] = ["--seconds", String(HELD_SECONDS)]) => Bun.spawn([process.execPath, "scripts/wisp.ts", "lan", "pool", "--foreground", "--pair", String(PAIR), "--capacity", join(fixtures, "capacity.ts"), "--desktop", join(fixtures, "desktop.sh"), "--wait", "0", ...hold], {
    cwd: ts, env: { ...env, NORTH_FLEET_SESSION: name }, stdout: "pipe", stderr: "pipe",
  });

  const holderSession = Bun.spawn(["sleep", "600"]);
  cleanups.push(() => holderSession.kill());
  const first = session("holder", ["--owner-pid", String(holderSession.pid)]);
  await until(() => holderOf() === "holder", "the holder's claim");
  const early = session("early");
  await until(() => waiting() === 1, "the early session's place in line");
  const late = session("late");
  await until(() => waiting() === 2, "the late session's place in line");
  holderSession.kill();

  const codes = await Promise.all([first, early, late].map((child) => child.exited));
  const output = await Promise.all([first, early, late].map(async (child) => `${await new Response(child.stdout).text()}${await new Response(child.stderr).text()}`));
  expect({ codes, holders, claim: holderOf(), waiting: waiting() }, output.join("\n---\n")).toEqual({ codes: [0, 0, 0], holders: ["holder", "early", "late"], claim: undefined, waiting: 0 });
}, 120_000);

test("each fleet session's pool unit has its own name, reads back its pairs, waits in line and names its session's process as owner [k2 property]", () => {
  const unit = (session: string, args: readonly string[] = ["--pair", "0"]) => poolUnitCommand(args, "/bin", 1000, "bun", { NORTH_FLEET_SESSION: session, PRIVATE_DESKTOP_RUN: "/run/user/1000/private-desktop.test" }, () => ":7", () => 4242);
  const name = (command: readonly string[]) => command.find((arg) => arg.startsWith("--unit="))?.slice("--unit=".length) ?? "";
  const pool = (command: readonly string[]) => command.slice(command.indexOf("pool") + 1);
  expect(new Set(["early", "late", "early"].map((session) => name(unit(session)))).size).toBe(2);
  for (const ids of [[0], [3, 12]]) expect(unitPairIds(name(unit("late", ids.flatMap((id) => ["--pair", String(id)]))))).toEqual(ids);
  expect(pool(unit("early"))).toEqual(["--pair", "0", "--queue", "--owner-pid", "4242", "--foreground"]);
  expect(pool(unit("early", ["--pair", "0", "--queue", "--owner-pid", "7"]))).toEqual(["--pair", "0", "--queue", "--owner-pid", "7", "--foreground"]);
  expect(pool(unit(""))).toEqual(["--pair", "0", "--queue", "--foreground"]);
  expect([ownerWalkStart({ [NATIVE_OUTER_PID]: "4242" }, 99), ownerWalkStart({}, 99), ownerWalkStart({ [NATIVE_OUTER_PID]: "" }, 99)]).toEqual([4242, 99, 99]);
});
