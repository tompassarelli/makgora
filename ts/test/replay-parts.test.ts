import { expect, test } from "bun:test";
import { testHeadless } from "./headless";
import type { HeadlessClient } from "wisp/src/headless/client";
import { install, start } from "../src/platform/main";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { shell } from "../src/host/loop/state";
import { Phase } from "../src/game/lobby/lobbyState";
import { PART_LINES } from "../src/game/replay/matchReplay";

const headless = testHeadless(SMASHCRAFT_HEADLESS);

function partFiles(client: HeadlessClient, serial: number): string[] {
  return [...client.files.keys()].filter((name) => name.startsWith(`smashcraft-replay-${serial}-`));
}

function read<T>(client: HeadlessClient, body: () => T): T {
  let result: { value: T } | undefined;
  client.run(() => { result = { value: body() }; });
  if (result === undefined) throw new Error("client did not run");
  return result.value;
}

test("replay parts wait while the match plays and are written one a callback once play pauses [k1 scenario]", () => {
  const clients = headless.clients({ start, install });
  clients.start();
  clients.frames(30);
  clients.chat(0, "-dev quick cpu wren expert");
  clients.frames(1500);
  for (const client of clients.clients) {
    const { phase, serial, pending } = read(client, () => ({ phase: shell().game.phase, serial: shell().replay.serial, pending: shell().replay.recorder.lines.length }));
    expect(phase).toBe(Phase.match);
    expect(pending).toBeGreaterThanOrEqual(2 * PART_LINES);
    expect(partFiles(client, serial)).toEqual([]);
  }
  const pending = clients.clients.map((client) => read(client, () => shell().replay.recorder.lines.length));
  for (const client of clients.clients) client.run(() => { shell().session.paused = true; });
  const whole = Math.max(...pending.map((lines) => Math.trunc(lines / PART_LINES)));
  for (let callback = 1; callback <= whole + 2; callback++) {
    clients.frames(1);
    clients.clients.forEach((client, index) => {
      const parts = Math.min(callback, Math.trunc((pending[index] ?? 0) / PART_LINES));
      expect(partFiles(client, read(client, () => shell().replay.serial)).length).toBe(parts);
      expect(read(client, () => shell().replay.recorder.lines.length)).toBe((pending[index] ?? 0) - parts * PART_LINES);
    });
  }
  for (const client of clients.clients) expect(client.errors).toEqual([]);
});
