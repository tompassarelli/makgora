import { expect, test } from "bun:test";
import type { SyncDelivery } from "wisp/src/headless/lockstep";
import { CALLBACK_MS } from "wisp/src/headless/syncChannel";
import { Phase } from "../src/game/lobby/lobbyState";
import type { MapBuild } from "../src/game/session/build";
import { PLAYABLE_BUILD } from "../src/game/session/currentBuild";
import { DELAY_PREFIX } from "../src/host/loop/netDelay";
import { localSlot, shellState } from "../src/host/loop/state";
import { install, startBuild } from "../src/platform/main";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { passStartControls } from "../scripts/wisp/startControls";
import { testHeadless } from "./headless";

const headless = testHeadless(SMASHCRAFT_HEADLESS);

const BUILD: MapBuild = { ...PLAYABLE_BUILD, id: "typescript-lobby-echo", devConsole: true };
const HUMANS = [0, 1, 2, 3];
const ECHO_MS = [100, 300, 600, 200];
const LOBBY_FRAMES = 900;
const TOLERANCE_MS = 34;
const ONE_ROW_CHARS = 106;

test("four clients on 100, 300, 600 and 200 ms links each show every player's echo within 34 ms in Character select on one row of at most 106 characters, name the slowest slot as setting the delay, and send one delay message a second [k1 scenario]", () => {
  const sends = new Map<number, number[]>();
  let frameNow = 0;
  const delivery: SyncDelivery = {
    arrivalFrame: (sender, frame, message) => {
      frameNow = frame;
      if (message.prefix === DELAY_PREFIX) sends.set(sender, [...(sends.get(sender) ?? []), frame]);
      return frame + Math.max(1, Math.round((ECHO_MS[sender] ?? 0) / CALLBACK_MS));
    },
  };
  const clients = headless.clients({ install, start: () => startBuild(BUILD) }, HUMANS, { delivery });
  clients.start();
  clients.frames(30);
  passStartControls(clients);
  const from = frameNow;
  clients.frames(LOBBY_FRAMES);
  for (const client of clients.clients) expect(client.errors).toEqual([]);
  const panels = HUMANS.map((_, index) => {
    let text = "";
    let phase = -1;
    clients.clients[index]?.run(() => {
      phase = shellState()?.game.phase ?? -1;
      text = BlzFrameGetText(BlzGetFrameByName(`MeleeDelayLine${localSlot()}`, 0));
    });
    expect(phase).toBe(Phase.characterMenu);
    return text;
  });
  console.log(`lobby echo panels: ${JSON.stringify(panels)}`);
  const slowest = ECHO_MS.indexOf(Math.max(...ECHO_MS));
  for (const text of panels) {
    for (const slot of HUMANS) {
      const shown = new RegExp(`P${slot + 1} (?:fixed )?\\d+ \\((\\d+) ms\\)`).exec(text);
      expect(shown, text).not.toBeNull();
      expect(Math.abs(Number(shown?.[1]) - (ECHO_MS[slot] ?? 0)), text).toBeLessThanOrEqual(TOLERANCE_MS);
    }
    expect(text).toContain(`, set by P${slowest + 1} ·`);
    expect(text.split("\n")[0]?.length ?? 0, text).toBeLessThanOrEqual(ONE_ROW_CHARS);
  }
  for (const slot of HUMANS) {
    const frames = (sends.get(slot) ?? []).filter(frame => frame >= from);
    expect(frames.length).toBeGreaterThanOrEqual(Math.floor(LOBBY_FRAMES / 60) - 1);
    for (let index = 1; index < frames.length; index++) expect((frames[index] ?? 0) - (frames[index - 1] ?? 0)).toBeGreaterThanOrEqual(60);
  }
});
