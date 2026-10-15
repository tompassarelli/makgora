import { readFileSync } from "node:fs";
import { expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { createStandaloneSession, NEUTRAL_INPUT } from "../scripts/wisp/standalone";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { nativeDriverCommand, startScriptedMove } from "../src/platform/nativeDriver";
import { install, start } from "../src/host/entries/nativeDriverMain";
import * as showcase from "../src/host/entries/showcaseMain";
import { driverCommandFile, driverReadyFile, driverStatusFile } from "wisp/src/runtime/nativeDriver";
import { confirmedChecksum } from "../src/host/loop/diagnostics";
import { shell } from "../src/host/loop/state";
import { value } from "./rematch/playableMatch";
import { sweep } from "./sweep";
import { parsePadScript } from "../scripts/integrity/padScript";
import { parseExpectations, parseTrace, scriptChat, TRACE_FILE, unmetExpectations } from "../scripts/integrity/padParity";
import { quickMatchHero, quickMatchHitAreas, quickMatchStocks } from "../src/game/session/devSettings";
import { Phase } from "../src/game/lobby/lobbyState";
import { fighterAt } from "../src/game/sim/roster";
import { fighterName } from "../src/game/sim/heroes/registry";


async function matchesNativeDriver(frames: number): Promise<void> {
  const script = readFileSync(new URL("./native/pads/cpu-expert.pad", import.meta.url), "utf8");
  const checksums: string[] = [];
  const session = await createStandaloneSession({ script });
  try {
    for (let frame = 1; frame <= frames; frame++) {
      session.step(NEUTRAL_INPUT);
      expect(session.frame()).toBe(frame);
      checksums.push(session.checksum());
    }
  } finally { session.close(); }
  const runtime = installHeadless(SMASHCRAFT_HEADLESS);
  try {
    const clients = runtime.clients({ install, start }, [0, 1], { keepCalls: 0 });
    clients.start();
    clients.frames(30);
    clients.everywhere(() => nativeDriverCommand(script));
    clients.everywhere(() => nativeDriverCommand("resume"));
    for (let frame = 1; frame <= frames; frame++) {
      clients.frames(1);
      for (const client of clients.clients) expect(value(client, () => confirmedChecksum(shell())), `frame ${frame} p${client.slot}`).toBe(checksums[frame - 1]);
    }
    for (const client of clients.clients) expect(client.errors).toEqual([]);
  } finally { runtime.restore(); }
}

sweep("standalone CPU fixture matches the native pad driver at all 1070 frames [k1 scenario]", () => matchesNativeDriver(1070), 120000);

test("shield drain pads enable the overlay before quick hero and keep every captured shield raised [k1 scenario]", () => {
  const runtime = installHeadless(SMASHCRAFT_HEADLESS);
  try {
    const clients = runtime.clients({ install, start }, [0, 1], { keepCalls: 0 });
    clients.start();
    clients.frames(30);
    for (const name of ["rifleman", "thrall"]) {
      const script = readFileSync(new URL(`./native/pads/203/shield-drain-${name}.pad`, import.meta.url), "utf8");
      const steps = parsePadScript(script);
      const captures = new Set(steps.filter(step => step.kind === "capture").map(step => step.frame));
      const command = scriptChat(script);
      expect(command).toBeDefined();
      if (command === undefined) throw new Error("missing pad setup");
      const hero = quickMatchHero(command);
      expect(hero).toBeDefined();
      expect(quickMatchHitAreas(command)).toBe(true);
      expect(quickMatchHero(`${command} stocks 3`)).toBe(hero);
      expect(quickMatchStocks(`${command} stocks 3`)).toBe(3);
      expect(quickMatchHero(`-dev quick hero ${name} stocks 3 hit-areas`)).toBeUndefined();
      clients.everywhere(() => nativeDriverCommand(script));
      for (const client of clients.clients) {
        expect(value(client, () => [shell().game.phase, shell().game.training, shell().game.trainer.showHitAreas, shell().ui?.fighters[0]?.hitAreas !== undefined]))
          .toEqual([Phase.match, true, true, true]);
        expect(value(client, () => fighterName(fighterAt(shell().world, 0).character).toLowerCase())).toBe(name);
      }
      clients.everywhere(() => nativeDriverCommand("resume"));
      for (let frame = 1; frame <= (steps.at(-1)?.frame ?? 0); frame++) {
        clients.frames(1);
        if (!captures.has(frame)) continue;
        for (const client of clients.clients) {
          expect(value(client, () => shell().runtime.simulationFrame)).toBe(frame);
          expect(value(client, () => {
            const fighter = fighterAt(shell().world, 0);
            return [fighter.shield.raised, fighter.motion.grounded, fighter.dodge.groundFrame, fighter.jump.squat];
          }), `${name} frame ${frame}`).toEqual([true, true, 0, 0]);
        }
      }
      clients.everywhere(() => nativeDriverCommand("capture"));
      for (const client of clients.clients) {
        expect(unmetExpectations(parseTrace(client.files.get(TRACE_FILE) ?? []), parseExpectations(script), `p${client.slot}`)).toEqual([]);
        expect(client.errors).toEqual([]);
      }
      clients.everywhere(() => nativeDriverCommand(script.replace(command, `${command} stocks 3`)));
      for (const client of clients.clients) expect(value(client, () => [shell().game.stockCount, shell().game.training, shell().game.trainer.showHitAreas]))
        .toEqual([3, true, true]);
    }
  } finally { runtime.restore(); }
});

test("a dev command sent after a script changes the meter and leaves the match running with no reset [k1 scenario]", () => {
  const script = readFileSync(new URL("./native/pads/cpu-expert.pad", import.meta.url), "utf8");
  const runtime = installHeadless(SMASHCRAFT_HEADLESS);
  try {
    const clients = runtime.clients({ install, start }, [0, 1], { keepCalls: 0 });
    clients.start();
    clients.frames(30);
    clients.everywhere(() => nativeDriverCommand(script));
    clients.everywhere(() => nativeDriverCommand("resume"));
    clients.frames(40);
    const before = value(clients.clients[0]!, () => shell().runtime.simulationFrame);
    expect(before).toBeGreaterThan(0);
    clients.everywhere(() => nativeDriverCommand("dev -dev meter 50"));
    for (const client of clients.clients) {
      expect(value(client, () => [shell().runtime.simulationFrame, shell().game.phase, fighterAt(shell().world, 0).mana.points])).toEqual([before, Phase.match, 50]);
    }
    clients.frames(10);
    for (const client of clients.clients) {
      expect(value(client, () => shell().runtime.simulationFrame)).toBeGreaterThan(before);
      expect(client.errors).toEqual([]);
    }
  } finally { runtime.restore(); }
});

test("a one-player showcase client applies a sent driver command and advances its status to serial 1 [k1 scenario]", () => {
  const runtime = installHeadless(SMASHCRAFT_HEADLESS);
  try {
    const clients = runtime.clients(showcase, [0], { keepCalls: 0 });
    clients.start();
    clients.frames(30);
    const [client] = clients.clients;
    if (client === undefined) throw new Error("missing client");
    const status = () => client.files.get(driverStatusFile("smashcraft"))?.[0]?.split(" ")[1];
    expect(status()).toBe("0");
    client.published.set(driverCommandFile("smashcraft", 1), ["dev -dev meter 50"]);
    client.published.set(driverReadyFile("smashcraft", 1), ["ready"]);
    clients.frames(60);
    expect(status()).toBe("1");
    expect(client.errors).toEqual([]);
  } finally { runtime.restore(); }
});

test("the exported scripted move starts an attack from a nonzero pad x and keeps that position [k1 scenario]", () => {
  const runtime = installHeadless(SMASHCRAFT_HEADLESS);
  try {
    const clients = runtime.clients({ install, start }, [0, 1], { keepCalls: 0 });
    clients.start();
    clients.frames(30);
    clients.everywhere(() => nativeDriverCommand("#! chat -dev quick hero forsaken paladin\n"));
    for (const client of clients.clients) {
      expect(value(client, () => {
        const fighter = fighterAt(shell().world, 0);
        fighter.motion.x = 321.0;
        startScriptedMove(shell(), 0, "normal", "2", "right");
        return [fighter.motion.x, fighter.attack.style];
      })).toEqual([321.0, 2]);
    }
  } finally { runtime.restore(); }
});
