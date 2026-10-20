import { expect, test } from "bun:test";
import { testHeadless } from "./headless";
import { install, start } from "../src/host/entries/playableMain";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { Phase } from "../src/game/lobby/lobbyState";
import { shell } from "../src/host/loop/state";

const headless = testHeadless(SMASHCRAFT_HEADLESS);

test("the camera behind the Controls screen and fighter select settles and holds still on 16:9, 3:2 and 4:3 screens, never stepping in and out frame to frame [k1 scenario]", () => {
  for (const screen of [{ width: 1920, height: 1080 }, { width: 2256, height: 1504 }, { width: 1600, height: 1200 }]) {
    const clients = headless.clients({ install, start }, undefined, { screen });
    clients.start();
    const client = clients.client(0);
    clients.frames(150);
    let phase: Phase = Phase.match;
    client.run(() => { phase = shell().game.phase; });
    expect(phase).toBe(Phase.characterMenu);
    const steps: number[] = [];
    let last = client.cameraPose().fields;
    for (let frame = 0; frame < 30; frame++) {
      clients.frames(1);
      const fields = client.cameraPose().fields;
      steps.push(Math.max(...["CAMERA_FIELD_TARGET_DISTANCE", "CAMERA_FIELD_ZOFFSET", "CAMERA_FIELD_FIELD_OF_VIEW"].map(name => Math.abs((fields[name] ?? 0) - (last[name] ?? 0)))));
      last = fields;
    }
    expect(Math.max(...steps), `${screen.width}x${screen.height}`).toBeLessThan(1);
  }
}, 120000);
