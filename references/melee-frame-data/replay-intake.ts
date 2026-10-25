// Foreign-data boundary only: measures the per-frame forward travel of the dash attacks libmelee never recorded
// from public Slippi replays, read as black-box observations of the running game.
// Usage: bun replay-intake.ts REPLAY_DIRECTORY OUTPUT_DIRECTORY, the replays laid out as the dataset's paths in replay-inputs.json
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const spec = "https://github.com/project-slippi/slippi-wiki/blob/master/SPEC.md";
const [replayDirectory, outputDirectory] = process.argv.slice(2);
if (replayDirectory === undefined || outputDirectory === undefined) throw new Error("Usage: bun replay-intake.ts REPLAY_DIRECTORY OUTPUT_DIRECTORY");
const { dataset, revision, replays } = JSON.parse(readFileSync(join(import.meta.dir, "replay-inputs.json"), "utf8")) as
  { dataset: string; revision: string; replays: { path: string; sha256: string }[] };

// Internal character IDs as in the replay's post-frame update and libmelee-intake.ts; 50 is the dash attack action state.
const characters = new Map<number, string>([
  [0, "mario"], [3, "donkey_kong"], [5, "bowser"], [14, "yoshi"], [15, "jigglypuff"], [17, "luigi"], [26, "roy"],
]);
// Fox, Captain Falcon and Marth are measured only as a control against libmelee's recorded travel.
const controls = new Map<number, string>([[1, "fox"], [2, "captain_falcon"], [18, "marth"]]);
const DASH_ATTACK = 50;

type Sample = { frame: number; action: number; x: number; y: number; facing: number; counter: number; airborne: boolean };
function samples(bytes: Buffer): Map<string, Sample[]> {
  if (bytes.toString("latin1", 0, 11) !== '{U\x03raw[$U#l') throw new Error("Not a Slippi replay");
  const view = new DataView(bytes.buffer, bytes.byteOffset + 15, bytes.readUInt32BE(11));
  if (view.getUint8(0) !== 0x35) throw new Error("Replay does not start with event payloads");
  const sizes = new Map<number, number>([[0x35, view.getUint8(1)]]);
  for (let i = 2; i < view.getUint8(1) + 1; i += 3) sizes.set(view.getUint8(i), view.getUint16(i + 1));
  const byFrame = new Map<string, Map<number, Sample>>();
  if ((sizes.get(0x38) ?? 0) < 0x30) return new Map();
  for (let at = 0; at < view.byteLength;) {
    const command = view.getUint8(at);
    const size = sizes.get(command);
    if (size === undefined) throw new Error(`Unknown event 0x${command.toString(16)}`);
    if (command === 0x38 && view.getUint8(at + 0x6) === 0) {
      const key = `${view.getUint8(at + 0x5)}/${view.getUint8(at + 0x7)}`;
      const frames = byFrame.get(key) ?? new Map<number, Sample>();
      const frame = view.getInt32(at + 0x1);
      frames.set(frame, {
        frame, action: view.getUint16(at + 0x8), x: view.getFloat32(at + 0xa), y: view.getFloat32(at + 0xe),
        facing: view.getFloat32(at + 0x12), counter: view.getFloat32(at + 0x22), airborne: view.getUint8(at + 0x2f) !== 0,
      });
      byFrame.set(key, frames);
    }
    at += size + 1;
  }
  return new Map([...byFrame].map(([key, frames]) => [key, [...frames.values()].sort((a, b) => a.frame - b.frame)]));
}

// A clean dash attack: entered from another state, grounded on one height and facing, its frame counter rising by one
// a frame with no hitlag pause, held at least until records.jsonl's interrupt frame and left into a grounded state.
const interruptible = new Map<string, number>(readFileSync(join(import.meta.dir, "records.jsonl"), "utf8").trim().split("\n")
  .map((line) => JSON.parse(line) as { character: string; category: string; action: string | null; values: Record<string, number | null> })
  .filter((r) => r.category === "attacks" && r.action === "dattack")
  .map((r) => [r.character, (r.values["iasa"] ?? r.values["total"] ?? Infinity) - 1]));
