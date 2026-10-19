import { expect, test } from "bun:test";
import { testHeadless } from "./headless";
import type { ClientFiles } from "wisp/src/headless/client";
import type { Lockstep } from "wisp/src/headless/lockstep";
import { f32 } from "wisp/src/sim/f32";
import { PLAYABLE_BUILD } from "../src/game/session/currentBuild";
import type { MapBuild } from "../src/game/session/build";
import { applyBindingPreset, encodeSettings } from "../src/game/ui/bindingSettings";
import { Action } from "../src/game/input/actions";
import { DEFAULT_PRESET, keyFor, presetBindings } from "../src/game/input/keyBindings";
import { Phase } from "../src/game/lobby/lobbyState";
import { LOAD_PROFILE } from "../src/game/ui/settingsUi";
import { COMMANDS_TITLE, CONTROLS_TITLE, HOW_TO_PLAY_TITLE, PLAYER_COMMANDS, START_HINT } from "../src/game/ui/helpText";
import { type ShellState, shellState } from "../src/host/loop/state";
import { views } from "../src/host/loop/ui";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { questLog } from "../scripts/wisp/headlessNatives";
import { DONE_X, DONE_Y } from "../scripts/wisp/startControls";
import { entryFor } from "./desync/journeys";

const headless = testHeadless(SMASHCRAFT_HEADLESS);

const BUILD: MapBuild = { ...PLAYABLE_BUILD, id: "typescript-controls-first" };
const BINDINGS_FILE = "MeleePrototypeBindings.pld";
const PROFILE_X = f32(LOAD_PROFILE.x + f32(LOAD_PROFILE.width / 2));
const PROFILE_Y = f32(LOAD_PROFILE.y - f32(LOAD_PROFILE.height / 2));

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

const openOn = (clients: Lockstep, slot: 0 | 1): boolean[] => clients.clients.map((_, index) => views(shellOf(clients, index)).settings[slot].isOpen());

function bindingsHere(slot: 0 | 1) {
  const s = shellState();
  if (s === undefined) throw new Error("no shell");
  return s.participants[slot].bindings;
}

const shown = (clients: Lockstep, index: number, text: string): boolean => clients.clients[index]?.frames.shownText().some(line => line.includes(text)) ?? false;

function started(disk: Disk): Lockstep {
  const clients = headless.clients(entryFor(BUILD), [0, 1], { files: diskFiles(disk) });
  clients.start();
  clients.frames(60);
  return clients;
}

function tap(clients: Lockstep, slot: number, key: number): void {
  clients.key(slot, key, 0, true);
  clients.frames(1);
  clients.key(slot, key, 0, false);
  clients.frames(1);
}

test("every start opens each player's own Controls screen before fighter select, and each player's Done leads only them on to choose a fighter [k1 scenario]", () => {
  const clients = started(new Map());
  expect(openOn(clients, 0)).toEqual([true, true]);
  expect(openOn(clients, 1)).toEqual([true, true]);
  for (const index of [0, 1]) {
    expect(shellOf(clients, index).game.phase).toBe(Phase.characterMenu);
    expect(shown(clients, index, "CONTROLS")).toBe(true);
    expect(shown(clients, index, "ESDF")).toBe(true);
    expect(shown(clients, index, "Hitbox")).toBe(true);
    expect(shown(clients, index, "No saved profile")).toBe(true);
  }
  const right = keyFor(presetBindings(DEFAULT_PRESET), Action.moveRight, 0) ?? 0;
  const choice = () => clients.clients.map((_, index) => shellOf(clients, index).game.characterChoices[0]);
  const before = choice();
  tap(clients, 0, right);
  expect(choice(), "the Controls screen holds fighter select").toEqual(before);

  expect(clients.click(0, DONE_X, DONE_Y)).toBe(true);
  clients.frames(2);
  expect(openOn(clients, 0)).toEqual([false, false]);
  expect(openOn(clients, 1)).toEqual([true, true]);
  tap(clients, 0, right);
  const after = choice();
  expect(after[0]).not.toBe(before[0]);
  expect(after[1]).toBe(after[0]);

  clients.frames(600);
  expect(openOn(clients, 0), "Done is final for this game").toEqual([false, false]);
  tap(clients, 0, 0x70);
  expect(openOn(clients, 0), "F1 reopens it").toEqual([true, true]);
  expect(clients.firstDivergence()).toBeUndefined();
});

test("each player's own Controls screen, with their saved profile, is already drawn when the loading screen ends, before the first game frame, and stays unchanged once their synced load opens it [k1 scenario]", () => {
  const disk: Disk = new Map();
  const first = started(disk);
  first.everywhere(() => applyBindingPreset(bindingsHere(0), "custom"));
  first.chat(0, "-save");
  first.frames(5);

  const clients = headless.clients(entryFor(BUILD), [0, 1], { files: diskFiles(disk) });
  clients.start();
  expect(openOn(clients, 0)).toEqual([false, false]);
  for (const index of [0, 1]) expect(shown(clients, index, "CONTROLS")).toBe(true);
  expect(shown(clients, 0, "Saved profile loaded")).toBe(true);
  expect(shown(clients, 1, "Saved profile loaded"), "each client draws only its own player's screen").toBe(false);
  expect(shown(clients, 1, "No saved profile")).toBe(true);
  const panelLines = (index: number): string[] => clients.clients[index]?.frames.shownText().filter(line => /CONTROLS|profile|controls ready|Delay|Recalibrate/.test(line)) ?? [];
  const drawn = [panelLines(0), panelLines(1)];
  expect(drawn[0]?.length).toBeGreaterThan(3);

  clients.frames(60);
  expect(openOn(clients, 0)).toEqual([true, true]);
  expect([panelLines(0), panelLines(1)], "nothing on the drawn screen changes when it opens").toEqual(drawn);
  expect(clients.firstDivergence()).toBeUndefined();
});

