import { mat4, quat, vec3 } from "../../ts/node_modules/gl-matrix";
import { ensure } from "./original-clips";

interface RigNode { name: string; parent: number; pivot: number[]; rotation: number[] | null; translation: number[] | null }
interface Rig { frames: number; hits: [number, number][]; nodes: RigNode[] }

const [rigPath, keysPath] = process.argv.slice(2, 4);
ensure(rigPath && keysPath, "usage: bun tools/animations/mountain-king-neutral-air.ts RIG.json KEYS.json [--debug]");
const rig = await Bun.file(rigPath).json() as Rig;
const { frames, nodes } = rig;
const [[first, last] = [0, 0]] = rig.hits;
ensure(rig.hits.length === 1, "neutral air needs one active window");
const index = (name: string) => { const at = nodes.findIndex(n => n.name === name); ensure(at >= 0, `missing ${name}`); return at; };
const Y: vec3 = [0, 1, 0];

const rotation = nodes.map(() => quat.create()), translation = nodes.map(() => vec3.create());
const pivot = nodes.map(n => vec3.fromValues(n.pivot[0]!, n.pivot[1]!, n.pivot[2]!));
const local = (i: number) => mat4.fromRotationTranslationScaleOrigin(mat4.create(), rotation[i]!, translation[i]!, [1, 1, 1], pivot[i]!);
const world = (i: number): mat4 => { const parent = nodes[i]!.parent; return parent < 0 ? local(i) : mat4.multiply(mat4.create(), world(parent), local(i)); };
const head = (i: number) => vec3.transformMat4(vec3.create(), pivot[i]!, world(i));
const facing = (i: number) => mat4.getRotation(quat.create(), world(i));
const axis = (degrees: number) => quat.setAxisAngle(quat.create(), Y, degrees * Math.PI / 180);

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

const pitch = (i: number, degrees: number) => { if (degrees) turn(i, axis(degrees)); };
const aim = (i: number, from: vec3, to: vec3) => turn(i, quat.rotationTo(quat.create(), vec3.normalize(vec3.create(), from), vec3.normalize(vec3.create(), to)));

function reach(upper: number, lower: number, end: number, x: number, z: number, bend: vec3) {
  const hip = head(upper), mid = head(lower), a = vec3.distance(mid, hip), b = vec3.distance(head(end), mid);
  const target = vec3.fromValues(x, head(end)[1], z), span = vec3.subtract(vec3.create(), target, hip);
  const d = Math.min(vec3.length(span), a + b - 0.05), along = vec3.normalize(vec3.create(), span);
  const hint = vec3.normalize(vec3.create(), vec3.scaleAndAdd(vec3.create(), bend, along, -vec3.dot(along, bend)));
  const offset = (a * a - b * b + d * d) / (2 * d);
  const knee = vec3.scaleAndAdd(vec3.create(), vec3.scaleAndAdd(vec3.create(), hip, along, offset), hint, Math.sqrt(Math.max(a * a - offset * offset, 0)));
  aim(upper, vec3.subtract(vec3.create(), mid, hip), vec3.subtract(vec3.create(), knee, hip));
  aim(lower, vec3.subtract(vec3.create(), head(end), head(lower)), vec3.subtract(vec3.create(), target, head(lower)));
}

type Side = "L" | "R";
const SIDES: readonly Side[] = ["R", "L"];
const bone = (name: string, side: Side) => index(`Bone_${name}_${side}`);
const weapon = { R: index("1Cylinder04"), L: index("1Cylinder03") };
const headParts = { R: nodes.flatMap((n, i) => n.parent === weapon.R ? [i] : []), L: nodes.flatMap((n, i) => n.parent === weapon.L ? [i] : []) };
const hammerHead = (side: Side) => headParts[side].map(head).reduce((sum, p) => vec3.add(sum, sum, p), vec3.create()).map(v => v / headParts[side].length);
const sideAngle = (from: ArrayLike<number>, to: ArrayLike<number>) => Math.atan2(to[2]! - from[2]!, to[0]! - from[0]!) * 180 / Math.PI;
const near = (angle: number, to: number) => angle + 360 * Math.round((to - angle) / 360);
const BODY = index("Recovery Motion"), CHEST = index("Bone_Chest"), HEAD = index("Bone_Head");
const CENTRE = vec3.fromValues(2, 0, 46);

type Pair = readonly [number, number];
interface Pose { flip: number; chest: number; head: number; handR: Pair; axeR: number; handL: Pair; axeL: number; footL: Pair; footR: Pair }

