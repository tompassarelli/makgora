import { expect, test } from "bun:test";
import { RIGHT_KEY, testHeadless } from "./headless";
import type { HeadlessClient } from "wisp/src/headless/client";
import type { FrameSnapshot } from "wisp/src/headless/frames";
import { Phase } from "../src/game/lobby/lobbyState";
import { install, start } from "../src/host/entries/playableMain";
import { Key } from "../src/host/loop/keyEvents";
import { shell } from "../src/host/loop/state";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { PICKER_DONE } from "../src/game/ui/settingsUi";
import { START_BUTTON } from "../src/game/ui/selectionLayout";
import { MATCH_CHAT_BOX, SELECT_CHAT_BOX } from "../src/game/ui/chatPanel";
import type { TextBox } from "../src/game/ui/hudLayout";
import { f32 } from "wisp/src/sim/f32";

const headless = testHeadless(SMASHCRAFT_HEADLESS);
const area = (box: TextBox) => [box.left, box.top, f32(box.left + box.width), f32(box.top - box.height)] as const;

function phaseOf(client: HeadlessClient): Phase {
  let phase: Phase = Phase.characterMenu;
  client.run(() => { phase = shell().game.phase; });
  return phase;
}

function overlaps(a: readonly number[], b: readonly number[]): boolean {
  const [aLeft, aTop, aRight, aBottom] = a as [number, number, number, number];
  const [bLeft, bTop, bRight, bBottom] = b as [number, number, number, number];
  return aLeft < bRight && bLeft < aRight && aBottom < bTop && bBottom < aTop;
}

function shownChat(client: HeadlessClient, box: TextBox): string | undefined {
  const all = client.frames.snapshot();
  const byId = new Map(all.map(frame => [frame.handle.id, frame]));
  const shown = (frame: FrameSnapshot): boolean => {
    for (let at: FrameSnapshot | undefined = frame; at !== undefined; at = at.parentId === undefined ? undefined : byId.get(at.parentId)) if (!at.visible || at.alpha <= 0) return false;
    return true;
  };
  const label = all.find(frame => frame.name === "MeleeChat");
  if (label === undefined || !shown(label)) return undefined;
  const covered = all.filter(frame => !/^MeleeChat|Backdrop\d*$/.test(frame.name) && frame.rectangle !== undefined && shown(frame) && overlaps(frame.rectangle, area(box)));
  expect(covered.map(frame => frame.name)).toEqual([]);
  return label.text;
}

test("chat shows on character select and stage select for every player, clear of the cards and controls, and keeps showing in the match clear of the fighter plates, where Warcraft's hidden origin frames draw no chat [k1 scenario]", () => {
  const clients = headless.clients({ install, start });
  clients.start();
  clients.frames(30);
  for (const slot of [0, 1]) expect(clients.click(slot, f32(PICKER_DONE.x + f32(PICKER_DONE.width / 2)), f32(PICKER_DONE.y - f32(PICKER_DONE.height / 2)))).toBe(true);
  clients.frames(2);
  for (const slot of [0, 1]) expect(clients.click(slot, f32(0.49), f32(0.2975))).toBe(true);
  clients.frames(4);
  for (const client of clients.clients) {
    expect(phaseOf(client)).toBe(Phase.characterMenu);
    expect(shownChat(client, SELECT_CHAT_BOX)).toBeUndefined();
  }
  clients.chat(1, "gl hf");
  clients.chat(0, "you too");
  clients.frames(2);
  for (const client of clients.clients) {
    const text = shownChat(client, SELECT_CHAT_BOX) ?? "";
    expect(text).toContain("gl hf");
    expect(text.indexOf("gl hf")).toBeLessThan(text.indexOf("you too"));
    expect(text.split("\n")[0]).toMatch(/^\|cff0042ff.*\|r: gl hf$/);
  }
  for (const slot of [0, 1]) clients.press(slot, RIGHT_KEY);
  clients.frames(10);
  clients.press(0, Key.y);
  clients.frames(30);
  clients.chat(1, "pick a stage");
  clients.frames(2);
  for (const client of clients.clients) {
    expect(phaseOf(client)).toBe(Phase.stageMenu);
    expect(shownChat(client, SELECT_CHAT_BOX)).toContain("pick a stage");
  }
  expect(clients.click(0, f32(START_BUTTON.x + f32(0.003)), f32(START_BUTTON.y - f32(0.003)))).toBe(true);
  for (let frame = 0; frame < 120 && !clients.clients.every(client => phaseOf(client) === Phase.match); frame++) clients.frames(1);
  clients.chat(1, "in the match");
  clients.frames(10);
  for (const client of clients.clients) {
    expect(phaseOf(client)).toBe(Phase.match);
    const text = shownChat(client, MATCH_CHAT_BOX) ?? "";
    expect(text).toContain("in the match");
    expect(text).toContain("pick a stage");
    expect(client.errors).toEqual([]);
  }
});
