import { expect, test } from "bun:test";
import { reproLines } from "wisp/src/runtime/repro";
import { finishMatchReplay, takeMatchReplayPart, parseReplayPart, replayMatch } from "../src/game/replay/matchReplay";
import { replayPartFile } from "../src/game/core/gameFiles";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { install, startBuild } from "../src/platform/main";
import { shell } from "../src/host/loop/state";
import { applyDeveloperCommand } from "../src/host/loop/keys";
import { CURRENT_BUILD, INTEGRITY_BUILD, PLAYABLE_BUILD } from "../src/game/session/currentBuild";
import type { MapBuild } from "../src/game/session/build";
import { CandleState } from "../src/game/sim/codes";
import { fighterAt } from "../src/game/sim/roster";
import { candleLevel } from "../src/game/sim/heroes/koboldCandle";

import { JournalHelpers } from "./rematch/journalHelper";

function value<T>(client: { run(body: () => void): void }, read: () => T): T {
  let result: { value: T } | undefined;
  client.run(() => { result = { value: read() }; });
  if (result === undefined) throw new Error("client did not run");
  return result.value;
}

function session(build: MapBuild = CURRENT_BUILD) {
  const runtime = installHeadless(SMASHCRAFT_HEADLESS);
  const clients = runtime.clients({ install: () => install(build), start: () => startBuild(build) }, [0, 1], { keepCalls: 0 });
  const helpers = new JournalHelpers(build.id, true);
  const frames = (count: number) => { for (let frame = 0; frame < count; frame++) { clients.frames(1); if (build.input.kind === "journal") helpers.service(clients); } };
  clients.start();
  frames(30);
  const chat = (text: string) => clients.chat(0, text);
  const read = <T>(body: () => T) => value(clients.client(0), body);
  return { runtime, clients, frames, chat, read };
}

test("percent chat sets one fighter before frame one and survives subsequent predicted frames [k1 scenario]", () => {
  const { runtime, clients, frames, chat, read } = session(INTEGRITY_BUILD);
  try {
    chat("-dev setup quick pair Kobold / Rifleman;percent 1 125");
    expect(read(() => [shell().runtime.simulationFrame, fighterAt(shell().world, 0).status.damage, fighterAt(shell().world, 1).status.damage])).toEqual([0, 125, 0]);
    frames(50);
    const before = read(() => shell().runtime.simulationFrame);
    expect(before).toBeGreaterThan(0);
    chat("-dev percent 1 240");
    expect(read(() => fighterAt(shell().world, 0).status.damage)).toBe(240);
    expect(read(() => fighterAt(shell().rollback?.speculative.world ?? shell().world, 0).status.damage)).toBe(240);
    frames(50);
    expect(read(() => shell().runtime.simulationFrame)).toBeGreaterThan(before);
    for (const client of clients.clients) {
      expect(value(client, () => fighterAt(shell().world, 0).status.damage)).toBe(240);
      expect(client.errors).toEqual([]);
    }
    for (const command of ["-dev percent 0 20", "-dev percent 5 20", "-dev percent 1 -1", "-dev percent 1 1000", "-dev percent 1 20 extra"]) chat(command);
    expect(read(() => fighterAt(shell().world, 0).status.damage)).toBe(240);
    const recorded = read(() => {
      const state = shell();
      const end = finishMatchReplay(state.replay.recorder, state.moment.recorder, state.world, state.game, state.controls, state.runtime);
      if (end === undefined) throw new Error("missing replay");
      const tail = takeMatchReplayPart(state.replay.recorder, true) ?? [];
      return { ...end, liveFrame: state.runtime.simulationFrame, tail, serial: state.replay.serial, parts: state.replay.recorder.parts };
    });
    const body: string[] = [];
    for (let part = 1; part < recorded.parts; part++) {
      const parsed = parseReplayPart(clients.client(0).files.get(replayPartFile(recorded.serial, part)) ?? [], recorded.serial, part);
      if (typeof parsed === "string") throw new Error(parsed);
      body.push(...parsed);
    }
    body.push(...recorded.tail);
    const replayed = replayMatch(reproLines({ build: INTEGRITY_BUILD.id, frame: recorded.frame, checksum: recorded.checksum }, [
      "replay " + recorded.serial, "version development", ...body,
    ]));
    expect(recorded.frame).toBe(recorded.liveFrame);
    expect(replayed.problems).toEqual([]);
    expect(replayed.reached).toBe(replayed.recorded);
  } finally { runtime.restore(); }
}, 30000);

test("candle chat selects every heat level and keeps a real dropped candle loose through predicted frames [k1 scenario]", () => {
  const { runtime, clients, frames, chat, read } = session(INTEGRITY_BUILD);
  try {
    chat("-dev quick pair Kobold / Rifleman");
    frames(30);
    for (const level of [0, 1, 2, 3]) {
      chat(`-dev candle 1 ${level}`);
      expect(read(() => candleLevel(fighterAt(shell().world, 0)))).toBe(level);
    }
    chat("-dev candle 1 4");
    chat("-dev candle 2 3");
    expect(read(() => candleLevel(fighterAt(shell().world, 0)))).toBe(3);
    chat("-dev candle 1 drop");
    expect(read(() => fighterAt(shell().world, 0).candle.state)).toBe(CandleState.airborne);
    frames(15);
    for (const client of clients.clients) {
      expect(value(client, () => fighterAt(shell().world, 0).candle.state)).not.toBe(CandleState.held);
      expect(client.errors).toEqual([]);
    }
  } finally { runtime.restore(); }
});

test("team chat starts human plus three computers and four computers as the requested two teams [k1 scenario]", () => {
  const { runtime, clients, frames, chat, read } = session();
  try {
    for (const slots of ["1 14", "0 15"]) {
      chat("-dev reset");
      chat(`-dev setup slots ${slots};teams on;team 1 2;team 2 2;team 3 3;team 4 3;quick`);
      expect(read(() => [shell().world.teamBattle, ...shell().world.teamChoices])).toEqual([true, 2, 2, 3, 3]);
      frames(60);
      for (const client of clients.clients) expect(client.errors).toEqual([]);
      chat("-dev team 1 0");
      expect(read(() => shell().game.teamChoices[0])).toBe(2);
    }
  } finally { runtime.restore(); }
});

test("player chat and direct dispatch refuse percent candle and teams outside developer profiles [k1 scenario]", () => {
  const { runtime, clients, chat, read } = session(PLAYABLE_BUILD);
  try {
    const commands = ["-dev percent 1 125", "-dev candle 1 3", "-dev candle 1 drop", "-dev teams on", "-dev team 1 2", "-dev setup quick;percent 1 125"];
    const before = read(() => structuredClone({ game: shell().game, world: shell().world }));
    for (const command of commands) {
      chat(command);
      clients.everywhere(() => applyDeveloperCommand(shell(), 0, command));
    }
    expect(read(() => ({ game: shell().game, world: shell().world }))).toEqual(before);
    expect(read(() => shell().devReceipts)).toBe(0);
  } finally { runtime.restore(); }
});
