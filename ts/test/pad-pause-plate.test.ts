import { expect, test } from "bun:test";
import { INTEGRITY_BUILD } from "../src/game/session/currentBuild";
import { shell } from "../src/host/loop/state";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { testHeadless } from "./headless";
import { JournalHelpers } from "./rematch/journalHelper";
import { startPlayableMatch, value } from "./rematch/playableMatch";

const headless = testHeadless(SMASHCRAFT_HEADLESS);

test("a controller Start from player 2 pauses the match on both clients under a plate naming player 2 [k1 scenario]", () => {
  const helpers = new JournalHelpers(INTEGRITY_BUILD.id);
  const { clients, frames } = startPlayableMatch(headless, helpers, false);
  frames(60);
  helpers.pressStart(1);
  const paused = () => clients.clients.every(client => value(client, () => shell().session.paused));
  for (let frame = 0; frame < 300 && !paused(); frame++) frames(1);
  expect(paused()).toBe(true);
  expect(clients.clients.map(client => value(client, () => shell().pausedBy))).toEqual([1, 1]);
  for (const client of clients.clients) expect(client.errors).toEqual([]);
}, 120_000);
