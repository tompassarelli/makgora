import { expect, test } from "bun:test";
import { testHeadless } from "./headless";
import { install, start } from "../src/platform/main";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";

const headless = testHeadless(SMASHCRAFT_HEADLESS);

test("the shell holds the game at lobby Fast (MAP_SPEED_NORMAL) and locks it at load and at every match start [k5 boundary game-speed]", () => {
  const clients = headless.clients({ start, install });
  clients.start();
  clients.frames(30);
  const atLoad = clients.clients.map((client) => client.log.filter(({ name }) => name === "SetGameSpeed").length);
  clients.chat(0, "-dev quick cpu wren expert");
  clients.frames(30);
  clients.clients.forEach((client, index) => {
    const speeds = client.log.filter(({ name }) => name === "SetGameSpeed");
    const locks = client.log.filter(({ name }) => name === "SetMapFlag");
    expect(atLoad[index]).toBeGreaterThan(0);
    expect(speeds.length).toBeGreaterThan(atLoad[index] ?? 0);
    expect(speeds.every(({ args }) => args[0] === client.natives.MAP_SPEED_NORMAL)).toBe(true);
    expect(locks.length).toBe(speeds.length);
    expect(locks.every(({ args }) => args[0] === client.natives.MAP_LOCK_SPEED && args[1] === true)).toBe(true);
  });
});
