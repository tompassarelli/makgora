import { expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { GameFiles } from "wisp/scripts/wisp/gameFiles";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { CURRENT_CANDIDATE, MAP_PROFILES } from "../scripts/wisp/acceptChecks";
import { poolUnitCommand, poolUnitName, pairNeedsRestart } from "../scripts/wisp/commands/lanPoolUnit";
import { smashcraftDoctor } from "../scripts/wisp/doctor";
import { ACCEPT_IN_UNIT, acceptUnitCommand, inAcceptUnit } from "../scripts/wisp/commands/acceptUnit";
import { gameFilesLayer } from "../scripts/wisp/project";
import { NativeClientInvalid, NativeToolMissing, repairPackager, resolveTools, unresolvedLibraries, validateClients, withRuntimeTools } from "../scripts/wisp/nativeTools";

const here = mkdtempSync(join(tmpdir(), "native-harness-"));
const real = join(here, "xdotool");
writeFileSync(real, "");

test("accept resolves its own tools and names the missing one before any client starts [k2 property]", async () => {
  const found = await Effect.runPromise(resolveTools(["xdotool"], { env: {}, which: () => real, build: () => Effect.fail("no nix") }));
  expect(found).toEqual({ xdotool: real });
  const built = join(here, "built");
  mkdirSync(join(built, "bin"), { recursive: true });
  writeFileSync(join(built, "bin", "grim"), "");
  expect(await Effect.runPromise(resolveTools(["grim"], { env: {}, which: () => null, build: () => Effect.succeed(built) }))).toEqual({ grim: join(built, "bin", "grim") });
  const failure = await Effect.runPromise(resolveTools(["xdotool", "tesseract"], { env: {}, which: () => null, build: () => Effect.fail("offline") }).pipe(Effect.flip));
  expect(failure).toBeInstanceOf(NativeToolMissing);
  expect(failure.tools).toEqual(["xdotool", "tesseract"]);
  expect(failure.message).toContain("xdotool");
});

test("a stored tool path never survives into the clients file a run uses [k2 property]", () => {
  const stored = JSON.stringify({ tools: { xdotool: "/nix/store/stale/bin/xdotool" }, clients: [{ name: "a" }] });
  const derived = JSON.parse(withRuntimeTools(stored, { xdotool: real }));
  expect(derived.tools).toEqual({ xdotool: real });
  expect(derived.clients).toEqual([{ name: "a" }]);
});

test("client names must map to existing account-clone or pool prefixes [k2 property]", async () => {
  const documents = join(here, "online/clone-c/pfx/drive_c/users/steamuser/Documents/Warcraft III");
  mkdirSync(documents, { recursive: true });
  await Effect.runPromise(validateClients([{ name: "a", documents }]));
  const melee = await Effect.runPromise(validateClients([{ name: "a", documents: "/home/tom/.local/share/wc3-melee/client-a/pfx/drive_c/Documents" }], () => true).pipe(Effect.flip));
  expect(melee).toBeInstanceOf(NativeClientInvalid);
  const absent = await Effect.runPromise(validateClients([{ name: "b", documents: join(here, "online/clone-b/pfx/Documents") }]).pipe(Effect.flip));
  expect(absent.message).toContain("no Documents folder");
});

test("the launcher follows the client's prefix, not its name [k2 property]", () => {
  const file = join(here, "clients.json");
  writeFileSync(file, JSON.stringify({ clients: [{ name: "a", run: "/run/x", documents: "/h/online/clone-c/pfx/drive_c/Documents" }, { name: "b", run: "/run/y", documents: "/h/online/clone-b/pfx/drive_c/Documents" }] }));
  const { start } = smashcraftDoctor(file);
  expect(start["a"]).toMatchObject({ command: [expect.stringContaining("launch.sh"), "c", "/run/x"] });
  expect(start["b"]).toMatchObject({ command: [expect.stringContaining("launch.sh"), "b", "/run/y"] });
});

test("the gate map defaults to the HEAD candidate, never a pinned build [k2 property]", () => {
  expect(MAP_PROFILES["gate-playable"]?.path).toBe(CURRENT_CANDIDATE);
  expect(JSON.stringify(MAP_PROFILES["gate-playable"])).not.toContain("0.0.133");
});

test("the pool runs in a user unit that lan stop names, and a dropped client restarts its pair [k2 property]", () => {
  const command = poolUnitCommand(["--pair", "3", "--pool-profile", "visual"], "/bin");
  expect(command.slice(0, 3)).toEqual(["systemd-run", "--user", "--collect"]);
  expect(command).toContain(`--unit=${poolUnitName([3])}`);
  expect(command.at(-1)).toBe("--foreground");
  expect(pairNeedsRestart({ clients: [{ name: "a", pid: 1 }, { name: "b", pid: 2 }] })).toBe(false);
  expect(pairNeedsRestart({ clients: [{ name: "a", pid: 1 }, { name: "b" }] })).toBe(true);
  expect(pairNeedsRestart(undefined)).toBe(true);
});

test("a packager whose stormlib left the store loses its source stamp so it is recompiled [k2 property]", async () => {
  const packer = join(here, "map-pack");
  writeFileSync(packer, "");
  writeFileSync(`${packer}.source-sha256`, "abc\n");
  const live = () => Effect.succeed("\tlibc.so.6 => /nix/store/x/lib/libc.so.6 (0x1)\n");
  expect(await Effect.runPromise(repairPackager(packer, live))).toBe(false);
  expect(existsSync(`${packer}.source-sha256`)).toBe(true);
  const stale = () => Effect.succeed("\tlibstorm.so.9 => not found\n\tlibc.so.6 => /nix/store/x/lib/libc.so.6 (0x1)\n");
  expect(await Effect.runPromise(repairPackager(packer, stale))).toBe(true);
  expect(existsSync(`${packer}.source-sha256`)).toBe(false);
  expect(unresolvedLibraries("\tlibstorm.so.9 => not found\n")).toEqual(["libstorm.so.9"]);
});

test("installing a map into a fresh Documents folder creates Maps/00-Smashcraft/tests [k2 property]", async () => {
  const documents = join(here, "fresh-documents");
  const map = join(here, "candidate.w3x");
  writeFileSync(map, "map");
  await Effect.runPromise(GameFiles.use((files) => files.installMap(documents, map)).pipe(Effect.provide(gameFilesLayer)));
  expect(existsSync(join(documents, "Maps/00-Smashcraft/tests/candidate.w3x"))).toBe(true);
});

test("a native accept runs as a user service once, and a dry run or the service itself runs in place [k2 property]", () => {
  const command = acceptUnitCommand(["--only", "gate-moves", "--pair", "0"], "/bin", 7);
  expect(command.slice(0, 3)).toEqual(["systemd-run", "--user", "--wait"]);
  expect(command).toContain(`--setenv=${ACCEPT_IN_UNIT}=1`);
  expect(command.slice(command.indexOf("accept"))).toEqual(["accept", "--only", "gate-moves", "--pair", "0"]);
  expect(inAcceptUnit(["--pair", "0"], {})).toBe(true);
  expect(inAcceptUnit(["--pair", "0"], { [ACCEPT_IN_UNIT]: "1" })).toBe(false);
  expect(inAcceptUnit(["--dry-run"], {})).toBe(false);
});
