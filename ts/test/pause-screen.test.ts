import { expect, test } from "bun:test";
import { install, startBuild } from "../src/platform/main";
import { Phase } from "../src/game/lobby/lobbyState";
import { INTEGRITY_BUILD } from "../src/game/session/currentBuild";
import { Key } from "../src/host/loop/keyEvents";
import { confirmedChecksum } from "../src/host/loop/diagnostics";
import { shell } from "../src/host/loop/state";
import { pauseMatchPresentation } from "../src/host/loop/view";
import { passStartControls } from "../scripts/wisp/startControls";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { testHeadless } from "./headless";
import { MAIN_MENU_BOX, TUTORIAL_BOX } from "../src/game/ui/selectionLayout";
import { f32 } from "wisp/src/sim/f32";

const headless = testHeadless(SMASHCRAFT_HEADLESS);

const HUMANS = [0, 1];
const START_TUTORIAL = { x: f32(0.23), y: f32(0.315), width: f32(0.16), height: f32(0.035) };
const centre = (box: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }) => [f32(box.x + f32(box.width / 2)), f32(box.y - f32(box.height / 2))] as const;
const SHIELD = 0x51;
const LIGHT_SHIELD = 0x45;
const ATTACK = Key.n;
const DOWN = 0x53;
const PAN_LEFT = 0x41;
const ZOOM_OUT = 0x50;

interface Seen {
  readonly phase: number;
  readonly paused: boolean;
  readonly pausedBy: number | undefined;
  readonly camera: string;
  readonly saved: boolean;
  readonly checksum: string;
}

function pausedMatch() {
  const clients = headless.clients({ install, start: () => startBuild(INTEGRITY_BUILD) }, HUMANS);
  const seen = (slot: number): Seen => {
    let result: Seen | undefined;
    clients.client(slot).run(() => {
      const s = shell();
      const { x, z, distance } = s.camera;
      result = { phase: s.game.phase, paused: s.session.paused, pausedBy: s.pausedBy, camera: `${x} ${z} ${distance}`, saved: s.pauseCamera !== undefined, checksum: s.game.phase === Phase.match ? confirmedChecksum(s) : "" };
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
  const hold = (keys: readonly number[], during: () => void) => {
    for (const key of keys) clients.key(0, key, 0, true);
    clients.frames(3);
    during();
    for (const key of keys) clients.key(0, key, 0, false);
    clients.frames(3);
  };
  clients.start();
  passStartControls(clients);
  clients.frames(10);
  expect(clients.click(0, ...centre(TUTORIAL_BOX))).toBe(true);
  clients.frames(3);
  expect(clients.click(0, ...centre(START_TUTORIAL))).toBe(true);
  until("the tutorial match", () => HUMANS.every(slot => seen(slot).phase === Phase.match));
  clients.frames(30);
  return { clients, seen, until, tap, hold };
}

test("Esc pauses and resumes, and the camera keys move only the pausing client's camera without touching the match, restored by resuming [k1 scenario]", () => {
  const { clients, seen, until, tap, hold } = pausedMatch();
  tap(Key.escape);
  until("the pause", () => HUMANS.every(slot => seen(slot).paused));
  const paused = HUMANS.map(seen);
  expect(paused.map(view => view.pausedBy)).toEqual([0, 0]);
  hold([PAN_LEFT, ZOOM_OUT], () => clients.frames(10));
  const moved = HUMANS.map(seen);
  expect(moved[0]?.camera).not.toBe(paused[0]?.camera);
  expect(moved[1]?.camera).toBe(paused[1]?.camera);
  expect(moved.map(view => view.checksum)).toEqual(paused.map(view => view.checksum));
  clients.client(0).run(() => {
    const s = shell();
    const saved = s.pauseCamera?.saved;
    expect(saved).toBeDefined();
    const { x, z, distance } = saved as NonNullable<typeof saved>;
    pauseMatchPresentation(s, false);
    expect([s.camera.x, s.camera.z, s.camera.distance]).toEqual([x, z, distance]);
    expect(s.pauseCamera).toBeUndefined();
  });
  for (const client of clients.clients) expect(client.errors).toEqual([]);
}, 120_000);

test("Backspace and Esc resume a paused match, and L+R+A with Esc resets it to fighter selection while L+A alone only resumes [k1 scenario]", () => {
  const { clients, seen, until, tap, hold } = pausedMatch();
  tap(Key.backspace);
  until("the pause", () => HUMANS.every(slot => seen(slot).paused));
  hold([SHIELD, ATTACK], () => tap(Key.backspace));
  until("the resume", () => HUMANS.every(slot => !seen(slot).paused && seen(slot).phase === Phase.match));
  tap(Key.escape);
  until("the second pause", () => HUMANS.every(slot => seen(slot).paused));
  hold([SHIELD, LIGHT_SHIELD, ATTACK], () => tap(Key.escape));
  until("fighter selection", () => HUMANS.every(slot => seen(slot).phase === Phase.characterMenu));
  for (const client of clients.clients) expect(client.errors).toEqual([]);
}, 120_000);

test("L+R+A with Backspace resets a paused match to fighter selection [k1 scenario]", () => {
  const { clients, seen, until, tap, hold } = pausedMatch();
  tap(Key.backspace);
  until("the pause", () => HUMANS.every(slot => seen(slot).paused));
  hold([SHIELD, LIGHT_SHIELD, ATTACK], () => tap(Key.backspace));
  until("fighter selection", () => HUMANS.every(slot => seen(slot).phase === Phase.characterMenu));
  for (const client of clients.clients) expect(client.errors).toEqual([]);
}, 120_000);

test("the title screen opens from fighter selection by the Main menu button, Esc and the menu focus (down to it, then Attack), on every client, and Attack closes it [k1 scenario]", () => {
  const clients = headless.clients({ install, start: () => startBuild(INTEGRITY_BUILD) }, HUMANS);
  const titles = () => HUMANS.map(slot => {
    let title = false;
    clients.client(slot).run(() => { title = shell().pauseMenu?.title === true; });
    return title;
  });
  const tap = (key: number) => {
    clients.key(0, key, 0, true);
    clients.frames(5);
    clients.key(0, key, 0, false);
    clients.frames(5);
  };
  clients.start();
  passStartControls(clients);
  clients.frames(10);
  expect(titles()).toEqual([false, false]);
  expect(clients.click(0, ...centre(MAIN_MENU_BOX))).toBe(true);
  clients.frames(5);
  expect(titles()).toEqual([true, true]);
  tap(ATTACK);
  expect(titles()).toEqual([false, false]);
  tap(Key.escape);
  expect(titles()).toEqual([true, true]);
  tap(ATTACK);
  expect(titles()).toEqual([false, false]);
  tap(DOWN);
  tap(DOWN);
  tap(ATTACK);
  expect(titles()).toEqual([true, true]);
  for (const client of clients.clients) expect(client.errors).toEqual([]);
}, 120_000);
