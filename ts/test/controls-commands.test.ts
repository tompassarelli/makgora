import { expect, test } from "bun:test";
import { testHeadless } from "./headless";
import type { ClientFiles } from "wisp/src/headless/client";
import type { Lockstep } from "wisp/src/headless/lockstep";
import { PLAYABLE_BUILD } from "../src/game/session/currentBuild";
import type { MapBuild } from "../src/game/session/build";
import { applyBindingPreset, chooseDelay, encodeSettings } from "../src/game/ui/bindingSettings";
import { type ShellState, shellState } from "../src/host/loop/state";
import { confirmedChecksum } from "../src/host/loop/diagnostics";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { entryFor } from "./desync/journeys";

const headless = testHeadless(SMASHCRAFT_HEADLESS);

const BUILD: MapBuild = { ...PLAYABLE_BUILD, id: "typescript-controls-commands" };
const BINDINGS_FILE = "MeleePrototypeBindings.pld";

type Disk = Map<number, Map<string, readonly string[]>>;

function preloadedChunks(lines: readonly string[]): string[] {
  return [...lines.join("").matchAll(/BlzSetAbilityTooltip\('\$wsl', "([^"]*)", \d+\)/g)].map(match => match[1] ?? "");
}

function diskFiles(disk: Disk): (slot: number) => ClientFiles {
  return (slot) => {
    const own = disk.get(slot) ?? new Map<string, readonly string[]>();
    disk.set(slot, own);
    return { written: (name, lines) => { own.set(name, preloadedChunks(lines)); }, read: name => own.get(name) };
  };
}

function shellOf(clients: Lockstep, index: number): ShellState {
  let found: ShellState | undefined;
  clients.clients[index]?.run(() => { found = shellState(); });
  if (found === undefined) throw new Error(`client ${index} has no shell`);
  return found;
}

function encodedEverywhere(clients: Lockstep, slot: number): string[] {
  return clients.clients.map((_, index) => encodeSettings(shellOf(clients, index).participants[slot].bindings));
}

function everyone(clients: Lockstep, change: (s: ShellState) => void): void {
  clients.everywhere(() => {
    const s = shellState();
    if (s !== undefined) change(s);
  });
}

function checksums(clients: Lockstep): string[] {
  return clients.clients.map((_, index) => confirmedChecksum(shellOf(clients, index)));
}

function started(disk: Disk): Lockstep {
  const clients = headless.clients(entryFor(BUILD), [0, 1], { files: diskFiles(disk) });
  clients.start();
  clients.frames(60);
  for (let index = 0; index < 2; index++) expect(shellOf(clients, index).participants[0].bindings.ready).toBe(true);
  return clients;
}

test("-save writes the local scheme and -load brings it back through the synced file path [k1 scenario]", () => {
  const disk: Disk = new Map();
  const first = started(disk);
  everyone(first, s => {
    applyBindingPreset(s.participants[0].bindings, "custom");
    chooseDelay(s.participants[0].bindings, 3);
  });
  const custom = encodedEverywhere(first, 0)[0] ?? "";
  first.chat(0, "-save");
  first.frames(5);
  expect(disk.get(0)?.has(BINDINGS_FILE)).toBe(true);
  expect(disk.get(1)?.has(BINDINGS_FILE) ?? false).toBe(false);
  expect(first.clients[0]?.messages).toContain("Controls saved for next time.");
  expect(first.clients[1]?.messages).not.toContain("Controls saved for next time.");

  everyone(first, s => {
    applyBindingPreset(s.participants[0].bindings, "standard");
    chooseDelay(s.participants[0].bindings, -1);
  });
  expect(encodedEverywhere(first, 0)[0]).not.toBe(custom);
  first.chat(0, "-load");
  first.frames(30);
  expect(encodedEverywhere(first, 0)).toEqual([custom, custom]);
  expect(first.clients[0]?.messages).toContain("Saved controls loaded.");
  expect(first.clients[1]?.messages).not.toContain("Saved controls loaded.");
  const sums = checksums(first);
  expect(sums[1]).toBe(sums[0]);

  const second = started(disk);
  expect(encodedEverywhere(second, 0)).toEqual([custom, custom]);
  expect(shellOf(second, 0).participants[0].bindings.message).toBe("Saved controls loaded.");
  everyone(second, s => applyBindingPreset(s.participants[0].bindings, "standard"));
  const standard = encodedEverywhere(second, 0)[0] ?? "";
  second.chat(0, "-save");
  second.frames(5);
  everyone(second, s => applyBindingPreset(s.participants[0].bindings, "custom"));
  second.chat(0, "-load");
  second.frames(30);
  expect(encodedEverywhere(second, 0)).toEqual([standard, standard]);
});

test("-load with nothing saved keeps the current scheme and tells only that player [k1 scenario]", () => {
  const clients = started(new Map());
  everyone(clients, s => applyBindingPreset(s.participants[1].bindings, "custom"));
  const before = encodedEverywhere(clients, 1);
  clients.chat(1, "-load");
  clients.frames(30);
  expect(encodedEverywhere(clients, 1)).toEqual(before);
  expect(clients.clients[1]?.messages).toContain("No saved controls yet. Type -save to keep these.");
  expect(clients.clients[0]?.messages).not.toContain("No saved controls yet. Type -save to keep these.");
});
