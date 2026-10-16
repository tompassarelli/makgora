import { NO_GLOBAL_SEQ } from './animVector';
import { mat4, quat, vec3 } from '../../ts/node_modules/gl-matrix';
import { ModelRenderer } from '../../ts/node_modules/war3-model';
import { model as mdx } from '../../ts/scripts/clipNodes';
import { originalClip } from '../../ts/src/generated/clips/fighterOriginalClipInfo';
import { Character } from '../../ts/src/game/sim/codes';
import { characterModelScale } from '../../ts/src/game/presentation/modelScale';
import { ensure } from './original-clips';
import { generateHdBody, parseHdBody } from './hd-retarget';

type Pose = { frame: number; nodes: { matrix: mat4 }[] };
type Point = vec3;
type Capsule = { a: { ObjectId: number }; b: { ObjectId: number }; radius: number };

function distance(a: Point, b: Point): number { return vec3.distance(a, b); }
function subtract(a: Point, b: Point): Point { return vec3.sub(vec3.create(), a, b); }
function add(a: Point, b: Point): Point { return vec3.add(vec3.create(), a, b); }
function multiply(a: Point, value: number): Point { return vec3.scale(vec3.create(), a, value); }
function dot(a: Point, b: Point): number { return vec3.dot(a, b); }
function segmentDistance(a: Point, b: Point, c: Point, d: Point): number {
    const u = subtract(b, a), v = subtract(d, c), w = subtract(a, c);
    const aa = dot(u, u), bb = dot(u, v), cc = dot(v, v), dd = dot(u, w), ee = dot(v, w), denominator = aa * cc - bb * bb;
    let s = denominator > 1e-8 ? Math.max(0, Math.min(1, (bb * ee - cc * dd) / denominator)) : 0;
    let t = cc > 1e-8 ? Math.max(0, Math.min(1, (bb * s + ee) / cc)) : 0;
    s = aa > 1e-8 ? Math.max(0, Math.min(1, (bb * t - dd) / aa)) : 0;
    return distance(add(a, multiply(u, s)), add(c, multiply(v, t)));
}

function verticesForNode(model: ReturnType<typeof parseHdBody>, objectId: number): Point[] {
    const vertices: Point[] = [];
    for (const geoset of model.Geosets) for (let index = 0; index < geoset.Vertices.length / 3; index++) {
        let weight = 0;
        if (geoset.SkinWeights !== undefined) {
            for (let slot = 0; slot < 4; slot++) if (geoset.SkinWeights[index * 8 + slot] === objectId) weight += geoset.SkinWeights[index * 8 + 4 + slot]! / 255;
        } else {
            const group = geoset.Groups[geoset.VertexGroup[index]!];
            if (group?.includes(objectId)) weight = 1 / group.length;
        }
        if (weight >= 0.1) vertices.push(vec3.fromValues(geoset.Vertices[index * 3]!, geoset.Vertices[index * 3 + 1]!, geoset.Vertices[index * 3 + 2]!));
    }
    return vertices;
}

function pivotedMatrix(rotation: quat, translation: Point, pivot: Point): mat4 {
    const matrix = mat4.fromRotationTranslation(mat4.create(), rotation, translation);
    matrix[12] += pivot[0]! - matrix[0]! * pivot[0]! - matrix[4]! * pivot[1]! - matrix[8]! * pivot[2]!;
    matrix[13] += pivot[1]! - matrix[1]! * pivot[0]! - matrix[5]! * pivot[1]! - matrix[9]! * pivot[2]!;
    matrix[14] += pivot[2]! - matrix[2]! * pivot[0]! - matrix[6]! * pivot[1]! - matrix[10]! * pivot[2]!;
    return matrix;
}

