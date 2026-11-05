import { expect, test } from "bun:test";
import { install, startBuild } from "../src/platform/main";
import { Phase, setParticipants } from "../src/game/lobby/lobbyState";
import { INTEGRITY_BUILD } from "../src/game/session/currentBuild";
import { STAGE_CARD_DELAY_FRAMES } from "../src/game/session/stageLoad";
import { Key } from "../src/host/loop/keyEvents";
import { shell } from "../src/host/loop/state";
import { passStartControls } from "../scripts/wisp/startControls";
import { MAKGORA_HEADLESS } from "../scripts/wisp/headless";
import { testHeadless } from "./headless";

const headless = testHeadless(MAKGORA_HEADLESS);

const CARD = ["StageLoadingCover", "StageLoadingArt", "StageLoadingName"];

function stageSelect(stall: boolean) {
  const clients = headless.clients({ install, start: () => startBuild(INTEGRITY_BUILD) }, [0]);
  const shown = (): string[] => clients.client(0).frames.snapshot({ visibleOnly: true }).map(frame => frame.name);
  const phase = (): number => {
    let result = -1;
    clients.client(0).run(() => { result = shell().game.phase; });
    return result;
  };
  clients.start();
  passStartControls(clients);
  clients.frames(10);
  clients.everywhere(() => { const g = shell().game; g.training = false; setParticipants(g, 1, 0); g.characterReadiness[0] = true; g.phase = Phase.stageMenu; });
  clients.frames(5);
  expect(shown()).toContain("MeleeStagePreviewPicture");
  clients.press(0, Key.y);
  if (stall) clients.client(0).run(() => { const load = shell().stageLoad; if (load !== undefined) Object.assign(load, { waiting: 2 }); });
  return { clients, shown, phase };
}

test("pressing Start on stage select never shows the loading card over the select screen: a local start shows no card at all [k1 scenario]", () => {
  const { clients, shown, phase } = stageSelect(false);
  let frames = 0;
  while (phase() === Phase.stageMenu && frames < 600) {
    const names = shown();
    expect(names.filter(name => CARD.includes(name)), `frame ${frames} shows the card`).toEqual([]);
    clients.frames(1);
    frames++;
  }
  expect(phase()).toBe(Phase.match);
  expect(frames).toBeLessThan(STAGE_CARD_DELAY_FRAMES);
  expect(shown().filter(name => CARD.includes(name))).toEqual([]);
  expect(clients.client(0).errors).toEqual([]);
}, 120_000);
