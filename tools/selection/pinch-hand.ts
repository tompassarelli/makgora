export interface Raster { readonly width: number; readonly height: number; readonly rgba: Uint8Array }
export interface Point { readonly x: number; readonly y: number }
export interface Swing { readonly degrees: number; readonly foreshorten: number }

// Pixel coordinates in tools/selection/art/wc3-hand-point.png (732x900), read off Tom's drawing: a cut-out around the index finger down to its knuckle, the knuckle and the fingertip.
const FINGER: readonly Point[] = [
  { x: 262, y: 276 }, { x: 268, y: 262 }, { x: 335, y: 172 }, { x: 390, y: 135 }, { x: 440, y: 62 }, { x: 488, y: -6 }, { x: 540, y: -24 },
  { x: 622, y: 0 }, { x: 630, y: 80 }, { x: 560, y: 158 }, { x: 466, y: 203 }, { x: 449, y: 232 }, { x: 420, y: 276 },
];
const KNUCKLE: Point = { x: 355, y: 284 };
const FINGERTIP: Point = { x: 546, y: 12 };
const OUTLINE: readonly [number, number, number, number] = [6, 8, 36, 255];
const OUTLINE_REACH = 3;
const KNUCKLE_RADIUS = 38;
const SLIVER_REACH = 9;
const SLIVER_SHARE = 0.55;
const SLIVER_DARK = 70;

const inside = (polygon: readonly Point[], x: number, y: number) => {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!;
    const b = polygon[j]!;
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
};

const cutFinger = ({ width, height, rgba }: Raster) => {
  const out = new Uint8Array(rgba);
  const finger = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (rgba[(y * width + x) * 4 + 3] === 0 || !inside(FINGER, x + 0.5, y + 0.5)) continue;
      finger[y * width + x] = 1;
      out[(y * width + x) * 4 + 3] = 0;
    }
  }
  return { out, finger };
};

const patchKnuckle = (raster: Raster, out: Uint8Array, finger: Uint8Array, painted: Uint8Array) => {
  const { width, rgba } = raster;
  for (let y = KNUCKLE.y - KNUCKLE_RADIUS; y <= KNUCKLE.y + KNUCKLE_RADIUS; y++) {
    for (let x = KNUCKLE.x - KNUCKLE_RADIUS; x <= KNUCKLE.x + KNUCKLE_RADIUS; x++) {
      if (Math.hypot(x + 0.5 - KNUCKLE.x, y + 0.5 - KNUCKLE.y) > KNUCKLE_RADIUS || (finger[y * width + x] === 0 && rgba[(y * width + x) * 4 + 3] !== 0)) continue;
      out.set(OUTLINE, (y * width + x) * 4);
      painted[y * width + x] = 1;
    }
  }
};

const paintSwung = ({ width, height, rgba }: Raster, { degrees, foreshorten }: Swing, out: Uint8Array, finger: Uint8Array, painted: Uint8Array) => {
  const reach = Math.hypot(FINGERTIP.x - KNUCKLE.x, FINGERTIP.y - KNUCKLE.y);
  const ux = (FINGERTIP.x - KNUCKLE.x) / reach;
  const uy = (FINGERTIP.y - KNUCKLE.y) / reach;
  const cos = Math.cos((degrees * Math.PI) / 180);
  const sin = Math.sin((degrees * Math.PI) / 180);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x + 0.5 - KNUCKLE.x;
      const dy = y + 0.5 - KNUCKLE.y;
      const rx = dx * cos - dy * sin;
      const ry = dx * sin + dy * cos;
      const along = (rx * ux + ry * uy) / foreshorten;
      const across = -rx * uy + ry * ux;
      const sx = Math.floor(KNUCKLE.x + along * ux - across * uy);
      const sy = Math.floor(KNUCKLE.y + along * uy + across * ux);
      if (sx < 0 || sy < 0 || sx >= width || sy >= height || finger[sy * width + sx] === 0 || (sx + 0.5 - KNUCKLE.x) * ux + (sy + 0.5 - KNUCKLE.y) * uy < 0) continue;
      out.set(rgba.subarray((sy * width + sx) * 4, (sy * width + sx) * 4 + 4), (y * width + x) * 4);
      painted[y * width + x] = 1;
    }
  }
};

const redrawOutline = ({ width, height, rgba }: Raster, out: Uint8Array, finger: Uint8Array, painted: Uint8Array) => {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (painted[y * width + x] === 1 || finger[y * width + x] === 0) continue;
      let beside = false;
      for (let dy = -OUTLINE_REACH; dy <= OUTLINE_REACH && !beside; dy++) {
        for (let dx = -OUTLINE_REACH; dx <= OUTLINE_REACH && !beside; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          beside = nx >= 0 && ny >= 0 && nx < width && ny < height && rgba[(ny * width + nx) * 4 + 3] !== 0 && finger[ny * width + nx] === 0 && painted[ny * width + nx] === 0;
        }
      }
      if (beside) out.set(OUTLINE, (y * width + x) * 4);
    }
  }
};

const trimSlivers = ({ width, height }: Raster, out: Uint8Array, painted: Uint8Array) => {
  const solid = (x: number, y: number) => out[(y * width + x) * 4 + 3] !== 0;
  const slivers: number[] = [];
  for (let y = SLIVER_REACH; y < height - SLIVER_REACH; y++) {
    for (let x = SLIVER_REACH; x < width - SLIVER_REACH; x++) {
      const i = (y * width + x) * 4;
      if (painted[y * width + x] === 0 || !solid(x, y) || Math.max(out[i]!, out[i + 1]!, out[i + 2]!) > SLIVER_DARK) continue;
      let filled = 0;
      for (let dy = -SLIVER_REACH; dy <= SLIVER_REACH; dy++) for (let dx = -SLIVER_REACH; dx <= SLIVER_REACH; dx++) if (solid(x + dx, y + dy)) filled++;
      if (filled < SLIVER_SHARE * (2 * SLIVER_REACH + 1) ** 2) slivers.push(i + 3);
    }
  }
  for (const i of slivers) out[i] = 0;
};

export const swingIndexFinger = (source: Raster, swing: Swing): Raster => {
  const { out, finger } = cutFinger(source);
  const painted = new Uint8Array(source.width * source.height);
  patchKnuckle(source, out, finger, painted);
  paintSwung(source, swing, out, finger, painted);
  redrawOutline(source, out, finger, painted);
  trimSlivers(source, out, painted);
  return { width: source.width, height: source.height, rgba: out };
};
