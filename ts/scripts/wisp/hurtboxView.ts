





import { deflateSync } from "node:zlib";
import { ModelRenderer, type model as mdx } from "war3-model";
import { parseModelMDX } from "wisp/scripts/wisp/models";
import { DrawnModel } from "./drawnModel";
import { originalClip, originalClipNamed } from "../../src/generated/clips/fighterOriginalClipInfo";
import { advanceFighterPose, createFighterPose } from "../../src/game/presentation/fighterPose";
import { characterModelScale } from "../../src/game/presentation/modelScale";
import { type Capsule, attackCapsule, emptyCapsule, placeCapsule } from "../../src/game/sim/geometry/contactGeometry";
import { beginFighterAttack } from "../../src/game/sim/attacks";
import { AttackPhase, AttackStyle, Character, DownState, LedgeState } from "../../src/game/sim/codes";
import { attackPhase, fighterPoseFacing } from "../../src/game/sim/conditions";
import { type Fighter, createFighter } from "../../src/game/sim/fighter";
import { authoredHitRegion, authoredHitRegionCount, emptyHitRegion } from "../../src/game/sim/hitRegions";
import { HurtState, fighterHurtParts } from "../../src/game/sim/hurtboxes";
import { createRoster, neutralControls } from "../../src/game/sim/roster";
import { advanceFighter } from "../../src/game/sim/step";
import { beginAttack, beginDownState } from "../../src/game/sim/transitions";


export const FIGHTER_MODELS: Readonly<Record<number, string>> = {
  [Character.rifleman]: "animation-assets/RiflemanFighter.mdx",
  [Character.demonHunter]: "illidan-animation/DemonHunterFighter.mdx",
};

export const CHARACTER_NAMES: Readonly<Record<number, string>> = { [Character.rifleman]: "rifleman", [Character.demonHunter]: "illidan",
};

interface PlacedPart extends Capsule {
  readonly state: HurtState;
}


export interface PoseFrame {
  readonly frame: number;
  readonly phase: AttackPhase;
  readonly x: number;
  readonly z: number;
  readonly facing: number;
  readonly parts: readonly PlacedPart[];
  readonly strikes: readonly Capsule[];
  readonly clip: number | undefined;
  readonly seconds: number;
}

export function capture(f: Fighter, pose: ReturnType<typeof createFighterPose>): PoseFrame {
  const facing = fighterPoseFacing(f);
  const parts = fighterHurtParts(f).map((part) => ({
    ...placeCapsule(emptyCapsule(), part, f.motion.x, f.motion.z, facing), state: part.state ?? HurtState.normal,
  }));
  const strikes: Capsule[] = [];
  const style = f.attack.style;
  if (style !== undefined && style !== AttackStyle.shot) {
    const region = emptyHitRegion();
    for (let index = 0; index < authoredHitRegionCount(style, f.tuning.moves); index++) {
      authoredHitRegion(region, f.character, style, f.attack.frame, f.attack.smashChargeFrames, index, f.tuning.moves);
      if (region.window <= 0) continue;
      const strike = attackCapsule(emptyCapsule(), style, region);
      strikes.push(placeCapsule(strike, strike, f.motion.x, f.motion.z, f.facing));
    }
  }
  const clip = pose.clipIndex ?? originalClipNamed(f.character, pose.clipName);
  const info = clip === undefined ? undefined : originalClip(f.character, clip);
  let seconds = Math.max(0.0, pose.clipTime);
  if (info !== undefined) {
    const duration = info.endSeconds - info.startSeconds;
    seconds = duration <= 0.0 ? 0.0 : info.looping ? seconds % duration : Math.min(seconds, duration);
  }
  return { frame: f.attack.frame, phase: attackPhase(f), x: f.motion.x, z: f.motion.z, facing, parts, strikes, clip, seconds };
}


export function sampleState(character: Character, crouching: boolean, facing = 1): PoseFrame {
  const f = createFighter(character, 0.0, facing);
  const world = createRoster(1, [f]);
  const pose = createFighterPose();
  const input = { ...neutralControls(), direction: 0, down: crouching };
  for (let frame = 0; frame < 30; frame++) {
    advanceFighter(world, 0, 0, input, 0.0);
    advanceFighterPose(pose, f, world, input, false, false, false, false);
  }
  return capture(f, pose);
}


