import { expect, test } from "bun:test";
import { createFrameByType, namedFrame } from "wisp/game/frames";
import type { Frame, Frames } from "wisp/src/game/native/frameStore";
import { INTEGRITY_BUILD } from "../src/game/session/currentBuild";
import { install, startBuild } from "../src/platform/main";
import { STOCK_CLICK_BLOCKERS } from "../src/game/ui/stockClicks";
import { controlsGreeted } from "../scripts/wisp/startControls";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { testHeadless } from "./headless";

const headless = testHeadless(SMASHCRAFT_HEADLESS);
const STOCK = "StockConsoleBar";

function seedStockConsole(): void {
  const consoleUi = namedFrame("ConsoleUI", 0);
  for (let index = 0; index < 8; index++) createFrameByType("FRAME", `${STOCK}${index}`, consoleUi, "", 0);
}

function subtree(store: Frames, frame: Frame, out: Frame[] = []): Frame[] {
  out.push(frame);
  for (const child of store.children(frame)) subtree(store, child, out);
  return out;
}

test("startup hides and disables the stock console bars that swallow clicks on the Controls panel's Done button, and never one of our frames or their ancestors [k1 scenario]", () => {
  const clients = headless.clients({ install, start: () => startBuild(INTEGRITY_BUILD, seedStockConsole) }, [0]);
  const client = clients.client(0);
  const store = client.frames;
  clients.start();
  for (let frame = 0; frame < 240 && !controlsGreeted(client); frame++) clients.frames(1);
  expect(controlsGreeted(client)).toBe(true);
  const consoleUi = store.named("ConsoleUI", 0);
  expect(consoleUi).toBeDefined();
  const bars = store.children(consoleUi as Frame).filter((frame) => frame.name.startsWith(STOCK));
  expect(bars.length).toBe(8);
  const blockers = new Set<Frame>();
  for (const blocker of STOCK_CLICK_BLOCKERS) {
    let frame = store.named(blocker.frame, 0);
    for (const index of blocker.path) frame = frame === undefined ? undefined : store.children(frame)[index];
    expect(frame).toBeDefined();
    for (const each of subtree(store, frame as Frame)) blockers.add(each);
  }
  for (const frame of blockers) expect([frame.name, frame.visible, frame.enabled]).toEqual([frame.name, false, false]);
  const ours = [...new Set([...store.gameUi, consoleUi as Frame].flatMap((root) => subtree(store, root)))].filter((frame) => frame.type !== "" && !frame.name.startsWith(STOCK));
  expect(ours.length).toBeGreaterThan(0);
  for (const frame of ours) {
    for (let up: Frame | undefined = frame; up !== undefined; up = up.parent) expect([frame.name, blockers.has(up)]).toEqual([frame.name, false]);
  }
  expect(bars.filter((bar) => !blockers.has(bar)).every((bar) => bar.visible && bar.enabled)).toBe(true);
  expect(client.errors).toEqual([]);
});