rest();
const offset = (from: number, to: number): Pair => { const a = head(from), b = head(to); return [b[0]! - a[0]!, b[2]! - a[2]!]; };
const REST = { R: sideAngle(head(bone("Hand", "R")), hammerHead("R")), L: sideAngle(head(bone("Hand", "L")), hammerHead("L")) };
const GRIP = { R: facing(bone("Hand", "R")), L: facing(bone("Hand", "L")) };
const READY: Pose = { flip: 0, chest: 0, head: 0, handR: offset(bone("Arm1", "R"), bone("Hand", "R")), axeR: REST.R, handL: offset(bone("Arm1", "L"), bone("Hand", "L")), axeL: REST.L,
  footL: offset(bone("Leg1", "L"), bone("Foot", "L")), footR: offset(bone("Leg1", "R"), bone("Foot", "R")) };
const TUCK = { footL: [16, -14], footR: [10, -16] } as const;
const COIL: Pose = { ...READY, ...TUCK, flip: -14, chest: 16, head: 10, handR: [-10, 20], axeR: near(130, REST.R), handL: [14, -8], axeL: near(-60, REST.L) };
const FLING: Pose = { ...COIL, flip: 0, chest: 10, head: 6, handR: [26, 12], axeR: near(25, REST.R) };
const SPIN: Pose = { ...FLING, flip: 360 };
const OPEN: Pose = { ...READY, ...TUCK, flip: 360, axeR: near(REST.R, SPIN.axeR), axeL: near(REST.L, SPIN.axeL) };
const BEATS: readonly (readonly [number, Pose])[] = [[0, READY], [first - 2, COIL], [first, FLING], [last, SPIN]];

const mix = (a: number, b: number, t: number) => a * (1 - t) + b * t;
const pair = (a: Pair, b: Pair, t: number): Pair => [mix(a[0], b[0], t), mix(a[1], b[1], t)];
const blend = (a: Pose, b: Pose, t: number): Pose => ({ flip: mix(a.flip, b.flip, t), chest: mix(a.chest, b.chest, t), head: mix(a.head, b.head, t), handR: pair(a.handR, b.handR, t), axeR: mix(a.axeR, b.axeR, t),
  handL: pair(a.handL, b.handL, t), axeL: mix(a.axeL, b.axeL, t), footL: pair(a.footL, b.footL, t), footR: pair(a.footR, b.footR, t) });
const smooth = (t: number) => t * t * (3 - 2 * t);
function glide(t: number, ramp = 0.15) {
  const peak = 1 / (1 - ramp);
  return t < ramp ? peak * t * t / (2 * ramp) : t < 1 - ramp ? peak * (t - ramp / 2) : 1 - peak * (1 - t) ** 2 / (2 * ramp);
}

function at(frame: number): Pose {
  if (frame > last) return blend(SPIN, OPEN, smooth(Math.min(1, (frame - last) / 5)));
  for (let beat = 1; beat < BEATS.length; beat++) {
    const [a, from] = BEATS[beat - 1]!, [b, to] = BEATS[beat]!;
    if (frame < a || frame > b) continue;
    const t = b > a ? (frame - a) / (b - a) : 1;
    return to === SPIN ? { ...blend(from, to, Math.min(1, t * 3)), flip: 360 * glide(t, 0.1) } : blend(from, to, smooth(t));
  }
  return READY;
}

const settled = (frame: number) => frame > last + 5 ? glide((frame - last - 5) / (frames - last - 5)) ** 1.4 : 0;

function pose(p: Pose) {
  rest();
  pitch(CHEST, p.chest);
  pitch(HEAD, p.head - p.chest);
  for (const side of ["L", "R"] as const) {
    const hip = head(bone("Leg1", side)), [dx, dz] = side === "L" ? p.footL : p.footR;
    reach(bone("Leg1", side), bone("Leg2", side), bone("Foot", side), hip[0]! + dx, hip[2]! + dz, [1, 0, 0]);
  }
  for (const side of SIDES) {
    const shoulder = head(bone("Arm1", side)), [dx, dz] = side === "R" ? p.handR : p.handL, hand = bone("Hand", side);
    reach(bone("Arm1", side), bone("Arm2", side), hand, shoulder[0]! + dx, shoulder[2]! + dz, [0, 0, -1]);
    const held = quat.multiply(quat.create(), axis(REST[side] - (side === "R" ? p.axeR : p.axeL)), GRIP[side]);
    turn(hand, quat.multiply(quat.create(), held, quat.invert(quat.create(), facing(hand))));
  }
  turn(BODY, axis(p.flip), CENTRE);
}

const out = { frames, nodes: nodes.map(() => ({ rotation: [] as number[][], translation: [] as number[][] })) };
const previous = new Map<number, quat>();
for (let frame = 0; frame <= frames; frame++) {
  pose(at(frame));
  if (process.argv.includes("--debug")) { const hand = head(bone("Hand", "R")), tip = hammerHead("R"); console.log("DBG", frame, ...[hand[0]!, hand[2]!, tip[0]!, tip[2]!].map(Math.round)); }
  const w = settled(frame);
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
console.log("MOUNTAIN_KING_NEUTRAL_AIR_KEYS", keysPath, frames + 1, "frames");
