import { advanceFighterPose, createFighterPose } from "../../src/game/presentation/fighterPose";
import type { Character } from "../../src/game/sim/codes";
import { createFighter } from "../../src/game/sim/fighter";
import { fighterSlug } from "../../src/game/roster/kits";
import { type Controls, createRoster, neutralControls } from "../../src/game/sim/roster";
import { HOP_THRESHOLDS, type ScoreFrame, scoreHop } from "./animScore";
import { clipLabel, LIMIT, pose, step, timelineSeconds } from "./animScoreSample";
import type { DrawnModel } from "./drawnModel";
import { capture, type PoseFrame } from "./hurtboxView";

export type HopKind = "short" | "full";

export interface HopSample {
  readonly kind: HopKind;
  readonly stand: ScoreFrame;
  readonly frames: readonly ScoreFrame[];
  readonly seconds: readonly number[];
  readonly heights: readonly number[];
  readonly clips: readonly string[];
  readonly squatFrames: number;
  readonly riseFrames: number;
  readonly airFrames: number;
}

const HOP_SETTLE_FRAMES = 12;

export function sampleHop(model: DrawnModel, character: Character, kind: HopKind): HopSample {
  const f = createFighter(character, 0.0, 1);
  const world = createRoster(1, [f]);
  const p = createFighterPose();
  const advance = (input: Readonly<Controls>) => {
    const serial = f.jump.serial;
    step(world, input);
    advanceFighterPose(p, f, world, input, false, f.jump.serial !== serial, false, false);
    return capture(f, p);
  };
  const neutral = neutralControls(), held = { ...neutralControls(), jumpHeld: true }, press = { ...held, jumpPressed: true };
  let standing = capture(f, p);
  for (let tick = 0; tick < 30; tick++) standing = advance(neutral);
  const frames: PoseFrame[] = [];
  let squatFrames = 0, riseFrames = 0, airFrames = 0, settled = 0;
  for (let tick = 0; tick < LIMIT; tick++) {
    const frame = advance(tick === 0 ? press : kind === "full" ? held : neutral);
    frames.push(frame);
    if (!f.motion.grounded) {
      airFrames++;
      if (f.motion.vz > 0.0) riseFrames++;
    } else if (airFrames > 0) {
      if (++settled > HOP_SETTLE_FRAMES) break;
    } else squatFrames++;
  }
  if (airFrames === 0) throw new Error(`${fighterSlug(character)}: the sampled ${kind} hop leaves the ground`);
  return { kind, stand: pose(model, character, standing), frames: frames.map((frame) => pose(model, character, frame)), seconds: frames.map((frame) => timelineSeconds(character, frame)),
    heights: frames.map((frame) => frame.z), clips: frames.map((frame) => clipLabel(character, frame.clip)), squatFrames, riseFrames, airFrames };
}


const mark = (pass: boolean) => (pass ? "pass" : "FAIL");

export function hopRows(body: DrawnModel, character: Character) {
  return (["short", "full"] as const).map((kind) => {
    const sample = sampleHop(body, character, kind);
    return { fighter: fighterSlug(character), kind, squat: sample.squatFrames, rise: sample.riseFrames, air: sample.airFrames, clip: sample.clips[sample.squatFrames] ?? "none", ...scoreHop(sample.stand, sample.frames, sample.clips, sample.squatFrames, sample.airFrames) };
  });
}

export const HOP_TABLE_HEADER = "fighter\thop\tpass\tsquat\trise\tair\tclip\toff clip\tpop\tphases";

export const hopTableLine = (row: ReturnType<typeof hopRows>[number]) =>
  [row.fighter, row.kind, mark(row.pass), row.squat, row.rise, row.air, row.clip, row.offClip, row.pop.toFixed(3), row.phases.toFixed(3)].join("\t");

export const hopReport = (rows: readonly ReturnType<typeof hopRows>[number][], table: string): readonly string[] => {
  const h = HOP_THRESHOLDS;
  return [
    `\nhops (short hop and full hop from the ground, by airtime in frames: every airborne frame on one clip (off clip <= ${h.offClip}), largest one-frame mesh change from takeoff to landing <= ${h.pop} times the jump squat's own sharpest step (pop), mid-rise against mid-fall pose difference >= ${h.phases} body heights (phases)):`,
    ...rows.map((row) => `${row.fighter.padEnd(22)} ${row.kind.padEnd(5)} ${mark(row.pass).padEnd(5)} squat ${row.squat} rise ${row.rise} air ${row.air} clip ${row.clip.padEnd(24)} off clip ${row.offClip} pop ${row.pop.toFixed(3)} phases ${row.phases.toFixed(3)}`),
    `${rows.filter((row) => row.pass).length}/${rows.length} hops pass; ${table}`,
  ];
};
