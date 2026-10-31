import { expect, test } from "bun:test";
import { MEASURED_BATTLE_NET, syncDelivery } from "wisp/src/headless/syncChannel";
import { INTEGRITY_BUILD } from "../src/game/session/currentBuild";
import { install, startBuild } from "../src/platform/main";
import { Key } from "../src/host/loop/keyEvents";
import { declineTutorial, passStartControls } from "../scripts/wisp/startControls";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { testHeadless } from "./headless";

const headless = testHeadless(SMASHCRAFT_HEADLESS);

const HUMANS = [0, 1];
const ECHO_FRAMES = 600;
const echoLine = (slot: number) => new RegExp(`^P${slot + 1} · echo \\d+ ms$`);

test("two online clients in the lobby show each player's measured echo in ms under the label echo, never ping [k5 boundary lobby-echo]", () => {
  const clients = headless.clients({ install, start: () => startBuild(INTEGRITY_BUILD) }, HUMANS, { delivery: syncDelivery(MEASURED_BATTLE_NET, 414) });
  clients.start();
  clients.frames(30);
  passStartControls(clients, count => clients.frames(count));
  declineTutorial(clients);
  for (const slot of HUMANS) clients.press(slot, Key.n);
  const echoes = () => clients.clients.map(client => HUMANS.map(slot => client.frames.shownText().find(text => echoLine(slot).test(text))));
  for (let frame = 0; frame < ECHO_FRAMES && echoes().flat().includes(undefined); frame++) clients.frames(1);
  for (const client of clients.clients) expect(client.errors).toEqual([]);
  for (const shown of echoes()) for (const slot of HUMANS) expect(shown[slot]).toMatch(echoLine(slot));
  for (const client of clients.clients) expect(client.frames.shownText().filter(text => /ping/i.test(text))).toEqual([]);
});
