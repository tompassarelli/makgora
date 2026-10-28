import { mat4, quat, vec3 } from "../../ts/node_modules/gl-matrix";
import { ensure } from "./original-clips";

interface RigNode { name: string; parent: number; pivot: number[]; rotation: number[] | null; translation: number[] | null }
interface Rig { frames: number; hits: [number, number][]; nodes: RigNode[] }

const [rigPath, keysPath] = process.argv.slice(2, 4);
ensure(rigPath && keysPath, "usage: bun tools/animations/warden-up-smash.ts RIG.json KEYS.json [--debug]");
const rig = await Bun.file(rigPath).json() as Rig;
const { frames, nodes } = rig;
const [[first, last] = [0, 0]] = rig.hits;
ensure(rig.hits.length === 1, "up smash needs one active window");
const index = (name: string) => { const at = nodes.findIndex(n => n.name === name); ensure(at >= 0, `missing ${name}`); return at; };
const Y: vec3 = [0, 1, 0];

const rotation = nodes.map(() => quat.create()), translation = nodes.map(() => vec3.create());
const pivot = nodes.map(n => vec3.fromValues(n.pivot[0]!, n.pivot[1]!, n.pivot[2]!));
const local = (i: number) => mat4.fromRotationTranslationScaleOrigin(mat4.create(), rotation[i]!, translation[i]!, [1, 1, 1], pivot[i]!);
const world = (i: number): mat4 => { const parent = nodes[i]!.parent; return parent < 0 ? local(i) : mat4.multiply(mat4.create(), world(parent), local(i)); };
const head = (i: number) => vec3.transformMat4(vec3.create(), pivot[i]!, world(i));
const facing = (i: number) => mat4.getRotation(quat.create(), world(i));
const axis = (degrees: number, about: vec3 = Y) => quat.setAxisAngle(quat.create(), about, degrees * Math.PI / 180);

function rest() {
  nodes.forEach((n, i) => { quat.set(rotation[i]!, ...(n.rotation ?? [0, 0, 0, 1]) as [number, number, number, number]); vec3.set(translation[i]!, ...(n.translation ?? [0, 0, 0]) as [number, number, number]); });
}

function turn(i: number, by: quat, about = head(i)) {
  const around = mat4.fromRotationTranslationScaleOrigin(mat4.create(), by, [0, 0, 0], [1, 1, 1], about);
  const parent = nodes[i]!.parent, placed = mat4.multiply(mat4.create(), around, world(i));
  const next = parent < 0 ? placed : mat4.multiply(mat4.create(), mat4.invert(mat4.create(), world(parent)), placed);
  mat4.getRotation(rotation[i]!, next);
  vec3.subtract(translation[i]!, vec3.transformMat4(vec3.create(), pivot[i]!, next), pivot[i]!);
}

const pitch = (i: number, degrees: number, about = head(i)) => { if (degrees) turn(i, axis(degrees), about); };
const aim = (i: number, from: vec3, to: vec3) => turn(i, quat.rotationTo(quat.create(), vec3.normalize(vec3.create(), from), vec3.normalize(vec3.create(), to)));

function reach(upper: number, lower: number, end: number, x: number, z: number, bend: vec3) {
  const root = head(upper), mid = head(lower), a = vec3.distance(mid, root), b = vec3.distance(head(end), mid);
  const target = vec3.fromValues(x, head(end)[1]!, z), span = vec3.subtract(vec3.create(), target, root);
  const d = Math.min(vec3.length(span), a + b - 0.05), along = vec3.normalize(vec3.create(), span);
  const hint = vec3.normalize(vec3.create(), vec3.scaleAndAdd(vec3.create(), bend, along, -vec3.dot(along, bend)));
  const offset = (a * a - b * b + d * d) / (2 * d);
  const joint = vec3.scaleAndAdd(vec3.create(), vec3.scaleAndAdd(vec3.create(), root, along, offset), hint, Math.sqrt(Math.max(a * a - offset * offset, 0)));
  aim(upper, vec3.subtract(vec3.create(), mid, root), vec3.subtract(vec3.create(), joint, root));
  aim(lower, vec3.subtract(vec3.create(), head(end), head(lower)), vec3.subtract(vec3.create(), target, head(lower)));
}

