import { expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { install, startBuild } from "../src/platform/main";
import { shell } from "../src/host/loop/state";
import { CURRENT_BUILD } from "../src/game/session/currentBuild";
import { SHIELD_ENERGY_SAMPLES, SHIELD_ENERGY_SETUP } from "../src/game/session/shieldEnergyCapture";
import { fighterAt } from "../src/game/sim/roster";
import { Phase } from "../src/game/lobby/lobbyState";
import { SHIELD_MAX } from "../src/game/sim/fighter";
import { Key } from "../src/host/loop/keyEvents";
import { devChatInput } from "../scripts/wisp/commands/fresh";

const KEY_CODES: Readonly<Record<string, number>> = { Return: Key.enter, Escape: Key.escape };

test("shield acceptance holds down full mid and low frames with falling drawn radii through the native chat input [k1 scenario]", () => {
  const runtime = installHeadless(SMASHCRAFT_HEADLESS);
  const clients = runtime.clients({ install: () => install(CURRENT_BUILD), start: () => startBuild(CURRENT_BUILD) }, [0, 1], { keepCalls: 0 });
  try {
    const nativeChat = (text: string) => {
      for (const action of devChatInput(text)) {
        if (action.kind === "text") clients.chat(0, action.text);
        else if (action.kind === "keys") for (const name of action.keys) {
          const code = KEY_CODES[name];
          if (code === undefined) throw new Error(`no key code for ${name}`);
          clients.key(0, code, 0, true);
          clients.key(0, code, 0, false);
        } else throw new Error(`unexpected chat input ${action.kind}`);
      }
    };
    clients.start();
    clients.frames(30);
    nativeChat(SHIELD_ENERGY_SETUP);
    const samples: { energy: number; radius: number }[] = [];
    for (const sample of SHIELD_ENERGY_SAMPLES) {
      nativeChat(`-dev shield-energy ${sample}`);
      clients.client(0).run(() => expect(shell().game.phase, `${sample} chat keeps the match`).toBe(Phase.match));
      let held = false;
      for (let frame = 0; frame < 650 && !held; frame++) {
        clients.frames(1);
        clients.client(0).run(() => { held = shell().dev.shieldEnergyCapture?.pending === false; });
      }
      expect(held).toBe(true);
      const lines = clients.client(0).files.get("smashcraft-dev-shield-energy-p0.txt") ?? [];
      const line = lines.find(line => line.startsWith(`SMASHCRAFT SHIELD sample=${sample} `));
      console.log(line);
      expect(line).toBeDefined();
      expect(line).toEndWith("pass=1");
      const energy = Number(/ energy=(\S+)/.exec(line ?? "")?.[1]);
      const radius = Number(/ radius=(\S+)/.exec(line ?? "")?.[1]);
      if (sample === "down") expect(line).toContain("raised=F");
      else {
        expect(line).toContain("raised=T");
        expect(radius).toBeGreaterThan(0);
        samples.push({ energy, radius });
      }
      let before = 0;
      clients.client(0).run(() => { before = shell().runtime.simulationFrame; });
      clients.frames(10);
      clients.client(0).run(() => {
        expect(shell().runtime.simulationFrame).toBe(before);
        expect(fighterAt(shell().world, 2).shield.energy).toBe(energy);
      });
    }
    expect(samples[0]?.energy).toBe(SHIELD_MAX);
    expect(samples[1]?.energy).toBeLessThan(samples[0]?.energy ?? 0);
    expect(samples[2]?.energy).toBeLessThanOrEqual(SHIELD_MAX / 12);
    expect(samples[2]?.radius).toBeLessThan(samples[1]?.radius ?? 0);
    expect(samples[1]?.radius).toBeLessThan(samples[0]?.radius ?? 0);
    for (const client of clients.clients) expect(client.errors).toEqual([]);
  } finally { runtime.restore(); }
});
