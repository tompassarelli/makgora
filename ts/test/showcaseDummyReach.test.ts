import { expect, test } from "bun:test";
import { join } from "node:path";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { fighterSlug } from "../src/game/roster/kits";
import { AttackStyle, Character } from "../src/game/sim/codes";
import { hurtCapsule } from "../src/game/sim/geometry/contactGeometry";
import { fighterAt } from "../src/game/sim/roster";
import { authoredTuning } from "../src/game/sim/tuning";
import { type ShowcaseRow, showcaseMoves, showcaseRows } from "../src/game/session/showcaseTimeline";
import { showcaseFixtures } from "../src/platform/captureFixtures";
import { DISJOINT_CUES, disjointNormals } from "../src/game/presentation/disjointCues";
import { createFighter } from "../src/game/sim/fighter";
import { VASHJ_TRAIL_MODEL } from "../src/game/sim/ultimates";

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

test("the dummy staged for Lady Vashj's up smash, gaze and back air faces her, stays clear of her body and is struck or petrified in both facings in the headless sim [k2 property]", async () => {
  const platform = join(import.meta.dir, "../src/platform");
  const { shell } = await import(join(platform, "../host/loop/state.ts"));
  const { nativeDriverCommand } = await import(join(platform, "nativeDriver.ts"));
  const entry = await import(join(platform, "../host/entries/nativeDriverMain.ts"));
  const fixtures = showcaseFixtures(vashj);
  const body = hurtCapsule(vashj), top = Math.max(body.z1, body.z2) + body.radius;
  const backAir = (row: ShowcaseRow): boolean => row.move.kind === "normal" && row.move.code === AttackStyle.backAir;
  const staged = showcaseRows(vashj).filter(row => upSmash(row) || gaze(row) || backAir(row));
  expect(staged.length).toBe(6);
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

test("the dummy staged for each of Lady Vashj's seven read moves stands in its reach, clear of her body [k2 property]", () => {
  const body = hurtCapsule(vashj), top = Math.max(body.z1, body.z2) + body.radius;
  const read = [AttackStyle.jab, AttackStyle.upTilt, AttackStyle.downSmash, AttackStyle.neutralAir, AttackStyle.backAir, AttackStyle.forwardSmash];
  const staged = showcaseMoves(vashj).filter(move => (move.kind === "normal" && read.includes(move.code)) || move.kind === "ultimate");
  expect(staged.length).toBe(read.length + 1);
  for (const move of staged) {
    const high = move.lift !== undefined && move.lift + 60 - top > body.radius;
    expect(`${move.slot} ${high || Math.abs(move.gap ?? 0) >= body.radius * 2}`).toBe(`${move.slot} true`);
  }
});

test("Lady Vashj's weapon trail is drawn on exactly jab, up tilt, down smash, neutral air, back air and forward smash, and the gaze draws it across its cone [k2 property]", () => {
  const drawn = disjointNormals(createFighter(vashj, 0.0, 1));
  expect([...drawn].sort((a, b) => a - b)).toEqual([AttackStyle.jab, AttackStyle.upTilt, AttackStyle.downSmash, AttackStyle.neutralAir, AttackStyle.backAir, AttackStyle.forwardSmash].sort((a, b) => a - b));
  expect(DISJOINT_CUES[vashj]?.model).toBe(VASHJ_TRAIL_MODEL);
  const gaze = authoredTuning(vashj).ultimate;
  const streaks = (gaze?.projectiles ?? []).filter(shot => shot.model === VASHJ_TRAIL_MODEL);
  expect(streaks.length).toBeGreaterThan(1);
  for (const shot of streaks) expect(shot.spawnFrame).toBeGreaterThanOrEqual(gaze?.gaze?.window.first ?? 0);
});

test("Lady Vashj's back air stages the dummy behind her, on the side its hit launches toward, clear of her body and the dummy's [k2 property]", () => {
  const body = hurtCapsule(vashj);
  const regions = authoredTuning(vashj).moves?.normals[AttackStyle.backAir]?.regions ?? [];
  expect(regions.every(region => region.hit.effect.launchX < 0.0)).toBe(true);
  const rows = showcaseRows(vashj).filter(row => row.move.kind === "normal" && row.move.code === AttackStyle.backAir);
  expect(rows.length).toBe(2);
  for (const { move, facing } of rows) expect(`${facing} behind ${(move.gap ?? 0) <= -body.radius * 3}`).toBe(`${facing} behind true`);
});
