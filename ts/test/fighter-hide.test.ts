import { afterAll, beforeAll, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { MapEntry } from "wisp/src/headless/client";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { fixtureOf } from "../scripts/nativeCapture";
import type { CaptureFixture } from "../src/platform/captureFixtures";
import { DISJOINT_CUES } from "../src/game/presentation/disjointCues";
import { Character } from "../src/game/sim/codes";
import { fighterAt } from "../src/game/sim/roster";

const platform = join(import.meta.dir, "../src/platform");
const PAD = join(import.meta.dir, "native/captures/wisp125-warden-nair.pad");
const HELD = 124;
const NEAR = 160;
const FEET = 20;

let headless: ReturnType<typeof installHeadless>;
beforeAll(() => { headless = installHeadless(SMASHCRAFT_HEADLESS); });
afterAll(() => headless.restore());

test("-dev hide fighter 0 hides Warden's body and nair knives on a held native frame, leaves b and the stage drawn, and show restores every pose [k1 scenario]", async () => {
  const { shell } = await import(join(platform, "../host/loop/state.ts"));
  const { nativeDriverCommand }: { nativeDriverCommand(text: string): void } = await import(join(platform, "nativeDriver.ts"));
  const { applyDeveloperCommand }: { applyDeveloperCommand(s: unknown, actor: number, message: string): void } = await import(join(platform, "../host/loop/keys.ts"));
  const entry: MapEntry = await import(join(platform, "../host/entries/nativeDriverMain.ts"));
  const fixture = fixtureOf(PAD, readFileSync(PAD, "utf8"));
  expect(fixture.silhouette).toEqual({ slot: 0, fighter: "warden", move: "neutral-air", width: 1920, height: 1080 });
  expect(fixture.frames).toContain(HELD);

  const clients = headless.clients(entry, [0]);
  const client = clients.client(0);
  clients.start();
  clients.frames(3);
  clients.everywhere(() => nativeDriverCommand(fixture.script));
  clients.frames(3);
  clients.everywhere(() => nativeDriverCommand(`resume ${HELD}`));
  const read = <T>(get: () => T): T => {
    let value: T | undefined;
    client.run(() => { value = get(); });
    return value as T;
  };
  const frame = () => read(() => shell().runtime.simulationFrame);
  for (let guard = 0; guard < 600 && frame() !== HELD; guard++) clients.frames(1);
  clients.frames(30);
  expect(frame()).toBe(HELD);

  const units = () => {
    const bodies = read(() => [0, 1].map(slot => { const unit = shell().participants[slot].body?.unit; return unit === undefined ? -1 : GetHandleId(unit); }));
    return client.unitPoses().filter(pose => bodies.includes(pose.handle.id)).map(({ handle, x, y, z, scale, alpha, color, visible }) => ({ slot: bodies.indexOf(handle.id), x, y, z, scale, alpha, color, visible }))
      .sort((left, right) => left.slot - right.slot);
  };
  const effects = () => client.effectPoses().map(({ handle, model, x, y, z, scale, alpha, color, yaw }) => ({ handle, model, x, y, z, scale, alpha, color, yaw }));
  const visible = () => {
    const shown = new Set(client.effectPoses({ visibleOnly: true }).map(pose => pose.handle));
    return effects().filter(pose => shown.has(pose.handle));
  };
  const at = read(() => [0, 1].map(slot => {
    const { motion } = fighterAt(shell().world, slot);
    return { x: shell().origin.x + motion.x, z: shell().origin.z + motion.z };
  }));
  const a = at[0] ?? { x: 0, z: 0 };
  const b = at[1] ?? { x: 0, z: 0 };
  expect(Math.abs(a.x - b.x)).toBeGreaterThan(NEAR * 2);
  const nearA = (pose: { x: number; z: number }) => Math.abs(pose.x - a.x) < NEAR && pose.z > a.z - FEET && pose.z < a.z + NEAR * 2;
  const knife = DISJOINT_CUES[Character.warden]?.model ?? "";

  const before = { units: units(), effects: effects(), visible: visible() };
  expect(before.units.map(unit => unit.visible)).toEqual([true, true]);
  expect(before.visible.filter(pose => pose.model === knife).length).toBeGreaterThan(0);
  expect(before.visible.filter(nearA).length).toBeGreaterThan(0);

  client.run(() => applyDeveloperCommand(shell(), 0, "-dev hide fighter 0"));
  clients.frames(5);
  expect(frame()).toBe(HELD);
  const hidden = { units: units(), visible: visible() };
  expect(hidden.units.find(unit => unit.slot === 0)?.visible).toBe(false);
  expect(hidden.units.find(unit => unit.slot === 1)).toEqual(before.units.find(unit => unit.slot === 1));
  expect(hidden.visible.filter(pose => pose.model === knife)).toEqual([]);
  expect(hidden.visible.filter(nearA)).toEqual([]);
  expect(hidden.visible).toEqual(before.visible.filter(pose => hidden.visible.some(shown => shown.handle === pose.handle)));
  expect(hidden.visible).toEqual(before.visible.filter(pose => !nearA(pose) && pose.model !== knife));
  expect(client.messages.join("\n")).toContain("dev: fighter 0 hidden");

  client.run(() => applyDeveloperCommand(shell(), 0, "-dev show fighter 0"));
  clients.frames(5);
  expect(frame()).toBe(HELD);
  expect(units()).toEqual(before.units);
  expect(effects()).toEqual(before.effects);
  expect(client.messages.join("\n")).toContain("dev: fighter 0 shown");
  expect(client.errors).toEqual([]);
});

test("a silhouette capture keeps Warden's team glow and nair knives off in the shown and hidden grabs and stamps the hidden grab the tick after hide [k1 scenario]", async () => {
  const { shell } = await import(join(platform, "../host/loop/state.ts"));
  const { captureTick }: { captureTick(fixtures: readonly CaptureFixture[]): void } = await import(join(platform, "../host/entries/nativeCaptureMain.ts"));
  const entry: MapEntry = await import(join(platform, "../host/entries/nativeDriverMain.ts"));
  const fixture: CaptureFixture = { ...fixtureOf(PAD, readFileSync(PAD, "utf8")), frames: [HELD], holdTicks: 6, openingTicks: 1, tailFrames: 1 };
  const clients = headless.clients(entry, [0]);
  const client = clients.client(0);
  const glowOff = new Set<unknown>();
  client.natives.BlzShowUnitTeamGlow = (unit: unknown, show: boolean) => { if (show) glowOff.delete(unit); else glowOff.add(unit); };
  clients.start();
  clients.frames(3);
  const knife = DISJOINT_CUES[Character.warden]?.model ?? "";
  type Runner = { stage: string; hidden: boolean; hideTick?: number; stampTick?: number };
  const grabs: { hidden: boolean; body: boolean; glow: boolean; knives: number }[] = [];
  let runner: Runner | undefined;
  for (let guard = 0; guard < 2000 && runner?.stage !== "tail"; guard++) {
    let unit: unknown;
    let id = -1;
    let held = false;
    client.run(() => {
      captureTick([fixture]);
      runner = (globalThis as { __smashcraftCaptureRunner?: Runner }).__smashcraftCaptureRunner;
      unit = shell().participants[0].body?.unit;
      id = unit === undefined ? -1 : GetHandleId(unit as unit);
      held = runner?.stage === "target" && shell().runtime.simulationFrame === HELD;
    });
    if (held && runner !== undefined) {
      grabs.push({
        hidden: runner.hidden,
        body: client.unitPoses().find(pose => pose.handle.id === id)?.visible ?? false,
        glow: !glowOff.has(unit),
        knives: client.effectPoses({ visibleOnly: true }).filter(pose => pose.model === knife).length,
      });
    }
    clients.frames(1);
  }
  expect(runner?.stage).toBe("tail");
  expect(grabs.filter(grab => !grab.hidden).length).toBeGreaterThan(0);
  expect(grabs.filter(grab => grab.hidden).length).toBeGreaterThan(0);
  expect(grabs.map(grab => grab.body)).toEqual(grabs.map(grab => !grab.hidden));
  expect(grabs.filter(grab => grab.glow || grab.knives > 0)).toEqual([]);
  expect(runner?.stampTick).toBe((runner?.hideTick ?? 0) + 1);
  expect(client.errors).toEqual([]);
});
