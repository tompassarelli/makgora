import { mat4, quat, vec3 } from '../../ts/node_modules/gl-matrix';
import { ModelRenderer, model as mdx } from '../../ts/scripts/clipNodes';
import { generateHdBody, parseHdBody } from './hd-retarget';
import { Character } from '../../ts/src/game/sim/codes';
import { fighterRules } from './fighter-rules';
import { WARDEN_SPIN_PIVOT_Z, wardenSpinTipDegrees } from '../../ts/src/game/sim/heroes/wardenSpin';

function wardenBlade() {
    const blade = fighterRules(Character.warden).blade;
    if (blade === undefined) throw new Error('Warden has no blade timing in its fighter rules');
    return blade;
}

function addNairBladeTrail(model: mdx.Model, motion: mdx.Model, weapon: mdx.Node) {
    const sequence = motion.Sequences.find(item => item.Name === 'Attack Gesture neutralAir');
    const move = wardenBlade().neutralAir;
    if (sequence === undefined || move === undefined) throw new Error('Warden neutral-air trail timing is missing');
    const start = sequence.Interval[0] + Math.round(move.startupFrames * 1000 / 60);
    const end = start + Math.round(move.activeFrames * 1000 / 60);
    const objectId = model.Nodes.length;
    const material = structuredClone(model.Materials[0]);
    material.Layers = [{ ...material.Layers[0], FilterMode: mdx.FilterMode.Additive, Shading: 1, TextureID: 0 }];
    const materialId = model.Materials.push(material) - 1;
    const trail: mdx.RibbonEmitter = {
        Name: 'WardenNeutralAirBladeTrail', ObjectId: objectId, Parent: weapon.ObjectId, Flags: 0,
        PivotPoint: new Float32Array([0, 0, 0]), HeightAbove: 4.5, HeightBelow: 4.5,
        Alpha: 0.9, Color: new Float32Array([1, 0.34, 0.08]), LifeSpan: 0.035,
        TextureSlot: 0, EmissionRate: 120, Rows: 1, Columns: 1, MaterialID: materialId, Gravity: 0,
        Visibility: { LineType: mdx.LineType.DontInterp, Keys: [
            { Frame: sequence.Interval[0], Vector: new Float32Array([0]) },
            { Frame: start, Vector: new Float32Array([0]) },
            { Frame: start + 1, Vector: new Float32Array([1]) },
            { Frame: end - 1, Vector: new Float32Array([1]) },
            { Frame: end, Vector: new Float32Array([0]) },
        ] },
    };
    model.RibbonEmitters.push(trail);
    model.Nodes.push(trail);
    model.PivotPoints.push(trail.PivotPoint);
}

