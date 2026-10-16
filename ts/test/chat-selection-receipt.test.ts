import { expect, test } from "bun:test";
import { devCommandReceiptFile, nativeChatFile } from "../src/game/core/gameFiles";
import { Phase } from "../src/game/lobby/lobbyState";
import { INTEGRITY_BUILD } from "../src/game/session/currentBuild";
import { shell } from "../src/host/loop/state";
import { install, startBuild } from "../src/platform/main";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { testHeadless } from "./headless";
import { value } from "./rematch/playableMatch";

const headless = testHeadless(SMASHCRAFT_HEADLESS);

test("a fresh game's first selection chat has a map receipt before entering its quick match [k1 scenario]", () => {
  const clients = headless.clients({ start: () => startBuild(INTEGRITY_BUILD), install }, [0, 1], { keepCalls: 0 });
  clients.start();
  clients.frames(30);
  const beforeCommand = clients.client(0).files.get(nativeChatFile(INTEGRITY_BUILD.id, 0))?.join("\n");
  clients.chat(0, "-dev quick hero kobold");
  clients.frames(30);
  const command = clients.client(0).files.get(devCommandReceiptFile(INTEGRITY_BUILD.id, 0))?.join("\n");
  expect(beforeCommand).toBeDefined();
  expect(beforeCommand ?? "").toContain("SMASHCRAFT CHAT v=1 build=typescript-integrity slot=0 epoch=0");
  expect(command).toContain("SETUP phase=2");
  expect(value(clients.client(0), () => shell().game.phase)).toBe(Phase.match);
  expect(clients.clients.flatMap((client) => client.errors)).toEqual([]);
});
