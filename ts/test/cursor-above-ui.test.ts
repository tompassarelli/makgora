import { expect, test } from "bun:test";
import { INTEGRITY_BUILD } from "../src/game/session/currentBuild";
import { install, startBuild } from "../src/platform/main";
import { controlsGreeted, passStartControls } from "../scripts/wisp/startControls";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { CHAT_SLOT } from "../src/game/core/selectScreenLayout";
import { testHeadless } from "./headless";

const headless = testHeadless(SMASHCRAFT_HEADLESS);

const CURSOR = /^Melee(Hand|Bullseye)/;

function characterSelect() {
  const clients = headless.clients({ install, start: () => startBuild(INTEGRITY_BUILD) }, [0]);
  const client = clients.client(0);
  clients.start();
  for (let frame = 0; frame < 240 && !controlsGreeted(client); frame++) clients.frames(1);
  passStartControls(clients);
  clients.frames(4);
  return { clients, client };
}

test("every frame the map creates draws below the select cursor, the chat box included [k2 property]", () => {
  const { client } = characterSelect();
  const frames = client.frames.snapshot().filter(frame => frame.type !== "SIMPLEFRAME");
  const cursor = frames.filter(frame => CURSOR.test(frame.name));
  expect(cursor.length).toBeGreaterThan(0);
  expect(frames.some(frame => frame.name.startsWith("SmashcraftChat") && frame.visible)).toBe(true);
  const floor = Math.min(...cursor.map(frame => frame.level));
  expect(frames.filter(frame => !CURSOR.test(frame.name) && frame.level >= floor).map(frame => `${frame.name} ${frame.level}`)).toEqual([]);
  expect(client.errors).toEqual([]);
});

// Engine: Warcraft draws a ConsoleUIBackdrop child (the gauntlet's edge layer) under every game-UI child, so only the game-UI gauntlet can draw over the chat box.
test("the gauntlet over the chat box is the game-UI one wherever it stays on screen [k2 property]", () => {
  const { clients, client } = characterSelect();
  const scale = client.screen.height / 0.6;
  for (const y of [CHAT_SLOT.bottom + CHAT_SLOT.height / 2, CHAT_SLOT.bottom + CHAT_SLOT.height - 0.004]) {
    for (const x of [CHAT_SLOT.left + 0.01, CHAT_SLOT.left + CHAT_SLOT.width / 2, CHAT_SLOT.left + CHAT_SLOT.width - 0.01]) {
      client.mouseScreenX = Math.round((x - 0.4) * scale + client.screen.width / 2);
      client.mouseScreenY = Math.round((0.6 - y) * scale);
      clients.frames(2);
      const shown = client.frames.snapshot({ visibleOnly: true }).filter(frame => frame.name.startsWith("MeleeHand")).map(frame => frame.name);
      expect({ x, y, shown: shown.length > 0, edge: shown.filter(name => name.includes("Edge")) }).toEqual({ x, y, shown: true, edge: [] });
    }
  }
  expect(client.errors).toEqual([]);
});
