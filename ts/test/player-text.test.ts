





import { expect, test } from "bun:test";
import { passStartControls } from "../scripts/wisp/startControls";
import { LEFT_KEY, RIGHT_KEY, testHeadless } from "./headless";
import type { HeadlessClient } from "wisp/src/headless/client";
import type { Lockstep } from "wisp/src/headless/lockstep";
import { Phase, characterReady, holdingStart } from "../src/game/lobby/lobbyState";
import { CURRENT_BUILD, INTEGRITY_BUILD, PLAYABLE_BUILD } from "../src/game/session/currentBuild";
import { install as installPlayable, start as startPlayable } from "../src/host/entries/playableMain";
import { Key } from "../src/host/loop/keyEvents";
import { panelActions } from "../src/host/loop/menus";
import { shell } from "../src/host/loop/state";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { RESULTS_DELAY_FRAMES } from "../src/game/render/matchPresentation";
import { cellRect, rosterGrid } from "../src/game/menu/selectionGrid";
import { cardX, readyChipSize } from "../src/game/menu/selectionDrag";
import { PLAYABLE_CHARACTERS } from "../src/game/sim/heroes/registry";
import { f32 } from "wisp/src/sim/f32";

const headless = testHeadless(SMASHCRAFT_HEADLESS);


const DEVELOPER_LINE_TERMS = [
  "Developer test", "player=", "phase=", "x=", "z=", "input=", "mode=", "normal=", "move=", "attack-frame=",
  "simulation=", "predicted=", "serial=", "down=", "DI=", "Ctrl+R",
];

const BUILD_TERMS = [CURRENT_BUILD.id, INTEGRITY_BUILD.id, PLAYABLE_BUILD.id, PLAYABLE_BUILD.inputProfile, PLAYABLE_BUILD.presentation];

const IMPLEMENTATION_TERMS = ["journal", "editbox", "rollback", "presentation"];
const DENIED = [...DEVELOPER_LINE_TERMS, ...BUILD_TERMS, ...IMPLEMENTATION_TERMS].map((term) => term.toLowerCase());

type Native = (...args: unknown[]) => unknown;

interface ShownFrame {

  readonly parent: unknown;
  readonly name: string;
  text: string;
  visible: boolean;
  width: number;
  height: number;
  level: number;
}






class FrameView {
  private readonly frames = new Map<unknown, ShownFrame>();

  constructor(client: HeadlessClient) {
    const { natives } = client;
    natives.BlzGetMouseScreenPosX = () => client.mouseScreenX;
    natives.BlzGetMouseScreenPosY = () => client.mouseScreenY;
    natives.BlzIsMouseButtonPressed = (button: unknown) => client.heldMouseButtons.has(button);
    const created = (name: string, parentArg: number) => {
      const create = natives[name] as Native;
      natives[name] = (...args: unknown[]) => {
        const frame = create(...args);
        this.frames.set(frame, { parent: args[parentArg], name: String(args[name === "BlzCreateFrameByType" ? 1 : 0]), text: "", visible: true, width: 0, height: 0, level: 0 });
        return frame;
      };
    };
    created("BlzCreateFrameByType", 2);
    created("BlzCreateFrame", 1);
    created("BlzCreateSimpleFrame", 1);
    const destroy = natives.BlzDestroyFrame as Native;
    natives.BlzDestroyFrame = (frame: unknown) => {
      this.frames.delete(frame);
      return destroy(frame);
    };
    natives.BlzFrameSetText = (frame: unknown, text: string) => {
      this.frame(frame).text = text;
    };
    natives.BlzFrameGetText = (frame: unknown) => this.frame(frame).text;
    natives.BlzFrameSetVisible = (frame: unknown, visible: boolean) => {
      this.frame(frame).visible = visible;
    };
    const setSize = natives.BlzFrameSetSize as Native;
    natives.BlzFrameSetSize = (frame: unknown, width: number, height: number) => {
      this.frame(frame).width = width;
      this.frame(frame).height = height;
      return setSize(frame, width, height);
    };
    const setLevel = natives.BlzFrameSetLevel as Native;
    natives.BlzFrameSetLevel = (frame: unknown, level: number) => {
      this.frame(frame).level = level;
      return setLevel(frame, level);
    };
  }

  private frame(handle: unknown): ShownFrame {
    let known = this.frames.get(handle);
    if (known === undefined) {
      known = { parent: undefined, name: "", text: "", visible: true, width: 0, height: 0, level: 0 };
      this.frames.set(handle, known);
    }
    return known;
  }

