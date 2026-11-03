import { expect, test } from "bun:test";
import { Phase } from "../src/game/lobby/lobbyState";
import type { MapBuild } from "../src/game/session/build";
import { PLAYABLE_BUILD } from "../src/game/session/currentBuild";
import { BossKind } from "../src/game/classic/runState";
import { install, startBuild } from "../src/platform/main";
import { activeRollback, shellState } from "../src/host/loop/state";
import { MAKGORA_HEADLESS } from "../scripts/wisp/headless";
import { testHeadless } from "./headless";

const headless = testHeadless(MAKGORA_HEADLESS);

const BUILD: MapBuild = { ...PLAYABLE_BUILD, id: "typescript-boss-plate", devConsole: true };
const LOBBY_FRAMES = 900;
const EDGE = 1e-6;

type Rectangle = readonly [number, number, number, number];
const disjoint = ([left, top, right, bottom]: Rectangle, [otherLeft, otherTop, otherRight, otherBottom]: Rectangle): boolean =>
  right <= otherLeft + EDGE || otherRight <= left + EDGE || bottom >= otherTop - EDGE || otherBottom >= top - EDGE;

test("Archimonde's boss plate shows his name, portrait and remaining health, counts down as he loses health with the bar shrinking to match, and stays clear of the player's plate [k1 scenario]", () => {
  const clients = headless.clients({ install, start: () => startBuild(BUILD) }, [0]);
  const client = clients.client(0);
  clients.start();
  clients.frames(120);
  clients.chat(0, "-dev classic boss blademaster");
  let phase = -1, kind: number = BossKind.none, full = 0;
  for (let frame = 0; frame < LOBBY_FRAMES && phase !== Phase.match; frame++) {
    clients.frames(1);
    client.run(() => {
      const s = shellState();
      phase = s?.game.phase ?? -1;
      kind = s?.game.run.boss.kind ?? BossKind.none;
      full = s?.game.run.boss.maxHealth ?? 0;
    });
  }
  expect(phase).toBe(Phase.match);
  expect(kind).toBe(BossKind.archimonde);
  expect(full).toBeGreaterThan(37);
  const shown = () => {
    const frames = client.frames.snapshot({ visibleOnly: true });
    const named = (name: string) => frames.find(frame => frame.name === name);
    const width = (name: string) => { const box = named(name)?.rectangle; return box === undefined ? 0 : box[2] - box[0]; };
    return { frames, named, fill: width("BossPlateBarFill") / width("BossPlateBarBack") };
  };
  clients.frames(30);
  const start = shown();
  expect(start.named("BossPlateName")?.text).toContain("Archimonde");
  expect(start.named("BossPlatePortrait")?.texture).toBe("ReplaceableTextures\\CommandButtons\\BTNArchimonde.blp");
  expect(start.named("BossPlateHealth")?.text).toContain(`${full}|r`);
  expect(start.fill).toBeCloseTo(1.0, 3);
  const panel = start.named("BossPlatePanel")?.rectangle;
  if (panel === undefined) throw new Error("the boss plate is drawn");
  const plates = start.frames.filter(frame => frame.name.startsWith("FighterHUD") && frame.rectangle !== undefined);
  expect(plates.length).toBeGreaterThan(0);
  for (const plate of plates) if (plate.rectangle !== undefined) expect(disjoint(panel, plate.rectangle)).toBe(true);
  for (const left of [full - 37, 1]) {
    client.run(() => {
      const s = shellState();
      if (s === undefined) return;
      s.game.run.boss.health = left;
      const rollback = activeRollback(s);
      if (rollback !== undefined) rollback.speculative.game.run.boss.health = left;
    });
    clients.frames(2);
    const now = shown();
    expect(now.named("BossPlateHealth")?.text).toContain(`${left}|r`);
    expect(now.fill).toBeCloseTo(left / full, 3);
  }
  expect(client.errors).toEqual([]);
});