function clearRotation(current: quat, grip: Point, tip: Point, desired: Point, pivot: Point, parent: mat4, capsules: Capsule[], position: (node: { ObjectId: number }) => Point, scale: number) {
    const track = (rotation: quat) => vec3.sub(vec3.create(), vec3.sub(vec3.create(), desired, pivot), vec3.transformQuat(vec3.create(), vec3.sub(vec3.create(), grip, pivot), rotation));
    const matrix = (rotation: quat) => mat4.multiply(mat4.create(), parent, pivotedMatrix(rotation, track(rotation), pivot));
    const bladeClearance = (weaponMatrix: mat4) => {
        const fittedTip = vec3.transformMat4(vec3.create(), tip, weaponMatrix);
        const fittedGrip = vec3.transformMat4(vec3.create(), grip, weaponMatrix);
        const start = vec3.lerp(vec3.create(), fittedGrip, fittedTip, 0.2);
        return Math.min(...capsules.map(capsule => segmentDistance(start, fittedTip, position(capsule.a), position(capsule.b)) * scale - capsule.radius));
    };
    let angle = 0, clearance = bladeClearance(matrix(current)), rotation = quat.clone(current);
    const axes = [[0, 0, 1], [0, 1, 0], [1, 0, 0]] as const;
    for (let degrees = 0.5; degrees <= 180 && clearance < 0.25; degrees += 0.5) {
        for (const axis of axes) {
            const turn = quat.setAxisAngle(quat.create(), axis as unknown as vec3, degrees * Math.PI / 180);
            const candidate = quat.multiply(quat.create(), turn, current);
            const candidateClearance = bladeClearance(matrix(candidate));
            if (candidateClearance <= clearance) continue;
            angle = degrees;
            clearance = candidateClearance;
            rotation = candidate;
            if (clearance >= 0.25) break;
        }
    }
    return { angle, clearance, rotation, translation: track(rotation) };
}

