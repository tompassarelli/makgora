import { expect, test } from "bun:test";
import { LEFT_KEY, RIGHT_KEY, testHeadless } from "./headless";
import type { HeadlessClient } from "wisp/src/headless/client";
import { Phase, ResultPick } from "../src/game/lobby/lobbyState";
import { install, start } from "../src/host/entries/playableMain";
import { Key } from "../src/host/loop/keyEvents";
import { shell } from "../src/host/loop/state";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { cellRect, rosterGrid } from "../src/game/menu/selectionGrid";
import { cardX } from "../src/game/menu/selectionDrag";
import { PLAYABLE_CHARACTERS } from "../src/game/sim/heroes/registry";
import { START_BUTTON } from "../src/game/ui/selectionLayout";
import { PICKER_DONE } from "../src/game/ui/settingsUi";
import { RULE_BUTTONS } from "../src/game/ui/ruleButtons";
import { TEAM_NAMES } from "../src/game/sim/teams";
import { BUTTON_WIDTH, CHOICE_HEIGHT, CHOICE_TOP, choiceLeft } from "../src/game/ui/resultsBanner";
import { pixelX, pixelY } from "../src/game/menu/pointer";
import { f32 } from "wisp/src/sim/f32";

const headless = testHeadless(SMASHCRAFT_HEADLESS);

type Native = (...args: unknown[]) => unknown;

interface Watch {
  cursor: boolean[];
  warps: number;
  hand: unknown;
  handShown: boolean;
  stageDialogs: { frame: unknown; events: unknown[] }[];
  selectionDialogs: { frame: unknown; events: unknown[] }[];
  text: Map<unknown, string>;
  confirm: unknown;
  frames: Map<string, unknown>;
  plainButtons: { frame: unknown; events: unknown[] }[];
  settingsDialogs: number;
  settingsHits: number;
}

function watch(client: HeadlessClient): Watch {
  const seen: Watch = { cursor: [], warps: 0, hand: undefined, handShown: false, stageDialogs: [], selectionDialogs: [], text: new Map(), confirm: undefined, frames: new Map(), plainButtons: [], settingsDialogs: 0, settingsHits: 0 };
  const { natives } = client;
  const stageParents = new Set<unknown>();
  const settingsParents = new Set<unknown>();
  const create = natives.BlzCreateFrameByType as Native;
  natives.BlzCreateFrameByType = (...args: unknown[]) => {
    const frame = create(...args);
    if (args[1] === `MeleeHand${client.slot}`) seen.hand = frame;
    if (args[1] === "MeleeStageRoot" || args[1] === "MeleeStagePoolRoot") stageParents.add(frame);
    if (args[1] === `MeleeConfirmLabel${client.slot}`) seen.confirm = frame;
    seen.frames.set(String(args[1]), frame);
    if (String(args[1]).startsWith("MeleeSettingsRoot")) settingsParents.add(frame);
    if (args[0] === "BUTTON" && /^MeleeSettings\w*Hit/.test(String(args[1]))) seen.settingsHits++;
    if (args[0] === "BUTTON" && /^Melee(Tile|Mode|Settings)Button/.test(String(args[1]))) seen.plainButtons.push({ frame, events: [] });
    if (args[3] === "ScriptDialogButton" && String(args[1]).startsWith("MeleeMoves")) seen.selectionDialogs.push({ frame, events: [] });
    return frame;
  };
  const dialog = natives.BlzCreateFrame as Native;
  natives.BlzCreateFrame = (...args: unknown[]) => {
    const frame = dialog(...args);
    if (args[0] === "ScriptDialogButton" && settingsParents.has(args[1])) seen.settingsDialogs++;
    if (args[0] === "ScriptDialogButton") (stageParents.has(args[1]) ? seen.stageDialogs : seen.selectionDialogs).push({ frame, events: [] });
    return frame;
  };
  const register = natives.BlzTriggerRegisterFrameEvent as Native;
  natives.BlzTriggerRegisterFrameEvent = (...args: unknown[]) => {
    const button = [...seen.stageDialogs, ...seen.selectionDialogs, ...seen.plainButtons].find(button => button.frame === args[1]);
    if (button !== undefined) button.events.push(args[2]);
    return register(...args);
  };
  const setText = natives.BlzFrameSetText as Native;
  natives.BlzFrameSetText = (frame: unknown, text: unknown) => {
    seen.text.set(frame, String(text));
    return setText(frame, text);
  };
  const visible = natives.BlzFrameSetVisible as Native | undefined;
  natives.BlzFrameSetVisible = (frame: unknown, shown: boolean) => {
    if (frame === seen.hand) seen.handShown = shown;
    return visible?.(frame, shown);
  };
  natives.BlzGetMouseScreenPosX = () => client.mouseScreenX;
  natives.BlzGetMouseScreenPosY = () => client.mouseScreenY;
  natives.BlzIsMouseButtonPressed = (button: unknown) => client.heldMouseButtons.has(button);
  natives.BlzEnableCursor = (enabled: boolean) => { seen.cursor.push(enabled); };
  natives.BlzSetMousePos = () => { seen.warps++; };
  return seen;
}