test("a saved profile is preselected and announced at start, and Load profile brings it back after trying a preset, on every client [k1 scenario]", () => {
  const disk: Disk = new Map();
  const first = started(disk);
  first.everywhere(() => applyBindingPreset(bindingsHere(0), "custom"));
  first.chat(0, "-save");
  first.frames(5);
  expect(disk.get(0)?.has(BINDINGS_FILE)).toBe(true);

  const clients = started(disk);
  const settings = (index: number, slot: 0 | 1) => shellOf(clients, index).participants[slot].bindings;
  const saved = encodeSettings(settings(0, 0));
  for (const index of [0, 1]) {
    expect(settings(index, 0).profile).toBe("saved");
    expect(settings(index, 0).fromProfile).toBe(true);
    expect(encodeSettings(settings(index, 0))).toBe(saved);
    expect(settings(index, 1).profile).toBe("none");
  }
  expect(saved).toBe(encodeSettings({ ...settings(0, 0), bindings: presetBindings("custom") }));
  expect(shown(clients, 0, "Saved profile loaded")).toBe(true);
  expect(shown(clients, 0, "|cffffcc00Load profile|r")).toBe(true);
  expect(shown(clients, 1, "No saved profile")).toBe(true);

  clients.everywhere(() => applyBindingPreset(bindingsHere(0), "standard"));
  expect(encodeSettings(settings(0, 0))).not.toBe(saved);
  expect(clients.click(0, PROFILE_X, PROFILE_Y)).toBe(true);
  clients.frames(30);
  for (const index of [0, 1]) {
    expect(encodeSettings(settings(index, 0))).toBe(saved);
    expect(settings(index, 0).fromProfile).toBe(true);
  }

  const before = encodeSettings(settings(0, 1));
  expect(clients.click(1, PROFILE_X, PROFILE_Y)).toBe(true);
  clients.frames(30);
  for (const index of [0, 1]) expect(encodeSettings(settings(index, 1))).toBe(before);
  expect(settings(1, 1).message).toContain("No saved profile");

  expect(clients.click(0, DONE_X, DONE_Y)).toBe(true);
  clients.frames(2);
  expect(openOn(clients, 0)).toEqual([false, false]);
  expect(clients.clients.map((_, index) => shellOf(clients, index).game.phase)).toEqual([Phase.characterMenu, Phase.characterMenu]);
  expect(clients.firstDivergence()).toBeUndefined();
});

test("F9 on the Controls screen closes it, so the quest log F9 opens is not hidden behind it, for that player only [k1 scenario]", () => {
  const clients = started(new Map());
  expect(openOn(clients, 0)).toEqual([true, true]);
  tap(clients, 0, 0x78);
  expect(openOn(clients, 0)).toEqual([false, false]);
  expect(openOn(clients, 1)).toEqual([true, true]);
  expect(clients.firstDivergence()).toBeUndefined();
});

test("the start line points to -help and F9; -help and -commands print every player command to the sender only; F9 holds Controls, How to play and Commands [k1 scenario]", () => {
  const clients = started(new Map());
  for (const client of clients.clients) expect(client.messages).toContain(START_HINT);
  for (const command of ["-help", "-commands"]) {
    const counts = clients.clients.map(client => client.messages.length);
    clients.chat(1, command);
    clients.frames(2);
    expect(clients.clients[1]?.messages.slice(counts[1])).toEqual([...PLAYER_COMMANDS]);
    expect(clients.clients[0]?.messages.slice(counts[0])).toEqual([]);
  }
  expect(PLAYER_COMMANDS.some(line => line.startsWith("-save"))).toBe(true);
  expect(PLAYER_COMMANDS.some(line => line.startsWith("-load"))).toBe(true);
  for (const client of clients.clients) {
    const entries = questLog(client);
    expect(entries.map(({ title }) => title)).toEqual([CONTROLS_TITLE, HOW_TO_PLAY_TITLE, COMMANDS_TITLE]);
    expect(entries[0]?.description).toContain("Your layout: ESDF");
    expect(entries[0]?.description).toContain("F1");
    for (const topic of ["Stocks", "Shield", "Recovery"]) expect(entries[1]?.description).toContain(topic);
    for (const line of PLAYER_COMMANDS) expect(entries[2]?.description).toContain(line);
  }
  clients.everywhere(() => applyBindingPreset(bindingsHere(0), "standard"));
  clients.frames(2);
  expect(questLog(clients.clients[0] ?? {})[0]?.description).toContain("Your layout: Hitbox");
  expect(questLog(clients.clients[1] ?? {})[0]?.description, "each player's Controls entry shows their own layout").toContain("Your layout: ESDF");
  expect(clients.firstDivergence()).toBeUndefined();
});
