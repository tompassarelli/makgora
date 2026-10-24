










import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { f32 } from "wisp/src/sim/f32";
import { PARTICIPANT_SLOTS, type Slots } from "../src/game/input/participants";
import { MATCH_TICKS_PER_SECOND } from "../src/game/lobby/lobbyState";
import { MATCH_CAMERA_ASPECT, outsideCamera } from "../src/game/sim/matchCamera";
import { fighterAt, isActive, type Roster } from "../src/game/sim/roster";
import { stageBounds } from "../src/game/sim/stageBounds";
import { type ComputerMatch, playComputerMatch } from "./computerMatch";


type CameraScenario = Pick<ComputerMatch, "fighters" | "stage" | "shift">;

export const CAMERA_SCENARIOS: readonly CameraScenario[] = [
  { fighters: ["illidan", "blademaster"], stage: 0, shift: 0.0 },
  { fighters: ["rifleman", "mountain-king"], stage: 0, shift: -60.0 },
  { fighters: ["illidan", "forsaken-paladin"], stage: 1, shift: 0.0 },
  { fighters: ["warden", "lich"], stage: 1, shift: 60.0 },
  { fighters: ["dreadlord", "shadow-hunter"], stage: 2, shift: 0.0 },
  { fighters: ["blademaster", "illidan"], stage: 2, shift: -60.0 },
];

export const FOUR_PLAYER_CAMERA_SCENARIOS: readonly CameraScenario[] = [
  { fighters: ["illidan", "blademaster", "rifleman", "mountain-king"], stage: 0, shift: 0.0 },
  { fighters: ["warden", "lich", "forsaken-paladin", "shadow-hunter"], stage: 1, shift: 0.0 },
  { fighters: ["dreadlord", "illidan", "blademaster", "warden"], stage: 2, shift: 0.0 },
];

const REVERSAL_FLOOR = 0.0005;
const radians = (degrees: number) => (degrees * Math.PI) / 180.0;


interface View { readonly x: number; readonly z: number; readonly distance: number; readonly width: number; readonly height: number }

const box = () => ({ left: -1.0, right: 1.0, top: 1.0, bottom: -1.0 });








class MeleeCamera {
  private readonly ext: Slots<{ left: number; right: number; top: number; bottom: number }> = [box(), box(), box(), box()];
  private interest = { x: 0.0, y: 0.0 };
  private eye = { x: 0.0, y: 0.0, z: 0.0 };
  private fov = 30.0;
  private started = false;

