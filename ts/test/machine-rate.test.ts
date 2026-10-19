import { expect, test } from "bun:test";
import type { HeadlessClient } from "wisp/src/headless/client";
import type { SyncDelivery } from "wisp/src/headless/lockstep";
import { CALLBACK_MS } from "wisp/src/headless/syncChannel";
import { Phase } from "../src/game/lobby/lobbyState";
import { FULL_SPEED_FPS, slowMachineText } from "../src/game/netcode/machineRate";
import type { MapBuild } from "../src/game/session/build";
import { PLAYABLE_BUILD } from "../src/game/session/currentBuild";
import { installSessionRates } from "../src/host/loop/sessionRates";
import { localSlot, shellState } from "../src/host/loop/state";
import { install, startBuild } from "../src/platform/main";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { passStartControls } from "../scripts/wisp/startControls";
import { testHeadless } from "./headless";

const headless = testHeadless(SMASHCRAFT_HEADLESS);

const BUILD: MapBuild = { ...PLAYABLE_BUILD, id: "typescript-machine-rate", devConsole: true };
const HUMANS = [0, 1, 2, 3];
const ECHO_MS = [100, 300, 600, 200];
const SLOW_SLOT = 2;
const THROTTLED_FPS = 40;
const BUSY_SHARE = 0.95;
const LOBBY_FRAMES = 600;
const MATCH_FRAMES = 300;
const RECOVERY_FRAMES = 360;
const ONE_ROW_CHARS = 106;

class Throttle {
  fps = THROTTLED_FPS;
  private baseFrame = 0;
  private baseSeconds = 0;
  private spentFrame = -1;
  private spent = 0;

  constructor(private readonly client: HeadlessClient) {}

  now(): number {
    if (this.client.frame !== this.spentFrame) {
      this.spentFrame = this.client.frame;
      this.spent = 0;
    }
    return this.baseSeconds + (this.client.frame - this.baseFrame) / this.fps + this.spent;
  }

  spend(): void {
    this.now();
    if (this.fps < FULL_SPEED_FPS) this.spent = BUSY_SHARE / this.fps;
  }

  release(): void {
    this.baseSeconds += (this.client.frame - this.baseFrame) / this.fps;
    this.baseFrame = this.client.frame;
    this.fps = FULL_SPEED_FPS;
  }
}

test("a client held at 40 simulated frames per second with its callbacks saturated shows every player's rate on the one-row delay line, names P3 as running slow in Character select and in the match on all four clients, and the warning clears on every client after it recovers [k1 scenario]", () => {
  const delivery: SyncDelivery = { arrivalFrame: (sender, frame) => frame + Math.max(1, Math.round((ECHO_MS[sender] ?? 0) / CALLBACK_MS)) };
  let throttle: Throttle | undefined;
  const start = () => {
    startBuild(BUILD);
    const table = globalThis.__smashcraftDispatch;
    if (table !== undefined && GetPlayerId(GetLocalPlayer()) === SLOW_SLOT) {
      const plain = table.run;
      table.run = (name: string) => {
        plain(name);
        if (name === "shell.tick") throttle?.spend();
      };
    }
    installSessionRates(BUILD.id);
  };
  const clients = headless.clients({ install, start }, HUMANS, { delivery });
  const slow = clients.clients[SLOW_SLOT];
  if (slow === undefined) throw new Error("no slow client");
  const held = new Throttle(slow);
  throttle = held;
  slow.natives.os = { clock: () => held.now() };
  clients.start();
  clients.frames(30);
  passStartControls(clients);
  clients.frames(LOBBY_FRAMES);
  const warning = slowMachineText(SLOW_SLOT, THROTTLED_FPS);
  const read = (body: () => string) => HUMANS.map((_, index) => {
    let text = "";
    clients.clients[index]?.run(() => { text = body(); });
    return text;
  });
  const phases = () => read(() => `${shellState()?.game.phase ?? -1}`);
  expect(phases()).toEqual(HUMANS.map(() => `${Phase.characterMenu}`));
  const panels = read(() => BlzFrameGetText(BlzGetFrameByName(`MeleeDelayLine${localSlot()}`, 0)));
  console.log(`machine rate panels: ${JSON.stringify(panels)}`);
  for (const text of panels) {
    const row = text.split("\n")[0] ?? "";
    for (const slot of HUMANS) {
      const shown = new RegExp(`P${slot + 1} (?:fixed )?\\d+ \\(\\d+ ms\\) (\\d+)`).exec(row);
      expect(shown, row).not.toBeNull();
      expect(Number(shown?.[1]), row).toBe(slot === SLOW_SLOT ? THROTTLED_FPS : FULL_SPEED_FPS);
    }
    expect(row.length, row).toBeLessThanOrEqual(ONE_ROW_CHARS);
    expect(text).toContain(warning);
    for (const slot of HUMANS) if (slot !== SLOW_SLOT) expect(text).not.toContain(`P${slot + 1}'s machine`);
  }
  clients.chat(0, "-dev quick");
  for (let frame = 0; frame < LOBBY_FRAMES && phases()[0] !== `${Phase.match}`; frame++) clients.frames(1);
  clients.frames(MATCH_FRAMES);
  expect(phases()).toEqual(HUMANS.map(() => `${Phase.match}`));
  const notices = () => read(() => shellState()?.rollback?.net.shownText ?? "");
  for (const notice of notices()) expect(notice).toContain(warning.slice(0, warning.indexOf("(")));
  held.release();
  clients.frames(RECOVERY_FRAMES);
  for (const notice of notices()) expect(notice).not.toContain("machine is running slow");
  for (const client of clients.clients) expect(client.errors).toEqual([]);
}, 60_000);