type Side = "L" | "R";
const bone = (name: string, side: Side) => index(`Bone_${name}_${side}`);
const HAND = bone("Hand", "R"), GLAIVE = index("Object08");
const ring = nodes.flatMap((n, i) => n.parent === GLAIVE ? [i] : []);
ensure(ring.length > 0, "the glaive has no ring pieces");
const ringCentre = () => ring.map(head).reduce((sum, p) => vec3.add(sum, sum, p), vec3.create()).map(v => v / ring.length) as vec3;
const sideAngle = (from: ArrayLike<number>, to: ArrayLike<number>) => Math.atan2(to[2]! - from[2]!, to[0]! - from[0]!) * 180 / Math.PI;
const near = (angle: number, to: number) => angle + 360 * Math.round((to - angle) / 360);
const BODY = index("Recovery Motion"), CHEST = index("Bone_Chest"), HEAD = index("Bone_Head");

type Pair = readonly [number, number];
interface Pose { drop: number; chest: number; head: number; hand: Pair; glaive: number; elbow: Pair; handL: Pair }

rest();
const offset = (from: number, to: number): Pair => { const a = head(from), b = head(to); return [b[0]! - a[0]!, b[2]! - a[2]!]; };
const REST_GLAIVE = sideAngle(head(HAND), ringCentre());
const GRIP = facing(HAND);
const FEET = { L: head(bone("Foot", "L")), R: head(bone("Foot", "R")) };
const READY: Pose = { drop: 0, chest: 0, head: 0, hand: offset(bone("Arm1", "R"), HAND), glaive: REST_GLAIVE, elbow: [0, -1], handL: offset(bone("Arm1", "L"), bone("Hand", "L")) };

const mix = (a: number, b: number, t: number) => a * (1 - t) + b * t;
const pair = (a: Pair, b: Pair, t: number): Pair => [mix(a[0], b[0], t), mix(a[1], b[1], t)];
const blend = (a: Pose, b: Pose, t: number): Pose => ({ drop: mix(a.drop, b.drop, t), chest: mix(a.chest, b.chest, t), head: mix(a.head, b.head, t), hand: pair(a.hand, b.hand, t),
  glaive: mix(a.glaive, b.glaive, t), elbow: pair(a.elbow, b.elbow, t), handL: pair(a.handL, b.handL, t) });
const smooth = (t: number) => t * t * (3 - 2 * t);
const span = (a: number, b: number, frame: number) => b > a ? Math.min(1, Math.max(0, (frame - a) / (b - a))) : 1;

const COIL: Pose = { drop: 12, chest: 18, head: -10, hand: [44, -34], glaive: near(-30, REST_GLAIVE), elbow: [0, -1], handL: [10, -20] };
const SWEEP: readonly Pose[] = [
  { drop: 9, chest: 10, head: -6, hand: [52, -14], glaive: near(-12, REST_GLAIVE), elbow: [-0.4, -1], handL: [-6, -24] },
  { drop: 0, chest: -2, head: 2, hand: [34, 30], glaive: near(40, REST_GLAIVE), elbow: [-0.8, -0.6], handL: [-12, -26] },
  { drop: -6, chest: -8, head: 8, hand: [4, 44], glaive: near(88, REST_GLAIVE), elbow: [-1, 0], handL: [-14, -28] },
  { drop: -6, chest: -14, head: 12, hand: [-16, 40], glaive: near(130, REST_GLAIVE), elbow: [-0.6, 0.6], handL: [-12, -28] },
  { drop: -3, chest: -18, head: 12, hand: [-30, 26], glaive: near(165, REST_GLAIVE), elbow: [0, 1], handL: [-10, -28] },
];
const BEHIND: Pose = { drop: 2, chest: -12, head: 8, hand: [-34, -6], glaive: near(220, REST_GLAIVE), elbow: [0.4, 1], handL: [-6, -26] };