export function sampleAttack(character: Character, style: AttackStyle, facing = 1, aerial = false): PoseFrame[] {
  const f = createFighter(character, 0.0, facing);
  const world = createRoster(1, [f]);
  if (aerial) {
    f.motion.grounded = false;
    f.motion.z = 900.0;
  }
  const pose = createFighterPose();
  const input = neutralControls();

  if (style === AttackStyle.getupAttack) beginDownState(f, DownState.attack, 0);
  else beginFighterAttack(world, 0, style, false);

  if (style === AttackStyle.ledgeAttack) {
    beginAttack(f, style, false);
    f.ledge.state = LedgeState.attack;
    f.ledge.side = -facing;
  }
  advanceFighterPose(pose, f, world, input, false, false, true, false);
  const frames = [capture(f, pose)];
  while (f.attack.style === style && frames.length < 120) {
    advanceFighter(world, 0, 0, input, 0.0);
    advanceFighterPose(pose, f, world, input, false, false, false, false);
    if (f.attack.style !== style) break;
    frames.push(capture(f, pose));
  }
  return frames;
}




export async function loadDrawnModel(assets: string, character: Character): Promise<DrawnModel> {
  const path = `${assets}/${FIGHTER_MODELS[character]}`;
  return new DrawnModel(await Bun.file(path).arrayBuffer(), characterModelScale(character));
}


const LEFT = -230;
const RIGHT = 230;
const BOTTOM = -140;
const TOP = 210;
export const PANEL_WIDTH = RIGHT - LEFT;
export const PANEL_HEIGHT = TOP - BOTTOM;

type Rgb = readonly [number, number, number];
const BACKGROUND: Rgb = [250, 250, 250];
const SILHOUETTE: Rgb = [120, 120, 130];
const PHASE: Readonly<Record<number, Rgb>> = {
  [AttackPhase.none]: [200, 200, 200], [AttackPhase.startup]: [240, 180, 40], [AttackPhase.active]: [220, 40, 40], [AttackPhase.recovery]: [60, 110, 220],
};
const STATE: Readonly<Record<number, Rgb>> = {
  [HurtState.normal]: [240, 200, 0], [HurtState.invincible]: [30, 120, 255], [HurtState.intangible]: [20, 190, 80],
};
const STRIKE: Rgb = [230, 20, 20];

function segmentDistance(px: number, pz: number, c: Readonly<Capsule>): number {
  const dx = c.x2 - c.x1;
  const dz = c.z2 - c.z1;
  const length = dx * dx + dz * dz;
  const t = length <= 1e-9 ? 0 : Math.max(0, Math.min(1, ((px - c.x1) * dx + (pz - c.z1) * dz) / length));
  return Math.hypot(px - (c.x1 + t * dx), pz - (c.z1 + t * dz));
}


export interface Coverage {
  readonly covered: number;
  readonly filled: number;
}


export function drawPanel(rgb: Uint8Array, frame: PoseFrame, triangles: Float32Array): Coverage {
  const body = new Uint8Array(PANEL_WIDTH * PANEL_HEIGHT);
  for (let t = 0; t + 5 < triangles.length; t += 6) {
    const ax = (triangles[t] ?? 0) - LEFT, az = TOP - (triangles[t + 1] ?? 0);
    const bx = (triangles[t + 2] ?? 0) - LEFT, bz = TOP - (triangles[t + 3] ?? 0);
    const cx = (triangles[t + 4] ?? 0) - LEFT, cz = TOP - (triangles[t + 5] ?? 0);
    const area = (bx - ax) * (cz - az) - (bz - az) * (cx - ax);
    if (Math.abs(area) < 1e-6) continue;
    for (let row = Math.max(0, Math.floor(Math.min(az, bz, cz))); row <= Math.min(PANEL_HEIGHT - 1, Math.ceil(Math.max(az, bz, cz))); row++) {
      for (let column = Math.max(0, Math.floor(Math.min(ax, bx, cx))); column <= Math.min(PANEL_WIDTH - 1, Math.ceil(Math.max(ax, bx, cx))); column++) {
        const px = column + 0.5, pz = row + 0.5;
        const w0 = ((bx - px) * (cz - pz) - (bz - pz) * (cx - px)) / area;
        const w1 = ((cx - px) * (az - pz) - (cz - pz) * (ax - px)) / area;
        if (w0 >= 0 && w1 >= 0 && w0 + w1 <= 1) body[row * PANEL_WIDTH + column] = 1;
      }
    }
  }
  let bodyPixels = 0, coveredPixels = 0, volumePixels = 0, filledPixels = 0;
  for (let row = 0; row < PANEL_HEIGHT; row++) {
    for (let column = 0; column < PANEL_WIDTH; column++) {
      const index = row * PANEL_WIDTH + column;
      const wx = column + 0.5 + LEFT, wz = TOP - (row + 0.5);
      const local = { x: wx, z: wz };
      let color: Rgb = body[index] === 1 ? SILHOUETTE : BACKGROUND;
      let inVolume = false;
      for (const part of frame.parts) {
        const placed = { ...part, x1: part.x1 - frame.x, x2: part.x2 - frame.x, z1: part.z1 - frame.z, z2: part.z2 - frame.z };
        const distance = segmentDistance(local.x, local.z, placed);
        if (distance <= part.radius) {
          inVolume = true;
          const tint = STATE[part.state] ?? STATE[HurtState.normal] ?? BACKGROUND;
          color = distance >= part.radius - 1.5 ? tint : [(color[0] * 2 + tint[0]) / 3, (color[1] * 2 + tint[1]) / 3, (color[2] * 2 + tint[2]) / 3];
        }
      }
      for (const strike of frame.strikes) {
        const placed = { ...strike, x1: strike.x1 - frame.x, x2: strike.x2 - frame.x, z1: strike.z1 - frame.z, z2: strike.z2 - frame.z };
        const distance = segmentDistance(local.x, local.z, placed);
        if (distance <= strike.radius && distance >= strike.radius - 2.0) color = STRIKE;
      }
      if ((Math.abs(wx) < 0.5 && Math.abs(wz) < 6) || (Math.abs(wz) < 0.5 && Math.abs(wx) < 6)) color = [0, 0, 0];
      if (row < 6) color = PHASE[frame.phase] ?? BACKGROUND;
      if (body[index] === 1) {
        bodyPixels++;
        if (inVolume) coveredPixels++;
      }
      if (inVolume) {
        volumePixels++;
        if (body[index] === 1) filledPixels++;
      }
      rgb[index * 3] = Math.round(color[0]);
      rgb[index * 3 + 1] = Math.round(color[1]);
      rgb[index * 3 + 2] = Math.round(color[2]);
    }
  }
  return { covered: bodyPixels === 0 ? 0 : coveredPixels / bodyPixels, filled: volumePixels === 0 ? 0 : filledPixels / volumePixels };
}