export function fitWardenBlade(motion: mdx.Model, bytes: ArrayBuffer) {
    const source = parseHdBody(bytes), model = structuredClone(source);
    const weapon = model.Nodes.find(node => node?.Name === 'Wep01_R0_0_jnt');
    const classicWeapon = motion.Nodes.find(node => node?.Name === '@weapon');
    if (weapon === undefined || classicWeapon === undefined || weapon.Parent == null) throw new Error('Warden blade attachment is missing');
    const tip = vec3.fromValues(-8.521499633789062, -53.64099884033203, 14.718500137329102);
    const bladeNormal = vec3.normalize(vec3.create(), vec3.cross(vec3.create(), vec3.sub(vec3.create(), tip, weapon.PivotPoint), [1, 0, 0]));
    const renderer = new ModelRenderer(source);
    const state = Reflect.get(renderer, 'rendererData') as { frame: number; nodes: { matrix: mat4 }[] };
    renderer.setSequence(0);
    addNairBladeTrail(model, motion, weapon);
    let samples = 0;
    for (const name of ['neutralAir', 'forwardAir'] as const) {
        const index = motion.Sequences.findIndex(sequence => sequence.Name === `Attack Gesture ${name}`);
        const sequence = motion.Sequences[index];
        if (sequence === undefined) throw new Error(`Warden ${name} is missing`);
        const [start, end] = sequence.Interval;
        const move = wardenBlade()[name];
        if (move === undefined) throw new Error(`Warden ${name} timing is missing`);
        const activeEnd = move.startupFrames + move.activeFrames, total = (end - start) * 60 / 1000;
        const strikes = move.strikes;
        if (strikes.some(strike => strike === undefined)) throw new Error(`Warden ${name} blade region is missing`);
        const joins = strikes.slice(1).map((next, index) => {
            const previous = strikes[index];
            if (previous === undefined || next === undefined) throw new Error('Warden blade join is missing');
            const a = vec3.fromValues(previous.x1, 0, previous.z1), b = vec3.fromValues(next.x1, 0, next.z1);
            const gap = vec3.distance(a, b), direction = vec3.normalize(vec3.create(), vec3.sub(vec3.create(), b, a));
            const inset = Math.min(5.5, gap / 2);
            return { before: vec3.scaleAndAdd(vec3.create(), a, direction, inset), after: vec3.scaleAndAdd(vec3.create(), b, direction, -inset) };
        });
        const keys: Record<'Translation' | 'Rotation' | 'Scaling', mdx.AnimKeyframe[]> = { Translation: [], Rotation: [], Scaling: [] };
        const pose = (frame: number) => {
            state.frame = frame; renderer.update(0);
            const matrix = state.nodes[weapon.ObjectId].matrix;
            const pivot = vec3.transformMat4(vec3.create(), weapon.PivotPoint, matrix);
            const from = vec3.sub(vec3.create(), vec3.transformMat4(vec3.create(), tip, matrix), pivot);
            const localFrame = (frame - start) * 60 / 1000;
            const activeFrame = Math.max(move.startupFrames, Math.min(activeEnd - 1, Math.floor(localFrame)));
            const regionIndex = activeFrame - move.startupFrames;
            const strike = name === 'neutralAir' ? strikes[0] : strikes[regionIndex];
            if (strike === undefined) throw new Error(`Warden ${name} blade region is missing`);
            const target = vec3.fromValues(strike.x2, pivot[1], strike.z2);
            const progress = Math.max(0, Math.min(64 / 65, localFrame - activeFrame));
            if (name === 'neutralAir') {
                // The spin's regions are per sector, so the tip follows the shared path at the regions' reach.
                const reach = Math.hypot(strike.x2, strike.z2 - WARDEN_SPIN_PIVOT_Z), angle = wardenSpinTipDegrees(regionIndex + progress, move.activeFrames) * Math.PI / 180;
                vec3.set(target, reach * Math.cos(angle), pivot[1], WARDEN_SPIN_PIVOT_Z + reach * Math.sin(angle));
            } else {
                const entry = joins[regionIndex - 1]?.after, exit = joins[regionIndex]?.before;
                if (entry !== undefined && progress < 0.25) vec3.lerp(target, entry, target, progress * 4);
                if (exit !== undefined && progress > 0.75) vec3.lerp(target, target, exit, (progress - 0.75) / (64 / 65 - 0.75));
            }
            target[1] = pivot[1];
            const to = vec3.sub(vec3.create(), target, pivot);
            const weight = localFrame < move.startupFrames ? localFrame / move.startupFrames
                : localFrame <= activeEnd ? 1 : Math.max(0, (total - localFrame) / (total - activeEnd));
            const scale = 1 + (vec3.length(to) / vec3.length(from) - 1) * weight;
            const turn = quat.rotationTo(quat.create(), vec3.normalize(vec3.create(), from), vec3.normalize(vec3.create(), to));
            const direction = vec3.normalize(vec3.create(), to);
            const normal = vec3.transformQuat(vec3.create(), vec3.transformMat4(vec3.create(), bladeNormal, mat4.fromQuat(mat4.create(), mat4.getRotation(quat.create(), matrix))), turn);
            vec3.scaleAndAdd(normal, normal, direction, -vec3.dot(normal, direction));
            vec3.normalize(normal, normal);
            const camera = vec3.fromValues(0, -1, 0);
            vec3.scaleAndAdd(camera, camera, direction, -vec3.dot(camera, direction));
            vec3.normalize(camera, camera);
            const angle = Math.atan2(vec3.dot(direction, vec3.cross(vec3.create(), normal, camera)), vec3.dot(normal, camera));
            quat.multiply(turn, quat.setAxisAngle(quat.create(), direction, angle), turn);
            quat.slerp(turn, quat.create(), turn, weight);
            const fitted = mat4.fromTranslation(mat4.create(), pivot);
            mat4.multiply(fitted, fitted, mat4.fromQuat(mat4.create(), turn));
            mat4.scale(fitted, fitted, [scale, scale, scale]);
            mat4.translate(fitted, fitted, vec3.negate(vec3.create(), pivot));
            mat4.multiply(fitted, fitted, matrix);
            const parentInverse = mat4.invert(mat4.create(), state.nodes[weapon.Parent!].matrix);
            if (parentInverse === null) throw new Error('Warden blade parent is singular');
            const local = mat4.multiply(mat4.create(), parentInverse, fitted), p = weapon.PivotPoint;
            const translation = new Float32Array([0, 1, 2].map(axis => local[axis + 12] - p[axis]
                + local[axis] * p[0] + local[axis + 4] * p[1] + local[axis + 8] * p[2]));
            const rotation = quat.normalize(quat.create(), mat4.getRotation(quat.create(), local));
            const scaling = mat4.getScaling(vec3.create(), local);
            return { Translation: translation, Rotation: rotation, Scaling: scaling };
        };
        const overrides = new Map<number, ReturnType<typeof pose>>();
        for (let boundary = move.startupFrames + 1; boundary < activeEnd; boundary++) {
            const before = start + (boundary - 1 / 65) * 1000 / 60, after = start + boundary * 1000 / 60;
            const a = pose(before), b = pose(after);
            for (let frame = Math.floor(before); frame <= Math.ceil(after); frame++) {
                const mix = (frame - before) / (after - before);
                overrides.set(frame, {
                    Translation: new Float32Array(vec3.lerp(vec3.create(), a.Translation, b.Translation, mix)),
                    Rotation: quat.normalize(quat.create(), quat.slerp(quat.create(), a.Rotation, b.Rotation, mix)),
                    Scaling: vec3.lerp(vec3.create(), a.Scaling, b.Scaling, mix),
                });
            }
        }
        for (let frame = start; frame <= end; frame = Math.min(end, frame + 1)) {
            const { Translation: translation, Rotation: rotation, Scaling: scaling } = overrides.get(frame) ?? pose(frame);
            for (const [kind, vector] of [['Translation', translation], ['Rotation', rotation], ['Scaling', scaling]] as const) {
                keys[kind].push({ Frame: frame, Vector: new Float32Array(vector) });
            }
            samples++;
            if (frame === end) break;
        }
        for (const kind of ['Translation', 'Rotation', 'Scaling'] as const) {
            const track = weapon[kind];
            if (track === undefined || track.LineType !== mdx.LineType.Linear) throw new Error(`Warden blade ${kind} must be linear`);
            track.Keys = track.Keys.filter(key => key.Frame < start || key.Frame > end).concat(keys[kind]).sort((a, b) => a.Frame - b.Frame);
        }
    }
    const fittedBytes = generateHdBody(model);
    const coverage: number[] = [];
    for (const [body, names] of [[motion, ['@pelvis', '@head']], [parseHdBody(fittedBytes), ['spine_C0_0_jnt', 'bone_head']]] as const) {
        const pelvis = body.Nodes.find(node => node?.Name === names[0]), head = body.Nodes.find(node => node?.Name === names[1]);
        if (pelvis === undefined || head === undefined) throw new Error('Warden visible body axis is missing');
        const sequence = motion.Sequences.findIndex(item => item.Name === 'Attack Gesture neutralAir');
        const start = motion.Sequences[sequence]?.Interval[0];
        const move = wardenBlade().neutralAir;
        if (start === undefined || move === undefined) throw new Error('Warden neutral air body timing is missing');
        const drawn = new ModelRenderer(body);
        drawn.setSequence(body === motion ? sequence : 0);
        const data = Reflect.get(drawn, 'rendererData') as { frame: number; nodes: { matrix: mat4 }[] };
        let previous: number | undefined, angle = 0, low = 0, high = 0;
        for (let tick = 0; tick < move.activeFrames * 65; tick++) {
            data.frame = start + (move.startupFrames + tick / 65) * 1000 / 60;
            drawn.update(0);
            const a = vec3.transformMat4(vec3.create(), pelvis.PivotPoint, data.nodes[pelvis.ObjectId].matrix);
            const b = vec3.transformMat4(vec3.create(), head.PivotPoint, data.nodes[head.ObjectId].matrix);
            const projected = Math.atan2(b[0] - a[0], b[2] - a[2]);
            if (previous !== undefined) angle += Math.atan2(Math.sin(projected - previous), Math.cos(projected - previous));
            previous = projected;
            low = Math.min(low, angle); high = Math.max(high, angle);
        }
        coverage.push((high - low) * 180 / Math.PI);
    }
    if (coverage.some(degrees => degrees < 300)) throw new Error(`Warden exported body screen-plane rotation below 300 degrees: ${coverage.join(', ')}`);
    return { bytes: fittedBytes, report: { sequences: 2, samples, bodyUpProjectedCoverageDegrees: coverage, attachment: 'Fixed weapon pivot; visible blade follows the neutral-air spin path and the forward-air blade regions.' } };
}
