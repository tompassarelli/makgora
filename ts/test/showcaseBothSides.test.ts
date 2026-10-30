import { expect, test } from "bun:test";
import { join } from "node:path";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { SELECTABLE_CHARACTERS, fighterSlug } from "../src/game/roster/kits";
import { AttackStyle } from "../src/game/sim/codes";
import type { MoveRegion } from "../src/game/sim/heroMoves";
import { fighterAt } from "../src/game/sim/roster";
import { authoredTuning } from "../src/game/sim/tuning";
import { showcaseRows } from "../src/game/session/showcaseTimeline";
import { showcaseFixtures } from "../src/platform/captureFixtures";

const centreX = (region: MoveRegion): number => (region.hit.minX + region.hit.maxX) * 0.5;

const sharedOpening = SELECTABLE_CHARACTERS.flatMap(character => Object.entries(authoredTuning(character).moves?.normals ?? {}).flatMap(([style, move]) => {
  const ahead = move.regions.filter(region => centreX(region) > 0.0), behind = move.regions.filter(region => centreX(region) < 0.0);
  const together = ahead.length > 0 && behind.length > 0 && Math.min(...ahead.map(region => region.firstFrame)) === Math.min(...behind.map(region => region.firstFrame));
  return together && Math.max(...behind.map(region => region.lastFrame)) > Math.min(...behind.map(region => region.firstFrame)) ? [{ character, style: Number(style) }] : [];
}));

test("a ground move whose regions open together on both sides and stay active crosses its foe behind during the first hit's hitlag [k2 property]", () => {
  const downSmashes = sharedOpening.filter(({ style }) => style === AttackStyle.downSmash).map(({ character }) => fighterSlug(character));
  expect(downSmashes).toEqual(expect.arrayContaining(["warden", "illidan"]));
  for (const { character, style } of sharedOpening) {
    const rows = showcaseRows(character).filter(({ move }) => move.kind === "normal" && move.code === style);
    for (const { move } of rows) {
      if (move.cross === undefined) { expect(style === AttackStyle.downSmash && ["warden", "illidan"].includes(fighterSlug(character))).toBe(false); continue; }
      expect(`${fighterSlug(character)} ${move.slot} ${Math.sign(move.gap ?? 0)}`).toBe(`${fighterSlug(character)} ${move.slot} ${-Math.sign(move.cross.gap)}`);
      expect(move.behind).toBeUndefined();
      expect(move.swing?.[0]).toBeGreaterThan(move.cross.frame);
    }
  }
});

test("a crossed row strikes the foe from the front, then from behind, in the headless sim [k2 property]", async () => {
  const platform = join(import.meta.dir, "../src/platform");
  const { shell } = await import(join(platform, "../host/loop/state.ts"));
  const { nativeDriverCommand } = await import(join(platform, "nativeDriver.ts"));
  const entry = await import(join(platform, "../host/entries/nativeDriverMain.ts"));
  const crossed = sharedOpening.filter(({ style }) => style === AttackStyle.downSmash).slice(0, 2);
  expect(crossed.length).toBe(2);
  for (const { character } of crossed) {
    const row = showcaseRows(character).find(({ move, facing }) => move.kind === "normal" && move.code === AttackStyle.downSmash && facing === "right");
    const fixture = showcaseFixtures(character).find(({ name }) => name === `${fighterSlug(character)}-${row?.row}`);
    expect(fixture).toBeDefined();
    const runtime = installHeadless(SMASHCRAFT_HEADLESS);
    try {
      const clients = runtime.clients(entry, [0]);
      const client = clients.client(0);
      clients.start();
      clients.frames(3);
      clients.everywhere(() => nativeDriverCommand(fixture?.script ?? ""));
      clients.frames(3);
      const strikes: { readonly frame: number; readonly side: number }[] = [];
      let damage = 0;
      for (const target of fixture?.frames ?? []) {
        clients.everywhere(() => nativeDriverCommand(`resume ${target}`));
        for (let guard = 0, frame = 0; frame !== target && guard < (target + 30) * 4; guard++) {
          clients.frames(1);
          client.run(() => {
            frame = shell().runtime.simulationFrame;
            const foe = fighterAt(shell().world, 1);
            if (foe.status.damage > damage) strikes.push({ frame, side: Math.sign(foe.motion.x - fighterAt(shell().world, 0).motion.x) });
            damage = foe.status.damage;
          });
        }
      }
      expect(`${fighterSlug(character)} ${strikes.map(strike => strike.side).join(",")}`).toBe(`${fighterSlug(character)} 1,-1`);
    } finally {
      runtime.restore();
    }
  }
}, 60_000);

test("a released special with hit regions stands the foe inside its furthest strike, not at the default spacing [k1 scenario]", () => {
  const rows = showcaseRows(SELECTABLE_CHARACTERS.find(character => fighterSlug(character) === "peon") ?? SELECTABLE_CHARACTERS[0]!).filter(({ move }) => move.slot === "neutral_b" && move.release !== undefined);
  expect(rows.length).toBe(2);
  for (const { move } of rows) {
    expect(move.gap).toBeGreaterThan(0);
    expect(move.gap).toBeLessThan(200);
  }
});