function at(frame: number): Pose {
  const sweepEnd = first + SWEEP.length - 1;
  if (frame < first) return blend(READY, COIL, smooth(span(0, first - 1, frame)));
  if (frame <= sweepEnd) {
    const k = frame - first;
    return k === 0 ? blend(COIL, SWEEP[0]!, 1) : SWEEP[k]!;
  }
  if (frame <= last) return blend(SWEEP.at(-1)!, BEHIND, smooth(span(sweepEnd, last, frame)));
  const back: Pose = { ...READY, glaive: near(REST_GLAIVE, BEHIND.glaive + 90) };
  return blend(BEHIND, back, smooth(span(last, frames, frame)));
}

function pose(p: Pose) {
  rest();
  translation[BODY]![2] = translation[BODY]![2]! - p.drop;
  pitch(CHEST, p.chest);
  pitch(HEAD, p.head - p.chest);
  for (const side of ["L", "R"] as const) reach(bone("Leg1", side), bone("Leg2", side), bone("Foot", side), FEET[side][0]!, FEET[side][2]!, [1, 0, 0]);
  const shoulder = head(bone("Arm1", "R"));
  reach(bone("Arm1", "R"), bone("Arm2", "R"), HAND, shoulder[0]! + p.hand[0], shoulder[2]! + p.hand[1], [p.elbow[0], 0, p.elbow[1]]);
  const held = quat.multiply(quat.create(), axis(REST_GLAIVE - p.glaive), GRIP);
  turn(HAND, quat.multiply(quat.create(), held, quat.invert(quat.create(), facing(HAND))));
  const shoulderL = head(bone("Arm1", "L"));
  reach(bone("Arm1", "L"), bone("Arm2", "L"), bone("Hand", "L"), shoulderL[0]! + p.handL[0], shoulderL[2]! + p.handL[1], [0, 0, -1]);
}

const out = { frames, nodes: nodes.map(() => ({ rotation: [] as number[][], translation: [] as number[][] })) };
const previous = new Map<number, quat>();
const settleFrom = last + 12;
for (let frame = 0; frame <= frames; frame++) {
  pose(at(frame));
  if (process.argv.includes("--debug")) {
    const hand = head(HAND), centre = ringCentre(), far = ring.map(head).reduce((a, b) => vec3.distance(b, hand) > vec3.distance(a, hand) ? b : a);
    console.log("DBG", frame, ...[hand[0]!, hand[2]!, centre[0]!, centre[2]!, far[0]!, far[2]!, head(HEAD)[2]!, FEET.L[2]!, head(bone("Foot", "L"))[2]!].map(Math.round));
  }
  const w = frame > settleFrom ? smooth((frame - settleFrom) / (frames - settleFrom)) : 0;
  nodes.forEach((n, i) => {
    const q = quat.slerp(quat.create(), quat.normalize(quat.create(), rotation[i]!), (n.rotation ?? [0, 0, 0, 1]) as unknown as quat, w);
    const before = previous.get(i);
    if (before && quat.dot(before, q) < 0) quat.scale(q, q, -1);
    previous.set(i, q);
    out.nodes[i]!.rotation.push(Array.from(q));
    out.nodes[i]!.translation.push(Array.from(vec3.lerp(vec3.create(), translation[i]!, (n.translation ?? [0, 0, 0]) as unknown as vec3, w)));
  });
}
await Bun.write(keysPath, JSON.stringify(out));
console.log("WARDEN_UP_SMASH_KEYS", keysPath, frames + 1, "frames");
