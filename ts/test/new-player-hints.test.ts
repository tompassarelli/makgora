import { expect, test } from "bun:test";
import { install, startBuild } from "../src/platform/main";
import { Phase } from "../src/game/lobby/lobbyState";
import { INTEGRITY_BUILD } from "../src/game/session/currentBuild";
import { Key } from "../src/host/loop/keyEvents";
import { shell } from "../src/host/loop/state";
import { views } from "../src/host/loop/ui";
import { passStartControls } from "../scripts/wisp/startControls";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { testHeadless } from "./headless";
import { GUIDE_ROWS, SELECT_BAR } from "../src/game/core/selectBarLayout";
import { f32 } from "wisp/src/sim/f32";

const headless = testHeadless(SMASHCRAFT_HEADLESS);

const HUMANS = [0, 1];
const START_TUTORIAL = { x: f32(0.23), y: f32(0.315), width: f32(0.16), height: f32(0.035) };
const centre = (box: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }) => [f32(box.x + f32(box.width / 2)), f32(box.y - f32(box.height / 2))] as const;

interface Seen {
  readonly phase: number;
  readonly hints: boolean;
  readonly stripShown: boolean;
}

test("a fresh profile shows the new-player strip in a match, H hides it for that player only and H again brings it back, and Esc still pauses with the strip on [k1 scenario]", () => {
  const clients = headless.clients({ install, start: () => startBuild(INTEGRITY_BUILD) }, HUMANS);
  const seen = (slot: number): Seen => {
    let result: Seen | undefined;
    clients.client(slot).run(() => {
      const s = shell();
      result = { phase: s.game.phase, hints: s.participants[slot]?.bindings.hints === true, stripShown: views(s).hints.isShown() };
    });
    return result as Seen;
  };
  const until = (what: string, done: () => boolean) => {
    for (let frame = 0; frame < 600 && !done(); frame++) clients.frames(1);
    expect(done(), what).toBe(true);
  };
  const tap = (key: number) => {
    clients.key(0, key, 0, true);
    clients.frames(5);
    clients.key(0, key, 0, false);
    clients.frames(5);
  };
  clients.start();
  passStartControls(clients);
  clients.frames(10);
  expect(clients.click(0, ...centre(SELECT_BAR.guide))).toBe(true);
  clients.frames(2);
  expect(clients.click(0, ...centre(GUIDE_ROWS.tutorial))).toBe(true);
  clients.frames(3);
  expect(clients.click(0, ...centre(START_TUTORIAL))).toBe(true);
  until("the tutorial match", () => HUMANS.every(slot => seen(slot).phase === Phase.match));
  clients.frames(30);
  expect(seen(0)).toMatchObject({ hints: true, stripShown: true });
  expect(seen(1)).toMatchObject({ hints: true, stripShown: true });
  tap(Key.h);
  expect(seen(0)).toMatchObject({ hints: false, stripShown: false });
  expect(seen(1)).toMatchObject({ hints: true, stripShown: true });
  tap(Key.h);
  expect(seen(0)).toMatchObject({ hints: true, stripShown: true });
  tap(Key.escape);
  until("the pause", () => HUMANS.every(slot => {
    let paused = false;
    clients.client(slot).run(() => { paused = shell().session.paused; });
    return paused;
  }));
  expect(seen(0).stripShown).toBe(false);
  for (const client of clients.clients) expect(client.errors).toEqual([]);
}, 120_000);