function menu() {
  const clients = headless.clients({ install, start });
  const watches = clients.clients.map(watch);
  const phases = () => clients.clients.map(client => {
    let phase: Phase = Phase.characterMenu;
    client.run(() => { phase = shell().game.phase; });
    return phase;
  });
  const point = (x: number, y: number, down = false) => {
    for (const client of clients.clients) {
      const width = Number((client.natives.BlzGetLocalClientWidth as Native)());
      const height = Number((client.natives.BlzGetLocalClientHeight as Native)());
      client.mouseScreenX = pixelX(x, width, height);
      client.mouseScreenY = pixelY(y, height);
      if (down) client.heldMouseButtons.add(client.natives.MOUSE_BUTTON_TYPE_LEFT);
      else client.heldMouseButtons.delete(client.natives.MOUSE_BUTTON_TYPE_LEFT);
    }
  };
  clients.start();
  clients.frames(30);
  for (const slot of [0, 1]) expect(clients.click(slot, f32(PICKER_DONE.x + f32(PICKER_DONE.width / 2)), f32(PICKER_DONE.y - f32(PICKER_DONE.height / 2)))).toBe(true);
  clients.frames(2);
  for (const slot of [0, 1]) expect(clients.click(slot, f32(0.49), f32(0.2975))).toBe(true);
  clients.frames(2);
  return { clients, watches, phases, point };
}

const AWAY = { x: f32(0.7), y: f32(0.1) };

test("fighter select shows Warcraft's own cursor at rest and hides it only while a chip is carried, asserting the shown cursor once [k1 scenario]", () => {
  const { clients, watches, point } = menu();
  const [seen] = watches;
  if (seen === undefined) throw new Error("no client");
  const grid = rosterGrid(PLAYABLE_CHARACTERS.length);
  const first = cellRect(grid, 0);
  const chip = { x: f32(cardX(0) + f32(0.126)), y: f32(0.17) };
  const cell = { x: (first.left + first.right) / 2, y: (first.top + first.bottom) / 2 };
  point(AWAY.x, AWAY.y);
  clients.frames(5);
  expect(seen.handShown).toBe(false);
  expect(seen.cursor.at(-1)).toBe(true);
  seen.cursor.length = 0;
  clients.frames(20);
  expect(seen.cursor).toEqual([]);

  point(chip.x, chip.y);
  clients.frames(2);
  point(chip.x, chip.y, true);
  clients.frames(5);
  expect(seen.handShown).toBe(true);
  expect(seen.cursor.length).toBeGreaterThanOrEqual(4);
  expect(seen.cursor.every(enabled => !enabled)).toBe(true);
  point(cell.x, cell.y, true);
  clients.frames(5);
  expect(seen.handShown).toBe(true);
  point(cell.x, cell.y);
  clients.frames(3);
  point(AWAY.x, AWAY.y);
  clients.frames(5);
  expect(seen.handShown).toBe(false);
  expect(seen.cursor.at(-1)).toBe(true);
  expect(seen.cursor.filter(enabled => enabled).length).toBe(1);
  seen.cursor.length = 0;
  clients.frames(20);
  expect(seen.cursor).toEqual([]);
  for (const client of clients.clients) expect(client.errors).toEqual([]);
});

test("character select registers no cursor-displacing dialog hover events and still lights Start under a resting pointer [k1 scenario]", () => {
  const { clients, watches, point } = menu();
  const centre = { x: START_BUTTON.x + START_BUTTON.width / 2, y: START_BUTTON.y - START_BUTTON.height / 2 };
  for (const [index, seen] of watches.entries()) {
    expect(seen.selectionDialogs.length).toBeGreaterThan(10);
    for (const dialog of seen.selectionDialogs) expect(dialog.events).toEqual([clients.clients[index]?.natives.FRAMEEVENT_CONTROL_CLICK]);
  }
  point(AWAY.x, AWAY.y);
  clients.frames(5);
  for (const seen of watches) expect(seen.text.get(seen.confirm)).not.toContain("|cffffcc00");
  point(centre.x, centre.y);
  clients.frames(5);
  for (const seen of watches) expect(seen.text.get(seen.confirm)).toContain("|cffffcc00");
  point(AWAY.x, AWAY.y);
  clients.frames(5);
  for (const seen of watches) expect(seen.text.get(seen.confirm)).not.toContain("|cffffcc00");
  for (const client of clients.clients) expect(client.errors).toEqual([]);
});

