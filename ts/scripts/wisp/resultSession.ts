import { join } from "node:path";
import { installHeadless } from "wisp/scripts/wisp/headless";
import type { captureScene } from "wisp/scripts/wisp/headlessRender";
import { Phase } from "../../src/game/lobby/lobbyState";
import { PLAYABLE_BUILD } from "../../src/game/session/currentBuild";
import type { MapBuild } from "../../src/game/session/build";
import { type Character } from "../../src/game/sim/codes";
import { fighterKey, fighterName } from "../../src/game/sim/heroes/registry";
import { SMASHCRAFT_HEADLESS } from "./headless";

type HeadlessClient = Parameters<typeof captureScene>[0];

const MATCH_FRAMES = 240;
const ENDING_FRAMES = 600;

export interface ResultSession {
  readonly client: HeadlessClient;
  resultFrame(): number;
  step(): void;
  close(): void;
}

export async function createResultSession(winner: Character, loser: Character): Promise<ResultSession> {
  const runtime = installHeadless(SMASHCRAFT_HEADLESS);
  try {
    const loop = join(import.meta.dir, "../../src/host/loop");
    interface State { readonly game: { readonly phase: number }; readonly world: unknown }
    const { shell }: { shell(): State } = await import(join(loop, "state.ts"));
    const { applyDeveloperCommand }: { applyDeveloperCommand(state: State, slot: number, text: string): void } = await import(join(loop, "developerCommands.ts"));
    const { views }: { views(state: State): { readonly match: { readonly resultFrames: number } } } = await import(join(loop, "ui.ts"));
    const { fighterAt }: { fighterAt(world: unknown, slot: number): { readonly status: { stocks: number; out: boolean } } } = await import(join(import.meta.dir, "../../src/game/sim/roster.ts"));
    const main: { install(build: MapBuild): void; startBuild(build: MapBuild): void } = await import(join(import.meta.dir, "../../src/platform/main.ts"));
    const build = { ...PLAYABLE_BUILD, devConsole: true };
    const clients = runtime.clients({ install: () => main.install(build), start: () => main.startBuild(build) }, [0], { keepCalls: 0 });
    clients.start();
    clients.frames(30);
    const client = clients.client(0);
    const read = <T>(value: () => T): T => {
      let result: T | undefined;
      client.run(() => { result = value(); });
      if (result === undefined) throw new Error("result session state missing");
      return result;
    };
    const pair = `${fighterName(winner)} beats ${fighterName(loser)}`;
    client.run(() => applyDeveloperCommand(shell(), 0, `-dev quick pair ${fighterKey(winner)} / ${fighterKey(loser)}`));
    if (read(() => shell().game.phase) !== Phase.match) throw new Error(`${pair}: match did not start`);
    clients.frames(MATCH_FRAMES);
    client.run(() => {
      const { status } = fighterAt(shell().world, 1);
      status.stocks = 0;
      status.out = true;
    });
    for (let frame = 0; frame < ENDING_FRAMES && read(() => shell().game.phase) !== Phase.result; frame++) clients.frames(1);
    if (read(() => shell().game.phase) !== Phase.result) throw new Error(`${pair}: match did not end`);
    return {
      client,
      resultFrame: () => read(() => views(shell()).match.resultFrames),
      step() {
        clients.frames(1);
        if (client.errors.length > 0) throw new Error(client.errors.join("\n"));
      },
      close: () => runtime.restore(),
    };
  } catch (error) {
    runtime.restore();
    throw error;
  }
}