  private shown(handle: unknown): boolean {
    for (let at = this.frames.get(handle); at !== undefined; at = this.frames.get(at.parent)) if (!at.visible) return false;
    return true;
  }


  texts(): string[] {
    return [...this.frames].filter(([handle, { text }]) => text !== "" && this.shown(handle)).map(([, { text }]) => text);
  }

  named(name: string): ShownFrame | undefined {
    return [...this.frames.values()].find(frame => frame.name === name);
  }

  visible(name: string): boolean {
    const found = [...this.frames].find(([, frame]) => frame.name === name);
    return found !== undefined && this.shown(found[0]);
  }

  above(name: string, otherName: string): boolean {
    const branch = (target: string) => {
      const path: unknown[] = [];
      let handle = [...this.frames].find(([, frame]) => frame.name === target)?.[0];
      while (handle !== undefined) {
        path.unshift(handle);
        handle = this.frames.get(handle)?.parent;
      }
      return path;
    };
    const upper = branch(name);
    const lower = branch(otherName);
    let common = 0;
    while (common < upper.length && common < lower.length && upper[common] === lower[common]) common++;
    if (common === 0 || common === upper.length || common === lower.length) return false;
    return (this.frames.get(upper[common])?.level ?? 0) > (this.frames.get(lower[common])?.level ?? 0);
  }

  clickNamed(clients: Lockstep, client: HeadlessClient, name: string): void {
    const found = [...this.frames].find(([handle, frame]) => frame.name === name && this.shown(handle));
    if (found === undefined) throw new Error(`Missing visible button: ${name}`);
    const id = (client.natives.GetHandleId as Native)(found[0]);
    if (typeof id !== "number") throw new Error(`Missing frame id: ${name}`);
    for (const other of clients.clients) other.frameEvent(client.slot, id, other.natives.FRAMEEVENT_CONTROL_CLICK);
  }

  clickText(client: HeadlessClient, text: string): void {
    const found = [...this.frames].find(([handle, frame]) => frame.text === text && this.shown(handle));
    if (found === undefined) throw new Error(`Missing visible button: ${text}`);
    const id = (client.natives.GetHandleId as Native)(found[0]);
    if (typeof id !== "number") throw new Error(`Missing frame id: ${text}`);
    client.frameEvent(client.slot, id, client.natives.FRAMEEVENT_CONTROL_CLICK);
  }

}


function recordShown(clients: Lockstep, views: readonly FrameView[], shown: Set<string>): void {
  for (const view of views) for (const text of view.texts()) shown.add(text);
  for (const client of clients.clients) for (const message of client.messages) shown.add(message);
}

const developerText = (text: string) => DENIED.filter((term) => text.toLowerCase().includes(term));

test("all-ready controller Start advances selection and enters the match publishing BLOCKED once, never rewriting it during play [k1 scenario]", () => {
  const clients = headless.clients({ install: installPlayable, start: startPlayable });
  clients.start();
  clients.frames(30);
  passStartControls(clients);
  for (const slot of [0, 1]) clients.press(slot, RIGHT_KEY);
  clients.frames(10);
  const publication = (phase: string) => clients.everywhere(() => expect(shell().menuPublication?.phase).toBe(phase));
  publication("CHARACTER");
  clients.press(0, Key.y);
  clients.frames(20);
  publication("STAGE");
  clients.frames(120);
  publication("STAGE");
  clients.press(0, Key.y);
  for (let frame = 0; frame < 120; frame++) {
    clients.frames(1);
    let playing = false;
    clients.clients[0]?.run(() => { playing = shell().game.phase === Phase.match; });
    if (playing) break;
  }
  clients.everywhere(() => {
    expect(shell().game.phase).toBe(Phase.match);
    expect(shell().menuPublication?.phase).toBe("BLOCKED");
  });
  clients.frames(45);
  clients.everywhere(() => expect(shell().menuPublication).toEqual({ phase: "BLOCKED", ticks: 45 }));
});

