import { expect, test } from "bun:test";
import { INTEGRITY_BUILD } from "../src/game/session/currentBuild";
import { install, startBuild } from "../src/platform/main";
import { CHAT_STYLE } from "../src/game/ui/nativeChat";
import { controlsGreeted, passStartControls } from "../scripts/wisp/startControls";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { testHeadless } from "./headless";

const headless = testHeadless(SMASHCRAFT_HEADLESS);

test("the framed chat box stays hidden while the first-run Controls screen covers character select and shows once Done closes it [k1 scenario]", () => {
  const clients = headless.clients({ install, start: () => startBuild(INTEGRITY_BUILD) }, [0]);
  const client = clients.client(0);
  const title = CHAT_STYLE.frame?.title;
  expect(title).toBeDefined();
  clients.start();
  for (let frame = 0; frame < 240 && !controlsGreeted(client); frame++) clients.frames(1);
  expect(controlsGreeted(client)).toBe(true);
  clients.frames(2);
  expect(client.frames.shownText()).not.toContain(title);
  passStartControls(clients);
  clients.frames(2);
  expect(client.frames.shownText()).toContain(title);
  expect(client.errors).toEqual([]);
});
