import { expect, test } from "bun:test";
import { testHeadless } from "./headless";
import { PREDICTED_HEADLESS } from "../scripts/wisp/headless";
import { PLAYABLE_BUILD } from "../src/game/session/currentBuild";
import { install, startBuild } from "../src/platform/main";
import { shell } from "../src/host/loop/state";
import { panelActions } from "../src/host/loop/menus";
import { createMatchState, initializeComputerChoices, Phase, setParticipants } from "../src/game/lobby/lobbyState";
import { PLAYABLE_CHARACTERS } from "../src/game/sim/heroes/registry";

function value<T>(client: { run(body: () => void): void }, body: () => T): T {
  let result: { value: T } | undefined;
  client.run(() => { result = { value: body() }; });
  if (result === undefined) throw new Error("the client did not run");
  return result.value;
}

function shows(client: { frames: { shownText(): readonly string[] } }, text: string): boolean {
  return client.frames.shownText().some(shown => shown.includes(text));
}

const headless = testHeadless({
  ...PREDICTED_HEADLESS,
  natives: client => ({
    ...PREDICTED_HEADLESS.natives?.(client),
    GetPlayerController: (player: unknown) => Number(player) < 2 ? "MAP_CONTROL_USER" : "MAP_CONTROL_COMPUTER",
    GetPlayerSlotState: () => "PLAYER_SLOT_STATE_PLAYING",
  }),
});

test("CPU startup waits for synchronized bindings, varies by delivery frame and keeps later choices through match start [k5 boundary cpu-startup]", () => {
  const defaults = new Set<string>();
  for (const latency of [6, 11, 19]) {
    const clients = headless.clients({ install, start: () => startBuild(PLAYABLE_BUILD) }, [0, 1], {
      delivery: { arrivalFrame: (_sender, frame) => frame + latency }, keepCalls: 512,
    });
    clients.start();
    clients.frames(1);
    for (const client of clients.clients) {
      expect(value(client, () => shell().startingChoicesReady)).toBe(false);
      expect(shows(client, "CPU ·")).toBe(false);
      client.run(() => panelActions().selection.start(0));
      expect(value(client, () => shell().game.phase)).toBe(Phase.characterMenu);
    }
    for (let frame = 0; frame < 60 && !value(clients.client(0), () => shell().startingChoicesReady); frame++) clients.frames(1);
    const host = clients.client(0);
    const seed = value(host, () => (shell().menuFrames ?? 0) - 1);
    const expected = createMatchState();
    setParticipants(expected, 3, 12);
    initializeComputerChoices(expected, seed);
    defaults.add(expected.characterChoices.slice(2).join());
    for (const client of clients.clients) {
      expect(value(client, () => shell().startingChoicesReady)).toBe(true);
      expect(value(client, () => shell().game.characterChoices)).toEqual(expected.characterChoices);
      expect(shows(client, "CPU ·")).toBe(true);
    }
    const choice = PLAYABLE_CHARACTERS.find(character => character !== expected.characterChoices[2]);
    if (choice === undefined) throw new Error("the roster needs two fighters");
    clients.everywhere(() => panelActions().selection.selectCpuChoice(0, 2, choice));
    clients.frames(60);
    for (const client of clients.clients) expect(value(client, () => shell().game.characterChoices[2])).toBe(choice);
    if (latency !== 6) {
      for (const client of clients.clients) expect(client.errors).toEqual([]);
      expect(clients.firstDivergence()).toBeUndefined();
      continue;
    }
    clients.everywhere(() => {
      const actions = panelActions().selection;
      for (const slot of [0, 1]) actions.selectChoice(slot, shell().game.characterChoices[slot] ?? choice);
      actions.start(0);
    });
    clients.frames(1);
    clients.everywhere(() => panelActions().stage.start(0));
    clients.frames(180);
    for (const client of clients.clients) {
      expect(value(client, () => shell().game.phase)).toBe(Phase.match);
      expect(value(client, () => shell().game.characterChoices[2])).toBe(choice);
      expect(client.errors).toEqual([]);
    }
    expect(clients.firstDivergence()).toBeUndefined();
  }
  expect(defaults.size).toBeGreaterThan(1);
});