export function fitBlademasterGrip(motion: mdx.Model, bytes: ArrayBuffer, pairs: readonly (readonly [string, string])[]) {
    const model = parseHdBody(bytes);
    const weapon = model.Nodes.find(node => node?.Name === 'Wep01_R0_0_jnt');
    const hand = model.Nodes.find(node => node?.Name === 'arm_R0_end_jnt');
    if (weapon === undefined || hand === undefined) throw new Error('Blademaster Definitive grip bones are missing');
    const readyIndex = motion.Sequences.findIndex(sequence => /stand ready/i.test(sequence.Name));
    const ready = readyIndex < 0 ? undefined : originalClip(Character.blademaster, readyIndex);
    if (ready === undefined) throw new Error('Blademaster Stand Ready clip is missing');
    const renderer = new ModelRenderer(model);
    renderer.setSequence(0);
    const pose = Reflect.get(renderer, 'rendererData') as Pose;
    const seek = (milliseconds: number) => { pose.frame = milliseconds; renderer.update(0); };
    const position = (node: { ObjectId: number }) => vec3.transformMat4(vec3.create(), model.PivotPoints[node.ObjectId]!, pose.nodes[node.ObjectId]!.matrix);
    seek(ready.startSeconds * 1000);
    const initialWeapon = pose.nodes[weapon.ObjectId]!.matrix;
    const initialInverse = mat4.invert(mat4.create(), initialWeapon);
    if (initialInverse === null) throw new Error('Blademaster Definitive weapon matrix is singular');
    const grip = vec3.transformMat4(vec3.create(), position(hand), initialInverse);
    const scale = characterModelScale(Character.blademaster);
    const rigJoint = (joint: string) => pairs.find(pair => pair[0] === joint)?.[1];
    const capsules: Capsule[] = [];
    const capsulePairs: readonly (readonly [string, string, number])[] = [['pelvis', 'chest', 0.22], ['head', 'head', 0.12], ['hip.L', 'knee.L', 0.16], ['knee.L', 'ankle.L', 0.13], ['hip.R', 'knee.R', 0.16], ['knee.R', 'ankle.R', 0.13]];
    seek(ready.startSeconds * 1000);
    for (const [aJoint, bJoint, factor] of capsulePairs) {
        const aNode = model.Nodes.find(node => node?.Name === rigJoint(aJoint));
        const bNode = model.Nodes.find(node => node?.Name === rigJoint(bJoint));
        const chestNode = model.Nodes.find(node => node?.Name === rigJoint('chest'));
        if (aNode === undefined || bNode === undefined || (aJoint === bJoint && chestNode === undefined)) continue;
        const length = aJoint === bJoint ? distance(position(aNode), position(chestNode!)) * scale : distance(position(aNode), position(bNode)) * scale;
        capsules.push({ a: aNode, b: bNode, radius: Math.max(3, Math.min(22, length * factor)) });
    }
    const tip = verticesForNode(model, weapon.ObjectId).toSorted((a, b) => distance(b, grip) - distance(a, grip))[0];
    if (tip === undefined || capsules.length === 0) throw new Error('Blademaster Definitive blade clearance inputs are unavailable');
    const translations = new Map<number, Float32Array>();
    const rotations = new Map<number, Float32Array>();
    let samples = 0, maxGap = 0, maxTranslation = 0, maxRotation = 0, unresolved = 0;
    for (let index = 0; index < motion.Sequences.length; index++) {
        const clip = originalClip(Character.blademaster, index);
        if (clip === undefined) throw new Error(`Blademaster sequence ${index} has no clip`);
        const count = Math.ceil((clip.endSeconds - clip.startSeconds) * 60) + 1;
        for (let frame = 0; frame < count; frame++) {
            const seconds = Math.min(clip.endSeconds, clip.startSeconds + frame / 60);
            const milliseconds = seconds * 1000;
            seek(milliseconds);
            const weaponWorld = pose.nodes[weapon.ObjectId]!.matrix;
            const handWorld = position(hand);
            const gripWorld = vec3.transformMat4(vec3.create(), grip, weaponWorld);
            maxGap = Math.max(maxGap, vec3.distance(handWorld, gripWorld) * scale);
            const parent = weapon.Parent == null ? undefined : pose.nodes[weapon.Parent]?.matrix;
            const parentInverse = parent === undefined ? mat4.create() : mat4.invert(mat4.create(), parent);
            if (parentInverse === null) throw new Error('Blademaster Definitive weapon parent matrix is singular');
            const desiredLocal = vec3.transformMat4(vec3.create(), handWorld, parentInverse);
            const currentLocal = vec3.transformMat4(vec3.create(), gripWorld, parentInverse);
            const delta = vec3.sub(vec3.create(), desiredLocal, currentLocal);
            maxTranslation = Math.max(maxTranslation, vec3.length(delta));
            const local = mat4.multiply(mat4.create(), parentInverse, weaponWorld);
            const fittedRotation = mat4.getRotation(quat.create(), local);
            const pivot = model.PivotPoints[weapon.ObjectId]!;
            if (pivot === undefined) throw new Error(`Blademaster weapon pivot missing for node ${weapon.ObjectId}`);
            if (grip === undefined) throw new Error('Blademaster calibrated grip is missing');
            const fit = clearRotation(fittedRotation, grip, tip, desiredLocal, pivot, parent ?? mat4.create(), capsules, position, scale);
            if (fit.clearance < 0) unresolved++;
            maxRotation = Math.max(maxRotation, fit.angle);
            const translation = new Float32Array(fit.translation);
            const rotation = new Float32Array(fit.rotation);
            for (const frameTime of new Set([Math.floor(milliseconds), Math.ceil(milliseconds)])) rotations.set(frameTime, rotation);
            for (const frameTime of new Set([Math.floor(milliseconds), Math.ceil(milliseconds)])) translations.set(frameTime, translation);
            samples++;
        }
    }
    ensure(translations.size > 0, 'Blademaster Definitive grip fit produced no keys');
    weapon.Translation = { LineType: mdx.LineType.Linear, GlobalSeqId: NO_GLOBAL_SEQ, Keys: [...translations].toSorted(([a], [b]) => a - b).map(([Frame, Vector]) => ({ Frame, Vector })) };
    weapon.Rotation = { LineType: mdx.LineType.Linear, GlobalSeqId: NO_GLOBAL_SEQ, Keys: [...rotations].toSorted(([a], [b]) => a - b).map(([Frame, Vector]) => ({ Frame, Vector })) };
    return { bytes: generateHdBody(model), report: { sequences: motion.Sequences.length, samples, keys: translations.size, maxGapBefore: maxGap, maxTranslation, maxRotation, unresolved } };
}