export function tile(panels: readonly Uint8Array[], columns: number): { width: number; height: number; rgb: Uint8Array } {
  const gutter = 2;
  const rows = Math.ceil(panels.length / columns);
  const width = Math.min(columns, panels.length) * (PANEL_WIDTH + gutter);
  const height = rows * (PANEL_HEIGHT + gutter);
  const rgb = new Uint8Array(width * height * 3);
  panels.forEach((panel, index) => {
    const left = (index % columns) * (PANEL_WIDTH + gutter);
    const top = Math.floor(index / columns) * (PANEL_HEIGHT + gutter);
    for (let row = 0; row < PANEL_HEIGHT; row++) {
      rgb.set(panel.subarray(row * PANEL_WIDTH * 3, (row + 1) * PANEL_WIDTH * 3), ((top + row) * width + left) * 3);
    }
  });
  return { width, height, rgb };
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of bytes) c = (CRC_TABLE[(c ^ byte) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(new TextEncoder().encode(type), 4);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}


export function encodePng(width: number, height: number, rgb: Uint8Array): Uint8Array {
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  header.set([8, 2, 0, 0, 0], 8);
  const raw = new Uint8Array(height * (width * 3 + 1));
  for (let row = 0; row < height; row++) raw.set(rgb.subarray(row * width * 3, (row + 1) * width * 3), row * (width * 3 + 1) + 1);
  const parts = [Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", deflateSync(raw)), chunk("IEND", new Uint8Array(0))];
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}


export interface SheetResult {
  readonly name: string;
  readonly png: Uint8Array;
  readonly lines: readonly string[];
}

const PHASE_NAMES: Readonly<Record<number, string>> = { 0: "idle", 1: "startup", 2: "active", 3: "recovery" };
const percent = (value: number) => `${Math.round(value * 100)}%`;


export function sheet(name: string, model: DrawnModel, frames: readonly PoseFrame[], columns = 6): SheetResult {
  const panels: Uint8Array[] = [];
  const lines: string[] = [];
  for (const frame of frames) {
    const rgb = new Uint8Array(PANEL_WIDTH * PANEL_HEIGHT * 3);
    const start = frame.clip === undefined ? undefined : model.sequenceStart(frame.clip);
    const triangles = start === undefined || frame.clip === undefined ? new Float32Array(0) : model.triangles(frame.clip, frame.seconds, frame.facing);
    const { covered, filled } = drawPanel(rgb, frame, triangles);
    panels.push(rgb);
    lines.push(`${name} f${frame.frame} ${PHASE_NAMES[frame.phase] ?? frame.phase} facing ${frame.facing}: ${frame.parts.length} parts, body covered ${percent(covered)}, volumes filled ${percent(filled)}`);
  }
  const { width, height, rgb } = tile(panels, columns);
  return { name, png: encodePng(width, height, rgb), lines };
}


export const STYLE_NAMES: Readonly<Record<number, string>> = {
  [AttackStyle.jab]: "jab", [AttackStyle.downTilt]: "down-tilt", [AttackStyle.forwardSmash]: "forward-smash",
  [AttackStyle.forwardAir]: "forward-air", [AttackStyle.downAir]: "down-air",
};
