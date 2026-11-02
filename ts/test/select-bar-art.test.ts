import { expect, test } from "bun:test";
import { install, startBuild } from "../src/platform/main";
import { barArtNames } from "../src/game/core/selectBarLayout";
import { INTEGRITY_BUILD } from "../src/game/session/currentBuild";
import { declineTutorial, passStartControls } from "../scripts/wisp/startControls";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { testHeadless } from "./headless";

const headless = testHeadless(SMASHCRAFT_HEADLESS);
const BAR_ART = "war3mapImported\\SelectBar";
const REST = `${BAR_ART}Frame`;

test("Every framed box character select draws, at rest and lit, is an image the map build makes [k2 property]", () => {
  const clients = headless.clients({ install, start: () => startBuild(INTEGRITY_BUILD) }, [0]);
  clients.start();
  passStartControls(clients);
  declineTutorial(clients);
  clients.frames(60);
  const built = new Set(barArtNames().map(name => `war3mapImported\\${name}.tga`));
  const drawn = new Set(clients.client(0).frames.snapshot().map(frame => frame.texture).filter(texture => texture.startsWith(BAR_ART)));
  const needed = [...drawn].flatMap(texture => texture.startsWith(REST) ? [texture, texture.replace(REST, `${BAR_ART}Lit`)] : [texture]);
  expect(drawn.size).toBeGreaterThan(20);
  expect(needed.filter(texture => !built.has(texture))).toEqual([]);
  for (const client of clients.clients) expect(client.errors).toEqual([]);
});
