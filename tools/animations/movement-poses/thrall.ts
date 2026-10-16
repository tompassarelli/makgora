import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { generateModelMDX } from "../../../ts/scripts/mdxCodec";
import { characterModelScale } from "../../../ts/src/game/presentation/modelScale";
import { Character } from "../../../ts/src/game/sim/codes";
import { LEDGE_HANG_DEPTH, LEDGE_HANG_OUTSET } from "../../../ts/src/game/sim/ledge";
import { LEDGE_THRESHOLDS, scoreLedgeHang } from "../../../ts/scripts/wisp/animScore";
import { loadBody, sampleLedgeHang } from "../../../ts/scripts/wisp/animScoreSample";
import { headlessRender } from "../../../ts/scripts/wisp/headlessRender";
import { DrawnModel } from "../../../ts/scripts/wisp/hurtboxView";
import { authoredMotion, fighterBodies } from "../hd-models";
import { FIGHTER_RIGS } from "../hd-rigs";
import { canonicalMotion } from "../canonical-rig";
import { thinnedModel } from "../thinned-source";
import type { Choice, Measure, Space } from "../movement-space";

const assets = resolve(process.argv[2] ?? "");
const rig = FIGHTER_RIGS.get(Character.thrall)!;
const stockName = (rig.stockPath ?? "").replace(/^war3\.w3mod:_de\.w3mod:/, "").replaceAll("/", "\\");
const stock = (await headlessRender({ assets, imports: [] }).resolveAsset(stockName, "definitive")).bytes!.slice().buffer;
const sample = sampleLedgeHang(await loadBody(assets, Character.thrall, "definitive"), Character.thrall);
const thinStore = mkdtempSync(join(tmpdir(), "thrall-thin-"));

const definitiveHang = ({ model, index }: Measure) => {
  const authored = generateModelMDX(model);
  const bodies = fighterBodies(authoredMotion(authored, rig), rig, stock, { classic: [index], definitive: [index] }, canonicalMotion(thinnedModel(authored, thinStore).model, rig));
  const drawn = new DrawnModel(bodies.definitive!.bytes, characterModelScale(Character.thrall));
  const frames = sample.hangSeconds.map((seconds, frame) => ({ frame, ...drawn.posed(0, seconds, 1) }));
  const s = scoreLedgeHang(sample.stand, frames, sample.parts, { x: LEDGE_HANG_OUTSET, z: LEDGE_HANG_DEPTH }, sample.standParts), t = LEDGE_THRESHOLDS;
  return { value: Math.max(0, s.grip - t.grip) / t.grip + 3 * (Math.max(0, t.below + 0.06 - s.below) + Math.max(0, t.clear + 0.03 - s.clear) + Math.max(0, Math.min(t.fit, s.standFit) + 0.03 - s.fit)),
    report: `Definitive grip ${s.grip.toFixed(3)} below ${s.below.toFixed(3)} clear ${s.clear.toFixed(3)} fit ${s.fit.toFixed(3)}/${s.standFit.toFixed(3)}` };
};

const turn = [-120, -90, -60, -30, 0, 30, 60, 90, 120];
const BONES = {
  neck: ["Bone Wolf Neck"], head: ["Bone Wolf Head"], waist: ["Bone Wolf Waist"],
  frontLeg: ["Bone Front L Leg", "Bone Front R Leg"], frontShin: ["Bone Front L Shin", "Bone_Mesh49"], frontToe: ["Bone FrontL Toe", "Bone_Mesh48"],
  backLeg: ["Bone Back L Leg", "Bone Back R Leg"], backShin: ["Bone Back L Shin", "Bone Back R Shin"], backToe: ["Bone Object67", "Bone Back R Toe"],
  tail: ["Bone Tail 1", "Bone Tail 2"], seat: ["Bone Rider Waist"], chest: ["Bone_Chest"], riderHead: ["Bone_Head"],
  rightArm: ["Bone Rider R Arm"], rightWrist: ["Bone Rider R Wrist"], leftArm: ["Bone Rider L Arm"], leftWrist: ["Bone Rider L Wrist"],
} as const;

const hang = (c: Choice) => ({
  name: Object.entries(c).map(([key, value]) => `${key} ${value}`).join(" "), angles: {}, fold: 0, lean: c.lean ?? 0, parentFrame: c.frame === 1,
  bones: Object.fromEntries(Object.entries(BONES).flatMap(([key, names]) => names.map((name) => [name, c[key] ?? 0] as const))),
});

export const MOVEMENT_POSES: Partial<Record<"crouch" | "ledgeHang", Space>> = {
  ledgeHang: {
    starts: [
      { frame: 1, lean: -110, neck: -30, head: 90, waist: 0, frontLeg: 30, frontShin: 30, frontToe: 60, backLeg: -90, backShin: -30, backToe: 0, tail: -60, seat: 60, chest: 0, riderHead: 0, rightArm: 0, rightWrist: 0, leftArm: 0, leftWrist: 0 },
    ],
    options: {
      frame: [0, 1], lean: [-110, -95, -80, -65, -50, -35], neck: turn, head: turn, waist: [-60, -30, 0, 30, 60], frontLeg: turn, frontShin: turn, frontToe: [-60, -30, 0, 30, 60],
      backLeg: turn, backShin: turn, backToe: [-60, -30, 0, 30, 60], tail: [-60, -30, 0, 30, 60], seat: turn, chest: turn, riderHead: [-60, -30, 0, 30, 60],
      rightArm: turn, rightWrist: [-60, -30, 0, 30, 60], leftArm: turn, leftWrist: [-60, -30, 0, 30, 60],
    },
    variant: hang,
    local: true,
    extra: definitiveHang,
  },
};
