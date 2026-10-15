import { expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { install, start } from "../src/host/entries/nativeDriverMain";
import { install as installGame, startBuild } from "../src/platform/main";
import { nativeDriverCommand } from "../src/platform/nativeDriver";
import { confirmedChecksum } from "../src/host/loop/diagnostics";
import { applyDeveloperCommand } from "../src/host/loop/keys";
import { shell } from "../src/host/loop/state";
import { Phase } from "../src/game/lobby/lobbyState";
import { CURRENT_BUILD, INTEGRITY_BUILD, PLAYABLE_BUILD } from "../src/game/session/currentBuild";
import { SHOWCASE_PAD_X } from "../src/game/session/showcase";
import { fighterAt, isActive } from "../src/game/sim/roster";
import { fighterName } from "../src/game/sim/heroes/registry";
import { value } from "./rematch/playableMatch";

const PAD_A = 1;
const PAD_RB = 32;

function showcaseSession() {
  const runtime = installHeadless(SMASHCRAFT_HEADLESS);
  const clients = runtime.clients({ install, start }, [0], { keepCalls: 0 });
  clients.start();
  clients.frames(30);
  const client = clients.client(0);
  const read = <T>(view: () => T): T => value(client, view);
  const phases: Phase[] = [];
  const chat = (command: string) => {
    phases.length = 0;
    client.run(() => {
      const s = shell();
      const before = s.game.phase;
      applyDeveloperCommand(s, 0, command);
      phases.push(before, s.game.phase);
      nativeDriverCommand("resume");
    });
  };
  const frames = (count: number) => {
    for (let frame = 0; frame < count; frame++) {
      clients.frames(1);
      expect(client.errors).toEqual([]);
    }
  };
  const pads = () => read(() => [0, 1, 2, 3].map(slot => isActive(shell().world, slot) ? fighterName(fighterAt(shell().world, slot).character).toLowerCase() : ""));
  const brawl = (count: number) => {
    client.run(() => {
      const { world } = shell();
      fighterAt(world, 0).motion.x = -20.0; fighterAt(world, 0).facing = 1;
      fighterAt(world, 1).motion.x = 20.0; fighterAt(world, 1).facing = -1;
    });
    const contacts: string[] = [];
    for (let frame = 0; frame < count; frame++) {
      const buttons = frame % 12 < 2 ? PAD_A : frame % 12 >= 6 && frame % 12 < 8 ? PAD_RB : 0;
      client.run(() => { for (const pad of globalThis.__smashcraftNativeDriver?.pads.slice(0, 2) ?? []) pad.buttons = buttons; });
      frames(1);
      contacts.push(...read(() => [0, 1].flatMap(slot => {
        const fighter = fighterAt(shell().world, slot);
        return fighter.status.damage !== 0.0 || fighter.grab.owner !== undefined || fighter.grab.target !== undefined ? [`p${slot} frame ${frame}`] : [];
      })));
    }
    client.run(() => { for (const pad of globalThis.__smashcraftNativeDriver?.pads ?? []) pad.buttons = 0; });
    return contacts;
  };
  return { runtime, client, read, chat, frames, pads, brawl, phases };
}

test("showcase pads restart one native-driver client in place as a single no-damage team with fighters standing on their pads [k1 scenario]", () => {
  const { runtime, client, read, chat, frames, pads, brawl, phases } = showcaseSession();
  try {
    const original = read(() => shell());
    chat("-dev showcase start rifleman,forsaken paladin");
    expect(read(() => [shell().game.phase, shell().runtime.simulationFrame, fighterAt(shell().world, 0).motion.x, fighterAt(shell().world, 1).motion.x]))
      .toEqual([Phase.match, 0, SHOWCASE_PAD_X[0], SHOWCASE_PAD_X[1]]);
    expect(pads()).toEqual(["rifleman", "forsaken paladin", "", ""]);
    frames(120);
    expect(read(() => [shell().game.phase, shell().world.teamBattle, shell().world.friendlyFire, shell().game.endless, shell().game.humanCount]))
      .toEqual([Phase.match, true, false, true, 4]);
    expect(brawl(120)).toEqual([]);

    chat("-dev showcase spawn 2 goblin tinker");
    expect(phases).toEqual([Phase.match, Phase.match]);
    expect(pads()).toEqual(["rifleman", "goblin tinker", "", ""]);
    expect(read(() => shell().runtime.simulationFrame)).toBe(0);
    chat("-dev showcase clear 1");
    expect(pads()).toEqual(["", "goblin tinker", "", ""]);
    chat("-dev showcase clear 2");
    expect(pads()).toEqual(["", "goblin tinker", "", ""]);
    chat("-dev showcase spawn 1 rifleman");
    expect(pads()).toEqual(["rifleman", "goblin tinker", "", ""]);
    expect(read(() => [shell() === original, shell().game.phase, fighterAt(shell().world, 1).motion.x])).toEqual([true, Phase.match, SHOWCASE_PAD_X[1]]);
    expect(brawl(120)).toEqual([]);
    expect(read(() => shell().game.phase)).toBe(Phase.match);
    expect(client.errors).toEqual([]);
  } finally { runtime.restore(); }
}, 60000);

test("showcase commands leave builds without the native driver profile untouched [k1 scenario]", () => {
  for (const build of [PLAYABLE_BUILD, INTEGRITY_BUILD, CURRENT_BUILD]) {
    const runtime = installHeadless(SMASHCRAFT_HEADLESS);
    try {
      const clients = runtime.clients({ install: () => installGame(build), start: () => startBuild(build) }, [0, 1], { keepCalls: 0 });
      clients.start();
      clients.frames(30);
      for (const client of clients.clients) {
        const state = () => value(client, () => [confirmedChecksum(shell()), shell().game.phase, shell().game.humanFighterMask, shell().game.computerMask, shell().game.teamBattle]);
        const before = state();
        client.run(() => applyDeveloperCommand(shell(), 0, "-dev showcase start rifleman,forsaken paladin"));
        expect(state(), build.id).toEqual(before);
        expect(client.errors).toEqual([]);
      }
    } finally { runtime.restore(); }
  }
}, 60000);
