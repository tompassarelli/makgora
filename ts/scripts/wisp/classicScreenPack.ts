import { dirname, join } from "node:path";
import type { PixelBox } from "./classicEffectScreen";

export interface PackRun {
  readonly path: string;
  readonly map: string;
  readonly captures: readonly { readonly fixture: string; readonly frame: number; readonly phase: string; readonly file: string }[];
  readonly screen?: readonly string[] | undefined;
}
export interface PackManifest { readonly path: string; readonly map: string; readonly fixtures: readonly { readonly name: string; readonly frames: readonly number[] }[] }
export interface PackRequest {
  readonly move: string;
  readonly role: "positive" | "negative" | "candidate";
  readonly version: string;
  readonly source: string;
  readonly fixture: string;
  readonly excluded: readonly PixelBox[];
  readonly crop: PixelBox;
  readonly regionMargin: number;
  readonly bodyMargin: number;
  readonly defender?: PixelBox | undefined;
}
export interface PackReference { readonly receipt: string; readonly fixture: string; readonly phase: "shown" | "hidden"; readonly file: string }
export interface PackFrame { readonly frame: number; readonly shown: PackReference; readonly off: PackReference; readonly repeatedOff: PackReference; readonly region: PixelBox; readonly body: PixelBox; readonly excluded: readonly PixelBox[] }
export interface PackSample {
  readonly move: string;
  readonly role: PackRequest["role"];
  readonly engine: "native-classic";
  readonly camera: "normal-match";
  readonly stage: "sky-deck";
  readonly source: string;
  readonly version: string;
  readonly manifest: string;
  readonly map: string;
  readonly mapSha256: string;
  readonly first: number;
  readonly last: number;
  readonly crop: PixelBox;
  readonly frames: readonly PackFrame[];
}

export interface ScreenBoxes { readonly width: number; readonly height: number; readonly region: PixelBox; readonly body: PixelBox }

export function croppedBox(box: PixelBox, crop: PixelBox): PixelBox {
  const x = Math.max(0, box.x - crop.x), y = Math.max(0, box.y - crop.y);
  return { x, y, width: Math.max(0, Math.min(crop.width, box.x + box.width - crop.x) - x), height: Math.max(0, Math.min(crop.height, box.y + box.height - crop.y) - y) };
}

export function grownBox(box: PixelBox, margin: number, width: number, height: number): PixelBox {
  const x = Math.max(0, box.x - margin), y = Math.max(0, box.y - margin);
  return { x, y, width: Math.min(width, box.x + box.width + margin) - x, height: Math.min(height, box.y + box.height + margin) - y };
}

// The capture map's receipt line: `SCREEN FIXTURE FRAME WIDTH HEIGHT RX RY RW RH BX BY BW BH`, a dash for a box it could not project.
export function screenBoxes(lines: readonly string[], fixture: string, frame: number): ScreenBoxes | undefined {
  for (const line of lines) {
    const words = line.trim().split(/\s+/);
    if (words[0] !== "SCREEN" || words[1] !== fixture || Number(words[2]) !== frame || words.length !== 13) continue;
    const [width, height, ...values] = words.slice(3).map(Number);
    if (width === undefined || height === undefined || values.some(value => !Number.isInteger(value))) return undefined;
    const [rx = 0, ry = 0, rw = 0, rh = 0, bx = 0, by = 0, bw = 0, bh = 0] = values;
    return { width, height, region: { x: rx, y: ry, width: rw, height: rh }, body: { x: bx, y: by, width: bw, height: bh } };
  }
  return undefined;
}

export function defenderBox(defender: PixelBox, region: PixelBox): PixelBox | undefined {
  const x = Math.max(defender.x, region.x + region.width), width = defender.x + defender.width - x;
  return width > 0 ? { x, y: defender.y, width, height: defender.height } : undefined;
}

export function packSample(request: PackRequest, manifest: PackManifest, packMap: string, mapSha256: string, runs: readonly [PackRun, PackRun]): PackSample {
  const fail = (problem: string): never => { throw new Error(`${request.move}: ${problem}`); };
  const fixture = manifest.fixtures.find(row => row.name === request.fixture) ?? fail(`fixture ${request.fixture} is not in ${manifest.path}`);
  if (runs.some(run => run.map !== manifest.map)) fail("a capture run belongs to another map");
  if (runs[0].path === runs[1].path) fail("the repeated cue-off control needs a second, independent capture run");
  const frames = [...fixture.frames].sort((a, b) => a - b);
  const reference = (run: PackRun, frame: number, phase: "shown" | "hidden"): PackReference => {
    const saved = run.captures.find(row => row.fixture === fixture.name && row.frame === frame && row.phase === phase) ?? fail(`${run.path} has no ${phase} capture of frame ${frame}`);
    return { receipt: run.path, fixture: fixture.name, phase, file: join(dirname(run.path), saved.file) };
  };
  return {
    move: request.move, role: request.role, engine: "native-classic", camera: "normal-match", stage: "sky-deck",
    source: request.source, version: request.version, manifest: manifest.path, map: packMap, mapSha256, crop: request.crop,
    first: frames[0] ?? fail("no capture frames"), last: frames.at(-1) ?? 0,
    frames: frames.map(frame => {
      const boxes = screenBoxes(runs[0].screen ?? [], fixture.name, frame) ?? fail(`${runs[0].path} has no projected boxes for frame ${frame}`);
      const region = grownBox(croppedBox(boxes.region, request.crop), request.regionMargin, request.crop.width, request.crop.height);
      const defender = request.defender === undefined ? undefined : defenderBox(request.defender, region);
      return { frame, shown: reference(runs[0], frame, "shown"), off: reference(runs[0], frame, "hidden"), repeatedOff: reference(runs[1], frame, "hidden"), region, body: grownBox(croppedBox(boxes.body, request.crop), request.bodyMargin, request.crop.width, request.crop.height), excluded: defender === undefined ? request.excluded : [...request.excluded, defender] };
    }),
  };
}