  step(world: Readonly<Roster>, stage: number): View | undefined {
    const camera = stageBounds(stage).camera;
    const bounds = { left: camera.left / 6, right: camera.right / 6, bottom: camera.bottom / 6, top: camera.top / 6 };
    const live = PARTICIPANT_SLOTS.filter((slot) => isActive(world, slot) && !fighterAt(world, slot).status.out);
    if (live.length === 0) return undefined;
    const multiplier = (live.length === 1 ? 1.5 : live.length === 2 ? 1.32 : live.length === 3 ? 1.16 : 1.0) * 1.5;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const clampX = (x: number) => Math.min(bounds.right, Math.max(bounds.left, x));
    const clampY = (y: number) => Math.min(bounds.top, Math.max(bounds.bottom, y));
    for (const slot of live) {
      const fighter = fighterAt(world, slot);
      const ext = this.ext[slot];
      const target = fighter.facing > 0 ? { left: -9.0, right: 22.0 * 1.5 } : { left: -22.0 * 1.5, right: 9.0 };
      const ease = (current: number, goal: number) => (goal - current > 0.5 ? current + 0.5 : goal - current < -0.5 ? current - 0.5 : goal);
      ext.left = this.started ? ease(ext.left, target.left) : target.left;
      ext.right = this.started ? ease(ext.right, target.right) : target.right;
      ext.top = this.started ? ease(ext.top, 16.0) : 16.0;
      ext.bottom = this.started ? ease(ext.bottom, -9.0) : -9.0;
      const x = clampX(fighter.motion.x / 6);
      const y = clampY(fighter.motion.z / 6 + 10.0);
      minX = Math.min(minX, clampX(x + ext.left * multiplier));
      maxX = Math.max(maxX, clampX(x + ext.right * multiplier));
      minY = Math.min(minY, clampY(y + ext.bottom * multiplier));
      maxY = Math.max(maxY, clampY(y + ext.top * multiplier));
    }
    const depth = Math.abs(this.eye.z);
    minY -= 390.0 * Math.min(1.0, Math.max(0.0, (depth - 80.0) / 4920.0)) + 10.0;
    this.fov = this.started ? this.fov + (38.0 - this.fov) * 0.1 : 30.0;
    const spread = Math.max(maxX - minX, maxY - minY);
    const bias = spread > 120.0 ? 0.0682 : spread < 60.0 ? 0.0 : (0.0682 * (spread - 60.0)) / 60.0;
    const base = (minY - 12.0 + (maxY - 12.0)) * (0.5 - bias) + 12.0;
    const tilt = radians(Math.min(5.0, Math.max(-7.0, -(base - 30.0) * 0.05)) - 10.0);
    const half = radians(this.fov) * 0.5;
    const up = Math.tan(half + tilt);
    const down = Math.tan(half - tilt);
    const distanceY = (maxY - minY) / (up + down);
    const offsetY = distanceY * Math.tan(tilt);
    const pan = radians(Math.min(17.5, Math.max(-17.5, -((minX + maxX) * 0.5) * 0.05)));
    const right = 1.2173333 * Math.tan(half - pan);
    const left = 1.2173333 * Math.tan(half + pan);
    const distanceX = (maxX - minX) / (right + left);
    const offsetX = 1.2173333 * distanceX * Math.tan(pan);
    const target = { x: maxX - distanceX * right - offsetX, y: offsetY + (maxY - distanceY * up), z: Math.min(1000.0, Math.max(83.0, Math.max(distanceX, distanceY))) };

    const halfHeight = target.z * Math.tan(radians(38.0) * 0.5);
    const halfWidth = halfHeight * 1.2173333;
    const shift = (low: number, high: number, min: number, max: number) => {
      const under = Math.max(0.0, min - low);
      const over = Math.min(0.0, max - high);
      return under > 0.0 && over < 0.0 ? 0.5 * (under + over) : under > 0.0 ? under : over;
    };
    target.x += shift(target.x - halfWidth, target.x + halfWidth, bounds.left, bounds.right);
    target.y += shift(target.y - halfHeight, target.y + halfHeight, bounds.bottom, bounds.top);
    const follow = Math.min(1.0, Math.max(0.0001, (spread > 900.0 ? 0.1 : spread < 120.0 ? 0.05 : 0.05 + (0.05 * (spread - 120.0)) / 780.0) * 1.8));
    if (this.started) {
      this.interest = { x: this.interest.x + (target.x - this.interest.x) * follow, y: this.interest.y + (target.y - this.interest.y) * follow };
      this.eye = { x: this.eye.x + (target.x + offsetX - this.eye.x) * 0.27, y: this.eye.y + (target.y - offsetY - this.eye.y) * 0.27, z: this.eye.z + (target.z - this.eye.z) * 0.27 };
    } else {
      this.interest = { x: target.x, y: target.y };
      this.eye = { x: target.x + offsetX, y: target.y - offsetY, z: target.z };
    }
    this.started = true;
    const height = 2.0 * this.eye.z * Math.tan(radians(this.fov) * 0.5);
    return { x: this.interest.x, z: this.interest.y, distance: this.eye.z, width: height * 1.2173333, height };
  }
}

interface Samples { pan: number[]; zoom: number[]; jerk: number[]; reversals: [number, number, number]; frames: number; offscreen: number }
const samples = (): Samples => ({ pan: [], zoom: [], jerk: [], reversals: [0, 0, 0], frames: 0, offscreen: 0 });


function observe(into: Samples, before: View, now: View, last: [number, number, number], velocity: [number, number, number]): void {
  const deltas = [(now.x - before.x) / now.width, (now.z - before.z) / now.height, (now.distance - before.distance) / before.distance] as const;
  if (into.frames > 0) into.jerk.push(Math.hypot(deltas[0] - velocity[0], deltas[1] - velocity[1], deltas[2] - velocity[2]));
  velocity[0] = deltas[0];
  velocity[1] = deltas[1];
  velocity[2] = deltas[2];
  into.pan.push(Math.hypot(deltas[0], deltas[1]));
  into.zoom.push(Math.abs(deltas[2]));
  for (const axis of [0, 1, 2] as const) {
    const delta = deltas[axis];
    if (Math.abs(delta) <= REVERSAL_FLOOR) continue;
    if (Math.abs(last[axis]) > REVERSAL_FLOOR && Math.sign(delta) !== Math.sign(last[axis])) into.reversals[axis]++;
    last[axis] = delta;
  }
  into.frames++;
}