type Instance = { replay: string; port: number; start: number; travel: number[] };
const instances = new Map<string, Instance[]>();
for (const { path: name, sha256 } of replays) {
  const bytes = readFileSync(join(replayDirectory, name));
  if (createHash("sha256").update(bytes).digest("hex") !== sha256) throw new Error(`${name} differs from the pinned replay`);
  for (const [key, frames] of samples(bytes)) {
    const [port, id] = key.split("/").map(Number);
    const character = characters.get(id ?? -1) ?? controls.get(id ?? -1);
    if (character === undefined) continue;
    for (let i = 1; i < frames.length; i++) {
      const before = frames[i - 1], first = frames[i];
      if (before === undefined || first === undefined || first.action !== DASH_ATTACK || before.action === DASH_ATTACK) continue;
      let end = i;
      while (frames[end + 1]?.action === DASH_ATTACK) end++;
      const run = frames.slice(i, end + 1);
      const after = frames[end + 1];
      const contiguous = [before, ...run].every((s, k, all) => k === 0 || s.frame === (all[k - 1]?.frame ?? 0) + 1);
      const counted = run.every((s, k) => s.counter === k + 1);
      const grounded = [before, ...run].every((s) => !s.airborne && s.y === first.y) && run.every((s) => s.facing === first.facing);
      if (!contiguous || !counted || !grounded || run.length < (interruptible.get(character) ?? Infinity) || after === undefined || after.frame !== (run.at(-1)?.frame ?? 0) + 1 || after.airborne) continue;
      const travel = run.map((s, k) => Math.fround((s.x - ([before, ...run][k]?.x ?? s.x)) * first.facing));
      instances.set(character, [...(instances.get(character) ?? []), { replay: name, port: (port ?? 0) + 1, start: first.frame, travel }]);
    }
  }
}

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? (sorted[middle] ?? 0) : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
};
const round = (value: number): number => Math.round(value * 1e5) / 1e5;
const MINIMUM = 5;
const measure = (character: string) => {
  const found = instances.get(character) ?? [];
  if (found.length < MINIMUM) throw new Error(`${character}: ${found.length} clean dash attacks, need ${MINIMUM}`);
  const column = (frame: number): number[] => found.flatMap((instance) => instance.travel[frame] ?? []);
  let length = 0;
  while (column(length).length >= MINIMUM) length++;
  return { found, column, length };
};
const records = [...characters.values()].sort().map((character) => {
  const { found, column, length } = measure(character);
  return {
    schema_version: 1, character, category: "attacks", action: "dattack",
    source: { dataset, revision, parser: spec, replays: [...new Set(found.map((i) => i.replay))].sort() },
    frame_index_origin: 1, recorded_frames: length, instances: Array.from({ length }, (_, frame) => column(frame).length),
    locomotion_x: Array.from({ length }, (_, frame) => round(median(column(frame)))),
    locomotion_x_min: Array.from({ length }, (_, frame) => round(Math.min(...column(frame)))),
    locomotion_x_max: Array.from({ length }, (_, frame) => round(Math.max(...column(frame)))),
  };
});
const recorded = readFileSync(join(import.meta.dir, "libmelee.jsonl"), "utf8").trim().split("\n")
  .map((line) => JSON.parse(line) as { character: string; action: string; locomotion_x: number[] | null });
const control = [...controls.values()].map((character) => {
  const { column, length } = measure(character);
  const libmelee = recorded.find((r) => r.character === character && r.action === "dattack")?.locomotion_x ?? [];
  const span = Math.min(length, libmelee.length);
  const measured = Array.from({ length: span }, (_, frame) => median(column(frame)));
  const worst = Math.max(...measured.map((value, frame) => Math.abs(value - (libmelee[frame] ?? 0))));
  if (worst > 0.001) throw new Error(`${character}: replay travel differs from libmelee's by ${worst} on a frame`);
  const sum = (values: number[]): number => round(values.slice(0, span).reduce((total, v) => total + v, 0));
  return { character, frames: span, replay: sum(measured), libmelee: sum(libmelee) };
});
writeFileSync(join(outputDirectory, "replay-dash-attacks.jsonl"), records.map((record) => JSON.stringify(record)).join("\n") + "\n");
console.log(JSON.stringify(control));
console.log(JSON.stringify(records.map(({ character, recorded_frames, instances: n, locomotion_x }) =>
  ({ character, recorded_frames, instances: n[0], travel: round(locomotion_x.reduce((s, v) => s + v, 0)) }))));
