import { expect, test } from "bun:test";
import { join } from "node:path";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { fighterSlug } from "../src/game/roster/kits";
import { AttackStyle, Character } from "../src/game/sim/codes";
import { hurtCapsule } from "../src/game/sim/geometry/contactGeometry";
import { fighterAt } from "../src/game/sim/roster";
import { authoredTuning } from "../src/game/sim/tuning";
import { type ShowcaseRow, showcaseRows } from "../src/game/session/showcaseTimeline";
import { showcaseFixtures } from "../src/platform/captureFixtures";

const vashj = Character.ladyVashj;
const upSmash = (row: ShowcaseRow): boolean => row.move.kind === "normal" && row.move.code === AttackStyle.upSmash;
const gaze = (row: ShowcaseRow): boolean => row.move.kind === "ultimate";

test("Lady Vashj's up smash hangs the dummy at its spear tip above her head and her gaze stands it inside the cone, not on her [k1 scenario]", () => {
  const body = hurtCapsule(vashj), top = Math.max(body.z1, body.z2) + body.radius;
  const range = authoredTuning(vashj).ultimate?.gaze?.range ?? 0;
  const rows = showcaseRows(vashj);
  for (const { move } of rows.filter(upSmash)) {
    expect(move.gap).toBeGreaterThan(body.radius * 2);
    expect(move.lift).toBeGreaterThan(top);
  }
  for (const { move } of rows.filter(gaze)) {
    expect(move.gap).toBeGreaterThan(range / 2);
    expect(move.gap).toBeLessThan(range);
    expect(move.lift).toBeUndefined();
  }
});

test("the dummy staged for Lady Vashj's up smash and gaze faces her, stays clear of her body and is struck or petrified in both facings in the headless sim [k2 property]", async () => {
  const platform = join(import.meta.dir, "../src/platform");
  const { shell } = await import(join(platform, "../host/loop/state.ts"));
  const { nativeDriverCommand } = await import(join(platform, "nativeDriver.ts"));
  const entry = await import(join(platform, "../host/entries/nativeDriverMain.ts"));
  const fixtures = showcaseFixtures(vashj);
  const body = hurtCapsule(vashj), top = Math.max(body.z1, body.z2) + body.radius;
  const staged = showcaseRows(vashj).filter(row => upSmash(row) || gaze(row));
  expect(staged.length).toBe(4);
  for (const row of staged) {
    const fixture = fixtures.find(({ name }) => name === `${fighterSlug(vashj)}-${row.row}`);
    expect(fixture).toBeDefined();
    const runtime = installHeadless(SMASHCRAFT_HEADLESS);
    try {
      const clients = runtime.clients(entry, [0]);
      const client = clients.client(0);
      clients.start();
      clients.frames(3);
      clients.everywhere(() => nativeDriverCommand(fixture?.script ?? ""));
      clients.frames(3);
      let caught = false, facesHer = true, clear = true;
      for (const target of fixture?.frames ?? []) {
        clients.everywhere(() => nativeDriverCommand(`resume ${target}`));
        for (let guard = 0, frame = 0; frame !== target && guard < (target + 30) * 4; guard++) {
          clients.frames(1);
          client.run(() => {
            frame = shell().runtime.simulationFrame;
            const mover = fighterAt(shell().world, 0), foe = fighterAt(shell().world, 1);
            if (!caught && foe.facing !== Math.sign(mover.motion.x - foe.motion.x)) facesHer = false;
            if (Math.abs(foe.motion.x - mover.motion.x) < body.radius * 4 && foe.motion.z < top) clear = false;
            if (foe.status.damage > 0.0 || foe.status.petrifyIn > 0 || foe.status.petrified) caught = true;
          });
        }
      }
      expect(`${row.row} ${row.move.slot} ${row.facing} caught ${caught} faces ${facesHer} clear ${clear}`).toBe(`${row.row} ${row.move.slot} ${row.facing} caught true faces true clear true`);
    } finally {
      runtime.restore();
    }
  }
}, 120_000);