test("the playable build keeps selection chips and cursor on their screen and shows no developer text through a match and results [k3 measure #346]", () => {
  const clients = headless.clients({ install: installPlayable, start: startPlayable });
  const records = clients.clients.map(client => ({ client, view: new FrameView(client) }));
  const views = records.map(record => record.view);
  const shown = new Set<string>();
  const frames = (count: number) => {
    for (let frame = 0; frame < count; frame++) {
      clients.frames(1);
      recordShown(clients, views, shown);
      for (const { client, view } of records) {
        client.run(() => {
          if (shell().game.phase !== Phase.characterMenu) expect(view.visible(`MeleeHand${client.slot}`)).toBe(false);
        });
      }
    }
  };
  const phases = () => clients.clients.map((client) => {
    let phase: Phase = Phase.characterMenu;
    client.run(() => {
      phase = shell().game.phase;
    });
    return phase;
  });

  clients.start();
  frames(30);
  for (const { client, view } of records) view.clickNamed(clients, client, `MeleeSettingsCloseHit${client.slot}`);
  frames(2);
  const grid = rosterGrid(PLAYABLE_CHARACTERS.length);
  const point = (x: number, y: number, down: boolean, carrying?: boolean) => {
    for (const client of clients.clients) {
      const width = Number((client.natives.BlzGetLocalClientWidth as Native)());
      const height = Number((client.natives.BlzGetLocalClientHeight as Native)());
      client.mouseScreenX = (width - height * 4 / 3) / 2 + x * height / f32(0.6);
      client.mouseScreenY = (f32(0.6) - y) * height / f32(0.6);
      if (down) client.heldMouseButtons.add(client.natives.MOUSE_BUTTON_TYPE_LEFT);
      else client.heldMouseButtons.delete(client.natives.MOUSE_BUTTON_TYPE_LEFT);
    }
    frames(2);
    for (const { client, view } of records) {
      const hand = `MeleeHand${client.slot}`;
      if (carrying !== undefined && client.slot === 0) expect(view.visible(hand)).toBe(carrying);
      expect(view.above(hand, `MeleeCard${client.slot}_0`)).toBe(true);
      expect(view.above(hand, `MeleeTile${client.slot}_0`)).toBe(true);
      expect(view.above(hand, `MeleeChip${client.slot}_${client.slot}`)).toBe(true);
    }
  };
  point(f32(0.03), f32(0.3), false, false);
  point(cardX(0) + f32(0.126), f32(0.17), false, false);
  point(cardX(0) + f32(0.126), f32(0.17), true, true);
  const first = cellRect(grid, 0);
  point((first.left + first.right) / 2, (first.top + first.bottom) / 2, true, true);
  point((first.left + first.right) / 2, (first.top + first.bottom) / 2, false, false);
  clients.everywhere(() => expect(characterReady(shell().game, 0)).toBe(true));
  for (let index = 0; index < 100; index++) {
    const cell = cellRect(grid, index % grid.count);
    point((cell.left + cell.right) / 2, (cell.top + cell.bottom) / 2, false);
  }
  for (const pixelX of [600, 800, 1000, 1000]) {
    for (const client of clients.clients) {
      client.mouseScreenX = pixelX;
      client.mouseScreenY = 400;
    }
    frames(2);
    for (const { client, view } of records) {
      const name = `MeleeHand${client.slot}`;
      expect(view.named(name)?.level).toBeGreaterThan(view.named(`MeleeRuleHelp${client.slot}`)?.level ?? 0);
    }
  }

  for (const slot of [0, 1]) clients.press(slot, RIGHT_KEY);
  frames(10);
  const chipSize = readyChipSize(rosterGrid(PLAYABLE_CHARACTERS.length));
  for (const { client, view } of records) {
    const chip = view.named(`MeleeChip${client.slot}_${client.slot}`);
    expect(chip?.width).toBeCloseTo(chipSize, 7);
    expect(chip?.height).toBeCloseTo(chipSize, 7);
  }
  clients.everywhere(() => {
    panelActions().selection.changeStocks(0, -1);
    panelActions().selection.changeStocks(0, -1);
  });
  clients.press(0, Key.y);
  frames(10);
  expect(phases()).toEqual([Phase.stageMenu, Phase.stageMenu]);
  frames(10);
  clients.press(0, Key.y);
  for (let frame = 0; frame < 120 && !phases().every((phase) => phase === Phase.match); frame++) frames(1);
  expect(phases()).toEqual([Phase.match, Phase.match]);
  for (let frame = 0; frame < 240 && clients.clients.some((client) => { let held = true; client.run(() => { held = holdingStart(shell().game); }); return held; }); frame++) frames(1);

  for (const client of clients.clients) client.key(0, LEFT_KEY, 0, true);
  for (let frame = 0; frame < 1200 && !phases().every((phase) => phase === Phase.result); frame++) frames(1);
  expect(phases()).toEqual([Phase.result, Phase.result]);
  frames(RESULTS_DELAY_FRAMES + 1);

  expect(clients.clients.map((client) => {
    let winner: number | undefined;
    client.run(() => {
      winner = shell().game.winner;
    });
    return winner;
  })).toEqual([1, 1]);
  for (const client of clients.clients) expect(client.errors).toEqual([]);
  expect([...shown].filter((text) => developerText(text).length > 0)).toEqual([]);
});