test("fighter tiles register no hover events and a resting pointer still lights its tile [k1 scenario]", () => {
  const { clients, watches, point } = menu();
  const grid = rosterGrid(PLAYABLE_CHARACTERS.length);
  const tile = 4;
  const rect = cellRect(grid, tile);
  for (const [index, seen] of watches.entries()) {
    expect(seen.plainButtons.length).toBeGreaterThan(PLAYABLE_CHARACTERS.length);
    for (const button of seen.plainButtons) expect(button.events).toEqual([clients.clients[index]?.natives.FRAMEEVENT_CONTROL_CLICK]);
  }
  const name = (seen: Watch) => seen.text.get(seen.frames.get(`MeleeTileName${clients.clients[watches.indexOf(seen)]?.slot}_${tile}`)) ?? "";
  point(AWAY.x, AWAY.y);
  clients.frames(5);
  for (const seen of watches) expect(name(seen)).not.toContain("|cffffcc00");
  point((rect.left + rect.right) / 2, (rect.top + rect.bottom) / 2);
  clients.frames(5);
  for (const seen of watches) expect(name(seen)).toContain("|cffffcc00");
  point(AWAY.x, AWAY.y);
  clients.frames(5);
  for (const seen of watches) expect(name(seen)).not.toContain("|cffffcc00");
  for (const client of clients.clients) expect(client.errors).toEqual([]);
});

test("entering stage select avoids cursor-displacing dialog hover events and cursor toggles, leaves a pointer inside Start, and moves one outside it once [k1 scenario]", () => {
  const { clients, watches, phases, point } = menu();
  const centre = { x: START_BUTTON.x + START_BUTTON.width / 2, y: START_BUTTON.y - START_BUTTON.height / 2 };
  for (const slot of [0, 1]) clients.press(slot, RIGHT_KEY);
  clients.frames(10);
  point(AWAY.x, AWAY.y);
  clients.frames(5);
  for (const seen of watches) seen.cursor.length = 0;
  clients.press(0, Key.y);
  clients.frames(30);
  expect(phases()).toEqual([Phase.stageMenu, Phase.stageMenu]);
  for (const [index, seen] of watches.entries()) {
    expect(seen.stageDialogs.length).toBeGreaterThan(0);
    for (const dialog of seen.stageDialogs) expect(dialog.events).toEqual([clients.clients[index]?.natives.FRAMEEVENT_CONTROL_CLICK]);
    expect(seen.cursor.filter(enabled => !enabled)).toEqual([]);
    expect(seen.cursor.length).toBeLessThanOrEqual(1);
    expect(seen.warps).toBe(1);
  }
  clients.frames(20);
  for (const seen of watches) expect(seen.cursor.length).toBeLessThanOrEqual(1);

  expect(clients.click(0, f32(0.13), f32(0.0635))).toBe(true);
  clients.frames(10);
  expect(phases()).toEqual([Phase.characterMenu, Phase.characterMenu]);
  point(centre.x, centre.y);
  clients.frames(5);
  for (const seen of watches) seen.warps = 0;
  clients.press(0, Key.y);
  clients.frames(30);
  expect(phases()).toEqual([Phase.stageMenu, Phase.stageMenu]);
  for (const seen of watches) expect(seen.warps).toBe(0);
  for (const client of clients.clients) expect(client.errors).toEqual([]);
});

test("Start answers clicks in one rectangle on character select and on stage select [k3 measure #550]", () => {
  const { clients, phases } = menu();
  const inset = f32(0.003);
  const left = START_BUTTON.x;
  const right = f32(START_BUTTON.x + START_BUTTON.width);
  const top = START_BUTTON.y;
  const bottom = f32(START_BUTTON.y - START_BUTTON.height);
  const middle = f32(START_BUTTON.y - START_BUTTON.height / 2);
  for (const slot of [0, 1]) clients.press(slot, RIGHT_KEY);
  clients.frames(10);

  const outside = [[left - 0.01, middle], [right + 0.005, middle], [f32(left + START_BUTTON.width / 2), top + 0.001], [f32(left + START_BUTTON.width / 2), bottom - 0.003]] as const;
  for (const [x, y] of outside) {
    expect(clients.click(0, x, y)).toBe(false);
    clients.frames(2);
    expect(phases()).toEqual([Phase.characterMenu, Phase.characterMenu]);
  }
  expect(clients.click(0, left + inset, top - inset)).toBe(true);
  clients.frames(10);
  expect(phases()).toEqual([Phase.stageMenu, Phase.stageMenu]);

  for (const [x, y] of outside) {
    expect(clients.click(0, x, y)).toBe(false);
    clients.frames(2);
    expect(phases()).toEqual([Phase.stageMenu, Phase.stageMenu]);
  }
  expect(clients.click(0, right - inset, bottom + inset)).toBe(true);
  for (let frame = 0; frame < 120 && !phases().every(phase => phase === Phase.match); frame++) clients.frames(1);
  expect(phases()).toEqual([Phase.match, Phase.match]);
  for (const client of clients.clients) expect(client.errors).toEqual([]);
});

