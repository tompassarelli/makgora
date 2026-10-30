import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const ts = join(import.meta.dir, "..");
const MARK = `<meta name="wisp" content="menu page" />`;
const DOCUMENTS_IN_PREFIX = "drive_c/users/steamuser/Documents/Warcraft III";
const POOL_PAIR = 12;
const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

const fixture = () => {
  const home = mkdtempSync(join(tmpdir(), "smashcraft-online-pool-"));
  cleanups.push(() => rmSync(home, { recursive: true, force: true }));
  const data = join(home, "data");
  const pages = new Map<string, string>();
  const prefixes = new Map<string, string>();
  for (const name of [`lan${POOL_PAIR}a`, `lan${POOL_PAIR}b`, "lan3a"]) {
    const prefix = join(data, "wisp/lan/clients", name, "pfx");
    const retail = join(prefix, "drive_c/Program Files (x86)/Warcraft III/_retail_");
    mkdirSync(join(retail, "x86_64"), { recursive: true });
    mkdirSync(join(prefix, DOCUMENTS_IN_PREFIX, "Maps/00-Smashcraft"), { recursive: true });
    writeFileSync(join(prefix, DOCUMENTS_IN_PREFIX, "Maps/00-Smashcraft/Smashcraft 0.1-dev.1.w3x"), "map");
    writeFileSync(join(prefix, "user.reg"), "WINE REGISTRY Version 2\n");
    const page = join(retail, "webui/index.html");
    mkdirSync(dirname(page), { recursive: true });
    writeFileSync(page, `${MARK}\n<script>var report = "http://127.0.0.1:${47200 + POOL_PAIR * 2}";</script>\n`);
    pages.set(name, page);
    prefixes.set(name, prefix);
  }
  const state = join(home, ".local/state/smashcraft");
  mkdirSync(state, { recursive: true });
  const client = (name: string) => ({ name, run: "true", documents: join(prefixes.get(name)!, DOCUMENTS_IN_PREFIX), menuReportPort: 47124 });
  writeFileSync(join(state, "clients.json"), JSON.stringify({ clients: [...prefixes.keys()].map(client) }));
  const tomsPrefix = join(home, ".local/share/Steam/steamapps/compatdata/3516115571/pfx");
  mkdirSync(dirname(tomsPrefix), { recursive: true });
  symlinkSync(prefixes.get(`lan${POOL_PAIR}a`)!, tomsPrefix);
  const { XDG_RUNTIME_DIR: _runtime, ...inherited } = process.env;
  const env = { ...inherited, HOME: home, XDG_DATA_HOME: data, XDG_STATE_HOME: join(home, "state"), XDG_RUNTIME_DIR: join(home, "run") };
  const snapshot = () => Object.fromEntries([...pages].map(([name, page]) => [name, readFileSync(page, "utf8")]));
  return { env, snapshot };
};

test("a playtest's menu page setup and repair leave every LAN pool client's page byte-identical, however the client is reached [k5 boundary lan-pool-pages]", async () => {
  const { env, snapshot } = fixture();
  const before = snapshot();
  const runs = [
    ["online", "setup", "--client", `lan${POOL_PAIR}a`],
    ["online", "setup", "--client", "lan3a"],
    ["online", "setup"],
    ["online", "host", "--repair", "--client", `lan${POOL_PAIR}a`],
    ["online", "host", "--repair"],
  ];
  const results = await Promise.all(runs.map(async (args) => {
    const child = Bun.spawn([process.execPath, "scripts/wisp.ts", ...args], { cwd: ts, env, stdout: "pipe", stderr: "pipe" });
    const code = await child.exited;
    return { args: args.join(" "), code, output: `${await new Response(child.stdout).text()}${await new Response(child.stderr).text()}` };
  }));
  expect(snapshot()).toEqual(before);
  for (const { args, code, output } of results.filter((run) => run.args.includes("setup"))) expect({ args, code }, output).toEqual({ args, code: 1 });
}, 120_000);
