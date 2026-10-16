import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import { INPUTS_STORE, assetsView, pinHashes, readManifest } from "../scripts/wisp/buildInputs";
import { DrawnModel, type PoseFrame, sampleAttack } from "../scripts/wisp/hurtboxView";
import { originalClip } from "../src/generated/clips/fighterOriginalClipInfo";
import { characterModelScale } from "../src/game/presentation/modelScale";
import { AttackPhase, AttackStyle, Character } from "../src/game/sim/codes";


const PEON_AXE_NORMALS: readonly AttackStyle[] = [
  AttackStyle.forwardTiltUp, AttackStyle.forwardTiltDown, AttackStyle.forwardSmash, AttackStyle.upSmash, AttackStyle.downSmash,
  AttackStyle.forwardAir, AttackStyle.backAir, AttackStyle.upAir, AttackStyle.downAir, AttackStyle.getupAttack, AttackStyle.ledgeAttack,
];

const NAMES = new Map(Object.entries(AttackStyle).map(([name, style]) => [style, name]));

const AERIALS: readonly AttackStyle[] = [AttackStyle.forwardAir, AttackStyle.backAir, AttackStyle.upAir, AttackStyle.downAir];

const AXE_NODES: Readonly<Record<"classic" | "definitive", ReadonlySet<string>>> = {
  classic: new Set(["axehandle"]),
  definitive: new Set(["Wep01_L0_0_jnt"]),
};

/** How far one active frame's strike capsules reach past the drawn axe's bounds, in units; at most 0 means every capsule lies on the axe. */
function pastAxe(model: DrawnModel, axe: Uint8Array, frame: PoseFrame): number {
  const info = frame.clip === undefined ? undefined : originalClip(Character.peon, frame.clip);
  if (info === undefined) throw new Error(`frame ${frame.frame} shows no clip`);
  const { vertices } = model.posed(0, info.startSeconds + frame.seconds, 1);
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let vertex = 0; vertex < axe.length; vertex++) {
    if (axe[vertex] !== 1) continue;
    const x = vertices[vertex * 2] ?? 0, z = vertices[vertex * 2 + 1] ?? 0;
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
  }
  let past = -Infinity;
  for (const strike of frame.strikes) {
    const x1 = strike.x1 - frame.x, x2 = strike.x2 - frame.x, z1 = strike.z1 - frame.z, z2 = strike.z2 - frame.z;
    past = Math.max(past, Math.max(x1, x2) + strike.radius - maxX, minX - Math.min(x1, x2) + strike.radius,
      Math.max(z1, z2) + strike.radius - maxZ, minZ - Math.min(z1, z2) + strike.radius);
  }
  return past;
}

const manifest = Effect.runSync(readManifest());
const stored = pinHashes(manifest["original-clips-static-lights"]).every((hash) => existsSync(join(INPUTS_STORE, "original-clips-static-lights", hash)));
const family = stored ? join(assetsView(manifest), "original-clips-static-lights") : undefined;
test("every active frame of Peon's 11 axe normals keeps its strike capsules on the drawn axe in both looks [k3 measure #520]", async () => {
  if (family === undefined) return;
  const body = (originalClip(Character.peon, 0)?.modelPath ?? "").split("\\");
  const off: string[] = [];
  for (const look of ["classic", "definitive"] as const) {
    const path = join(family, "imports", ...(look === "definitive" ? ["_de.w3mod"] : []), ...body);
    const model = new DrawnModel(await Bun.file(path).arrayBuffer(), characterModelScale(Character.peon));
    const axe = model.influencedBy(AXE_NODES[look]);
    for (const style of PEON_AXE_NORMALS) {
      const frames = sampleAttack(Character.peon, style, 1, AERIALS.includes(style)).filter((frame) => frame.phase === AttackPhase.active && frame.strikes.length > 0);
      const past = frames.map((frame) => pastAxe(model, axe, frame));
      const worst = Math.max(...past);
      if (!(worst <= 0.0)) off.push(`${look} ${NAMES.get(style)}: ${past.map((value) => value.toFixed(1)).join(" ")} past the axe on active frames ${frames.map((frame) => frame.frame).join(" ")}`);
    }
  }
  expect(off).toEqual([]);
}, 60_000);