function playScenario(scenario: CameraScenario, ours: Samples, melee: Samples): void {
  const reference = new MeleeCamera();
  let previous: { ours: View; melee: View } | undefined;
  const lastOurs: [number, number, number] = [0, 0, 0];
  const lastMelee: [number, number, number] = [0, 0, 0];
  const velocityOurs: [number, number, number] = [0, 0, 0];
  const velocityMelee: [number, number, number] = [0, 0, 0];
  playComputerMatch({ ...scenario, stocks: 2, minutes: 1, frameLimit: 65 * MATCH_TICKS_PER_SECOND }, ({ camera }, world) => {
    const meleeView = reference.step(world, scenario.stage);
    if (!camera.initialized || meleeView === undefined) return;
    const height = 2.0 * camera.distance * camera.tangent;
    const oursView = { x: camera.x, z: camera.z, distance: camera.distance, width: height * MATCH_CAMERA_ASPECT, height };
    if (previous !== undefined) {
      observe(ours, previous.ours, oursView, lastOurs, velocityOurs);
      if (PARTICIPANT_SLOTS.some((slot) => isActive(world, slot) && !fighterAt(world, slot).status.out && outsideCamera(camera, fighterAt(world, slot).motion.x, f32(fighterAt(world, slot).motion.z + 60.0)))) ours.offscreen++;
      observe(melee, previous.melee, meleeView, lastMelee, velocityMelee);
    }
    previous = { ours: oursView, melee: meleeView };
  });
}

const quantile = (sorted: readonly number[], q: number): number => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0;

function summarize(from: Samples) {
  const pan = [...from.pan].sort((x, y) => x - y);
  const zoom = [...from.zoom].sort((x, y) => x - y);
  const jerk = [...from.jerk].sort((x, y) => x - y);
  const perSecond = (n: number) => (n * MATCH_TICKS_PER_SECOND) / from.frames;
  return {
    frames: from.frames,
    pan: [quantile(pan, 0.5), quantile(pan, 0.95), quantile(pan, 0.99), pan.at(-1) ?? 0],
    zoom: [quantile(zoom, 0.5), quantile(zoom, 0.95), quantile(zoom, 0.99), zoom.at(-1) ?? 0],
    jerk: [quantile(jerk, 0.5), quantile(jerk, 0.95), quantile(jerk, 0.99), jerk.at(-1) ?? 0],
    snaps: from.pan.filter((value) => value > 0.03).length + from.zoom.filter((value) => value > 0.06).length,
    offscreen: from.offscreen,
    panTravel: perSecond(from.pan.reduce((sum, value) => sum + value, 0)),
    zoomTravel: perSecond(from.zoom.reduce((sum, value) => sum + value, 0)),
    reversals: from.reversals.map(perSecond),
  };
}


export function measureCameraFeel(scenarios: readonly CameraScenario[] = CAMERA_SCENARIOS) {
  const ours = samples();
  const melee = samples();
  for (const scenario of scenarios) playScenario(scenario, ours, melee);
  return { ours: summarize(ours), melee: summarize(melee) };
}

if (import.meta.main) {
  const { values } = parseArgs({ options: { json: { type: "string" }, players: { type: "string" } } });
  const scenarios = values.players === "4" ? FOUR_PLAYER_CAMERA_SCENARIOS : CAMERA_SCENARIOS;
  const result = measureCameraFeel(scenarios);
  const percent = (values: readonly number[]) => values.map((value) => `${(value * 100).toFixed(2)}%`).join(" / ");
  console.log(`${result.ours.frames} frames over ${scenarios.length} computer matches`);
  for (const [name, view] of [["ours ", result.ours], ["melee", result.melee]] as const) {
    console.log(`${name} pan/frame p50/p95/p99/max ${percent(view.pan)}; zoom/frame ${percent(view.zoom)}`);
    console.log(`${name} velocity change/frame p50/p95/p99/max ${percent(view.jerk)}; snap frames (pan > 3% or zoom > 6%) ${view.snaps}`);
    console.log(`${name} travel/s pan ${(view.panTravel * 100).toFixed(1)}% zoom ${(view.zoomTravel * 100).toFixed(1)}%; offscreen frames ${view.offscreen}; reversals/s x/z/zoom ${view.reversals.map((n) => n.toFixed(2)).join(" / ")}`);
  }
  if (values.json !== undefined) writeFileSync(values.json, JSON.stringify(result, null, 2));
}
