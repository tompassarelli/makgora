import { expect, test } from "bun:test";
import { testHeadless } from "./headless";
import type { ClientFiles } from "wisp/src/headless/client";
import type { Lockstep } from "wisp/src/headless/lockstep";
import { PLAYABLE_BUILD } from "../src/game/session/currentBuild";
import type { MapBuild } from "../src/game/session/build";
import { applyBindingPreset, beginKeyCapture, chooseDelay, encodeSettings, pickBindingPreset } from "../src/game/ui/bindingSettings";
import { Action } from "../src/game/input/actions";
import { DEFAULT_PRESET, type KeyBindings, actionFor, keyFor, presetBindings } from "../src/game/input/keyBindings";
import { Phase, holdingStart } from "../src/game/lobby/lobbyState";
import { fighterAt } from "../src/game/sim/roster";
import { Key } from "../src/host/loop/keyEvents";
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

const ESDF = presetBindings(DEFAULT_PRESET);
const HITBOX = presetBindings("standard");
const keyOf = (bindings: KeyBindings, action: Action): number => keyFor(bindings, action, 0) ?? 0;

function tap(clients: Lockstep, slot: number, key: number): void {
  clients.key(slot, key, 0, true);
  clients.frames(1);
  clients.key(slot, key, 0, false);
  clients.frames(1);
}

function settle(clients: Lockstep, done: (s: ShellState) => boolean, frames: number): void {
  for (let frame = 0; frame < frames && !clients.clients.every((_, index) => done(shellOf(clients, index))); frame++) clients.frames(1);
}

test("a new player starts on ESDF, and picking Hitbox moves up to Space, saves it and comes back after a restart on both clients [k1 scenario]", () => {
  const disk: Disk = new Map();
  const first = started(disk);
  const esdf = encodeSettings({ ...shellOf(first, 0).participants[0].bindings, bindings: ESDF });
  expect(encodedEverywhere(first, 0)).toEqual([esdf, esdf]);
  everyone(first, s => pickBindingPreset(s.participants[0].bindings, "standard"));
  first.frames(5);
  expect(disk.get(0)?.has(BINDINGS_FILE)).toBe(true);
  for (const index of [0, 1]) expect(keyFor(shellOf(first, index).participants[0].bindings.bindings, Action.moveUp, 0)).toBe(32);

  const second = started(disk);
  const hitbox = encodedEverywhere(second, 0);
  expect(hitbox[0]).toBe(encodeSettings({ ...shellOf(second, 0).participants[0].bindings, bindings: HITBOX }));
  expect(hitbox[1]).toBe(hitbox[0]);
  expect(encodedEverywhere(second, 1)[0]).toBe(esdf);
});

test("clicking a lit key then pressing another moves that action to the new key on both clients, and the new key walks the fighter in a match [k1 scenario]", () => {
  const clients = started(new Map());
  const right = keyOf(ESDF, Action.moveRight);
  const moved = "W".charCodeAt(0);
  everyone(clients, s => beginKeyCapture(s.participants[0].bindings, right));
  tap(clients, 0, moved);
  for (const index of [0, 1]) {
    const { bindings, capture } = shellOf(clients, index).participants[0].bindings;
    expect(keyFor(bindings, Action.moveRight, 0)).toBe(moved);
    expect(actionFor(bindings, right)).toBeUndefined();
    expect(capture).toBeUndefined();
  }
  tap(clients, 0, moved);
  tap(clients, 1, right);
  tap(clients, 0, Key.y);
  settle(clients, s => s.game.phase === Phase.stageMenu, 60);
  tap(clients, 0, Key.y);
  settle(clients, s => s.game.phase === Phase.match && !holdingStart(s.game), 360);
  const x = () => clients.clients.map((_, index) => fighterAt(shellOf(clients, index).world, 0).motion.x);
  const before = x();
  clients.key(0, moved, 0, true);
  clients.frames(20);
  clients.key(0, moved, 0, false);
  clients.frames(5);
  const after = x();
  expect(after[0]).toBeGreaterThan(before[0] ?? 0);
  expect(after[1]).toBe(after[0]);
  expect(clients.firstDivergence()).toBeUndefined();
});

test("the pause menu steps with each player's own up and down keys and confirms with their attack key, in ESDF and in Hitbox [k1 scenario]", () => {
  const clients = started(new Map());
  everyone(clients, s => applyBindingPreset(s.participants[1].bindings, "standard"));
  tap(clients, 0, keyOf(ESDF, Action.moveRight));
  tap(clients, 1, keyOf(HITBOX, Action.moveRight));
  tap(clients, 0, Key.y);
  settle(clients, s => s.game.phase === Phase.stageMenu, 60);
  tap(clients, 0, Key.y);
  settle(clients, s => s.game.phase === Phase.match && !holdingStart(s.game), 360);
  tap(clients, 0, Key.backspace);
  settle(clients, s => s.session.paused, 60);
  const choice = () => clients.clients.map((_, index) => shellOf(clients, index).pauseMenu?.choice);
  expect(choice()).toEqual([0, 0]);
  tap(clients, 0, keyOf(ESDF, Action.moveDown));
  expect(choice(), "ESDF D steps down").toEqual([1, 1]);
  tap(clients, 0, 32);
  expect(choice(), "Space is jump in ESDF, not up").toEqual([1, 1]);
  tap(clients, 1, keyOf(HITBOX, Action.moveDown));
  expect(choice(), "Hitbox E steps down").toEqual([2, 2]);
  tap(clients, 0, keyOf(ESDF, Action.moveUp));
  expect(choice(), "ESDF E steps up").toEqual([1, 1]);
  tap(clients, 1, keyOf(HITBOX, Action.moveUp));
  expect(choice(), "Hitbox Space steps up").toEqual([0, 0]);
  tap(clients, 1, keyOf(HITBOX, Action.moveDown));
  tap(clients, 1, keyOf(HITBOX, Action.attack));
  settle(clients, s => s.game.phase === Phase.characterMenu, 60);
  expect(clients.clients.map((_, index) => shellOf(clients, index).game.phase)).toEqual([Phase.characterMenu, Phase.characterMenu]);
  expect(clients.firstDivergence()).toBeUndefined();
});