test("every character card's Player, CPU or Empty label is centred over its card [k1 scenario]", () => {
  const { clients } = menu();
  clients.frames(4);
  for (const client of clients.clients) {
    const shown = client.frames.snapshot({ visibleOnly: true });
    const tags = shown.filter(frame => frame.name.startsWith("MeleeTag") && frame.rectangle !== undefined);
    expect(tags.length).toBeGreaterThanOrEqual(4);
    for (const tag of tags) {
      const card = shown.find(frame => frame.name === tag.name.replace("MeleeTag", "MeleeCard"));
      const [tagLeft, , tagRight] = tag.rectangle!;
      const [cardLeft, , cardRight] = card!.rectangle!;
      expect((tagLeft + tagRight) / 2, tag.name).toBeCloseTo((cardLeft + cardRight) / 2, 3);
    }
    expect(client.errors).toEqual([]);
  }
});

test("with Team Battle on every fighting card wears its team's colour and shows its team name [k1 scenario]", () => {
  const { clients } = menu();
  const rule = RULE_BUTTONS.teamBattle;
  expect(clients.click(0, f32(rule.x + rule.width / 2), f32(rule.y - rule.height / 2))).toBe(true);
  clients.frames(4);
  for (const client of clients.clients) {
    let teams: number[] = [];
    client.run(() => { teams = [...shell().game.teamChoices]; expect(shell().game.teamBattle).toBe(true); });
    const all = client.frames.snapshot();
    const byId = new Map(all.map(frame => [frame.handle.id, frame]));
    const shown = (id: number | undefined): boolean => {
      for (let frame = id === undefined ? undefined : byId.get(id); frame !== undefined; frame = frame.parentId === undefined ? undefined : byId.get(frame.parentId)) {
        if (!frame.visible || frame.alpha <= 0) return false;
      }
      return true;
    };
    for (const slot of [0, 1]) {
      const team = TEAM_NAMES[teams[slot]!]!;
      const card = all.find(frame => frame.name === `MeleeCard${client.slot}_${slot}`)!;
      const label = all.find(frame => frame.name === `MeleeTeam${client.slot}_${slot}`)!;
      expect(card.texture, `card ${slot}`).toBe(`war3mapImported\\SelectionCard${team}.tga`);
      expect(shown(label.handle.id), `team label ${slot}`).toBe(true);
      expect(label.text.replace("> ", "")).toBe(team);
    }
    expect(client.errors).toEqual([]);
  }
});

test("on the results banner arrows and movement keys move each player's choice and clicking New stage for both players opens stage select [k1 scenario]", () => {
  const { clients } = menu();
  for (const client of clients.clients) client.run(() => {
    const s = shell();
    s.game.phase = Phase.result;
    s.game.matchFrame = 600;
    s.game.characterReadiness[0] = true;
    s.game.characterReadiness[1] = true;
    s.ui?.results.show([{ slot: 0, winner: true, text: "P1" }, { slot: 1, winner: false, text: "P2" }]);
  });
  clients.frames(2);
  const focus = (slot: number) => {
    let value: number | undefined;
    clients.client(0).run(() => { value = shell().resultFocus?.[slot]; });
    return value;
  };
  clients.press(0, RIGHT_KEY);
  clients.frames(1);
  expect(focus(0)).toBe(ResultPick.rematch);
  clients.press(0, 0x27);
  clients.frames(1);
  expect(focus(0)).toBe(ResultPick.newStage);
  clients.press(0, 0x25);
  clients.press(0, LEFT_KEY);
  clients.frames(1);
  expect(focus(0)).toBe(ResultPick.characters);
  const x = f32(choiceLeft(ResultPick.newStage) + BUTTON_WIDTH / 2);
  const y = f32(CHOICE_TOP - CHOICE_HEIGHT / 2);
  for (const slot of [0, 1]) expect(clients.click(slot, x, y)).toBe(true);
  clients.frames(2);
  for (const client of clients.clients) client.run(() => { expect(shell().game.phase).toBe(Phase.stageMenu); });
  for (const client of clients.clients) expect(client.errors).toEqual([]);
});

test("the controls screen clicks through invisible plain buttons, never Warcraft dialog buttons that draw over its key caps and hide the cursor [k1 scenario]", () => {
  const { clients, watches } = menu();
  for (const seen of watches) {
    expect(seen.settingsDialogs).toBe(0);
    expect(seen.settingsHits).toBeGreaterThan(40);
  }
  for (const client of clients.clients) expect(client.errors).toEqual([]);
});
