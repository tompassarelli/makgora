import { join, relative, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { Effect, Schema } from "effect";
import { BunRuntime } from "@effect/platform-bun";
import { ModelRenderer, model as mdx } from "war3-model";
import { mat4, quat, vec3 } from "gl-matrix";
import { generateHdBody, parseHdBody } from "./hd-retarget";
import { tracks, onGlobalClock, ensure } from "./original-clips";
import { renumberNodes } from "../../ts/scripts/clipNodes";
import { DrawnModel, sheet, type PoseFrame } from "../../ts/scripts/wisp/hurtboxView";
import { AttackStyle, AttackPhase } from "../../ts/src/game/sim/codes";
import { FORSAKEN_PALADIN_AUTHORING_MOVES as FORSAKEN_PALADIN_MOVES } from "../../ts/src/game/sim/heroes/forsakenPaladinMoves";
import { FORSAKEN_PALADIN_AUTHORING_SPECIALS as FORSAKEN_PALADIN_SPECIALS } from "../../ts/src/game/sim/heroes/forsakenPaladinSpecials";
import { FORSAKEN_PALADIN_CLIPS } from "../../ts/src/game/sim/heroes/forsakenPaladinClips";
import type { HeroPose } from "../../ts/src/game/sim/heroes/hero";

type Target = { frame: number; x: number; z: number };
type Action = { pose: HeroPose; donor: number; frames: number; first: number; last: number; targets: Target[] };
class WeaponFailure extends Schema.TaggedError<WeaponFailure>()("WeaponFailure", { cause: Schema.Unknown }) {}

const normalDonors: readonly [HeroPose, AttackStyle, number][] = [
    ["jab", AttackStyle.jab, 5], ["jab2", AttackStyle.jab2, 15],
    ["forwardTilt", AttackStyle.forwardTilt, 15], ["forwardTiltUp", AttackStyle.forwardTiltUp, 15], ["forwardTiltDown", AttackStyle.forwardTiltDown, 15],
    ["upTilt", AttackStyle.upTilt, 5], ["downTilt", AttackStyle.downTilt, 27], ["dashAttack", AttackStyle.dashAttack, 15],
    ["forwardSmash", AttackStyle.forwardSmash, 15], ["upSmash", AttackStyle.upSmash, 5], ["downSmash", AttackStyle.downSmash, 27],
    ["neutralAir", AttackStyle.neutralAir, 5], ["forwardAir", AttackStyle.forwardAir, 15], ["backAir", AttackStyle.backAir, 5],
    ["upAir", AttackStyle.upAir, 5], ["downAir", AttackStyle.downAir, 27],
];

function valueAt(track: mdx.AnimVector, first: number, last: number, frame: number, rotation: boolean): Float32Array {
    ensure(track.LineType === mdx.LineType.Linear, "Stock weapon donors require their canonical linear interpolation");
    const keys = track.Keys.filter(key => key.Frame >= first && key.Frame <= last);
    ensure(keys.length > 0, "Donor track is empty");
    const left = [...keys].reverse().find(key => key.Frame <= frame) ?? keys[0]!;
    const right = keys.find(key => key.Frame >= frame) ?? keys[keys.length - 1]!;
    if (left === right || track.LineType === mdx.LineType.DontInterp) return Float32Array.from(left.Vector);
    const t = (frame - left.Frame) / (right.Frame - left.Frame);
    if (rotation) return Float32Array.from(quat.slerp(quat.create(), Float32Array.from(left.Vector), Float32Array.from(right.Vector), t));
    return Float32Array.from(left.Vector, (v, i) => v + (right.Vector[i]! - v) * t);
}

function corrected(base: Float32Array, angles: readonly number[]): Float32Array {
    const q = quat.create();
    quat.rotateY(q, q, angles[0]! * Math.PI / 180);
    quat.rotateZ(q, q, angles[1]! * Math.PI / 180);
    quat.rotateX(q, q, angles[2]! * Math.PI / 180);
    quat.multiply(q, q, base); quat.normalize(q, q);
    return Float32Array.from(q);
}

function key(track: mdx.AnimVector, frame: number, vector: Float32Array, rotation = false): mdx.AnimKeyframe {
    return { Frame: frame, Vector: vector, ...(track.LineType > 1 ? { InTan: rotation || track.LineType === mdx.LineType.Bezier ? vector.slice() : new Float32Array(vector.length), OutTan: rotation || track.LineType === mdx.LineType.Bezier ? vector.slice() : new Float32Array(vector.length) } : {}) };
}

BunRuntime.runMain(Effect.tryPromise({ try: async () => {
    const [stockArg, inputArg, outputArg] = process.argv.slice(2);
    ensure(stockArg && inputArg && outputArg, "usage: bun tools/animations/forsaken-paladin-weapon-clips.ts STOCK.mdx AUTHORED.mdx PRIVATE_OUTPUT");
    const output = resolve(outputArg);
    ensure(relative(resolve(import.meta.dir, "../.."), output).startsWith(".."), "Weapon output stays private");
    const stock = parseHdBody(await Bun.file(stockArg).arrayBuffer());
    const glow = new Set((stock.ParticleEmitterPopcorns ?? []).map(node => node.ObjectId));
    stock.ParticleEmitterPopcorns = []; for (const id of glow) delete stock.Nodes[id]; renumberNodes(stock);
    const source = parseHdBody(await Bun.file(inputArg).arrayBuffer()), model = structuredClone(source);
    ensure(stock.Sequences.length === 28 && source.Sequences.length === 109, "Expected canonical stock and authored Forsaken rigs");
    for (const original of source.Nodes) if (original && original.Name !== "Weapon Ref") {
        const donor = stock.Nodes.find(node => node?.Name === original.Name);
        ensure(donor && isDeepStrictEqual(stock.PivotPoints[donor.ObjectId], source.PivotPoints[original.ObjectId]), `${original.Name}: stock pivot differs from authored rig`);
    }
    const actions: Action[] = normalDonors.map(([pose, style, donor]) => {
        const move = FORSAKEN_PALADIN_MOVES.normals[style]!;
        const regions = move.regions.filter((region, index, rows) => rows.findIndex(row => row.firstFrame === region.firstFrame) === index);
        return { pose, donor, frames: move.totalFrames, first: move.startupFrames, last: move.startupFrames + move.activeFrames - 1,
            targets: regions.map(region => ({ frame: region.firstFrame, x: region.hit.strike!.x2 / 1.2, z: region.hit.strike!.z2 / 1.2 })) };
    });
    for (const [pose, name, donor, first, last] of [["neutralSpecial", "neutral", 15, 14, 16], ["sideSpecial", "side", 5, 15, 20], ["upSpecial", "up", 5, 10, 15], ["downSpecial", "down", 27, 16, 16]] as const) {
        const special = FORSAKEN_PALADIN_SPECIALS[name]!;
        for (const air of [false, true]) {
            const form = air ? special.air ?? special.ground : special.ground;
            const targets = (form.regions ?? []).flatMap(region => Array.from({ length: region.lastFrame - region.firstFrame + 1 }, (_, i) => ({ frame: region.firstFrame + i, x: region.hit.strike!.x2 / 1.2, z: region.hit.strike!.z2 / 1.2 })));
            if (targets.length === 0) targets.push({ frame: first, x: air ? 0 : 70 / 1.2, z: 6 / 1.2 });
            actions.push({ pose: (air ? `${pose}Air` : pose) as HeroPose, donor, frames: form.endFrame!, first: Math.min(...targets.map(t => t.frame)), last: Math.max(...targets.map(t => t.frame)), targets });
        }
    }
    actions.push({ pose: "pummel", donor: 5, frames: 12, first: 5, last: 5, targets: [{ frame: 5, x: 50 / 1.2, z: 65 / 1.2 }] });
    const donorTracks = new Map<string, mdx.AnimVector>(); tracks(stock, (track, path) => donorTracks.set(path, track));
    const targetTracks = new Map<string, mdx.AnimVector>(); tracks(source, (track, path) => targetTracks.set(path, track));
    const renderer = new ModelRenderer(model), data = Reflect.get(renderer, "rendererData");
    const node = (name: string) => { const result = model.Nodes.find(node => node?.Name === name); ensure(result, `Missing ${name}`); return result; };
    const hand = node("arm_R0_end_jnt"), weapon = node("Wep01_R0_0_jnt"), reference = node("Weapon Ref"), root = node("local_C0_0_jnt");
    const shoulder = node("arm_R0_0_jnt"), elbow = node("arm_R0_3_jnt");
    const evaluate = (index: number, frame: number) => { renderer.setSequence(index); data.frame = model.Sequences[index]!.Interval[0] + Math.round(frame * 1000 / 60); renderer.update(0); };
    evaluate(1, 0);
    const offset = mat4.create(); ensure(mat4.invert(offset, data.nodes[hand.ObjectId].matrix), "Singular hand"); mat4.multiply(offset, offset, data.nodes[weapon.ObjectId].matrix);
    const headInHand = vec3.clone(model.PivotPoints[reference.ObjectId]!); vec3.transformMat4(headInHand, headInHand, data.nodes[reference.ObjectId].matrix);
    const inverse = mat4.create(); ensure(mat4.invert(inverse, data.nodes[hand.ObjectId].matrix), "Singular reference"); vec3.transformMat4(headInHand, headInHand, inverse);
    const changed = new Set<number>(), receipts = [];
    for (const action of actions) {
        const binding = FORSAKEN_PALADIN_CLIPS[action.pose as keyof typeof FORSAKEN_PALADIN_CLIPS]; ensure(binding, `${action.pose}: no clip`);
        const index = binding.index, sequence = model.Sequences[index]!, [start, end] = sequence.Interval;
        ensure(Math.abs((end - start) - action.frames * 1000 / 60) < 1, `${action.pose}: clip timing changed`);
        changed.add(index);
        const donor = stock.Sequences[action.donor]!, donorLength = donor.Interval[1] - donor.Interval[0];
        const contactStart = action.donor === 27 ? 0.46 : action.donor === 15 ? 0.48 : 0.43;
        const contactEnd = action.donor === 27 ? 0.63 : action.donor === 15 ? 0.59 : 0.53;
        const donorTime = (frame: number) => {
            const ratio = frame < action.first ? contactStart * frame / action.first : frame <= action.last ? contactStart + (contactEnd - contactStart) * (frame - action.first) / Math.max(1, action.last - action.first) : contactEnd + (1 - contactEnd) * (frame - action.last) / (action.frames - action.last);
            return donor.Interval[0] + donorLength * ratio;
        };
        tracks(model, (track, path) => {
            if (onGlobalClock(track)) return;
            if (action.pose === "pummel") {
                const match = /^\.(Bones|Helpers|Attachments)\.(\d+)\./.exec(path);
                const joint = match ? source[match[1] as "Bones" | "Helpers" | "Attachments"][Number(match[2])] : undefined;
                if (joint === undefined || !/^(arm_R0_|shoulder_R0_|Wep01_|Weapon Ref)/.test(joint.Name)) return;
            }
            const donorTrack = donorTracks.get(path);
            track.Keys = track.Keys.filter(k => k.Frame < start || k.Frame > end);
            if (!donorTrack || onGlobalClock(donorTrack) || !donorTrack.Keys.some(k => k.Frame >= donor.Interval[0] && k.Frame <= donor.Interval[1])) return;
            const rotation = path.endsWith(".Rotation"), idle = action.pose === "pummel" ? source.Sequences[73]! : stock.Sequences[1]!;
            const idleTrack = action.pose === "pummel" ? targetTracks.get(path)! : donorTrack;
            const idleValue = idleTrack.Keys.some(k => k.Frame >= idle.Interval[0] && k.Frame <= idle.Interval[1]) ? valueAt(idleTrack, idle.Interval[0], idle.Interval[1], idle.Interval[0], rotation) : undefined;
            for (let frame = 0; frame <= action.frames; frame++) {
                let vector = valueAt(donorTrack, donor.Interval[0], donor.Interval[1], donorTime(frame), rotation);
                const entry = Math.min(3, action.first - 1), exit = Math.min(8, action.frames - action.last - 1);
                const amount = frame < entry ? 1 - frame / entry : frame > action.frames - exit ? (frame - (action.frames - exit)) / exit : 0;
                if (idleValue && amount > 0) vector = rotation ? Float32Array.from(quat.slerp(quat.create(), vector, idleValue, amount * amount * (3 - 2 * amount))) : Float32Array.from(vector, (v, i) => v + (idleValue[i]! - v) * amount * amount * (3 - 2 * amount));
                track.Keys.push(key(track, start + Math.round(frame * 1000 / 60), vector, rotation));
            }
            track.Keys.sort((a, b) => a.Frame - b.Frame);
        });
        if (["backAir", "neutralAir", "downSmash"].includes(action.pose)) {
            const spine = node("spine_C0_0_jnt");
            for (let frame = 0; frame <= action.frames; frame++) {
                const k = spine.Rotation!.Keys.find(k => k.Frame === start + Math.round(frame * 1000 / 60))!;
                const backFrame = action.pose === "backAir" ? action.first : action.targets.find(t => t.x < 0)!.frame;
                const turn = action.pose === "backAir" ? Math.min(1, frame / Math.max(1, action.first - 2)) : Math.max(0, Math.min(1, (frame - (backFrame - 3)) / 3));
                const exit = frame > action.last ? Math.max(0, 1 - (frame - action.last) / (action.frames - action.last)) : 1;
                Object.assign(k, key(spine.Rotation!, k.Frame, corrected(k.Vector as Float32Array, [0, 180 * turn * exit, 0]), true));
            }
        }
        const bases = [shoulder, elbow].map(joint => Array.from({ length: action.frames + 1 }, (_, frame) => joint.Rotation!.Keys.find(k => k.Frame === start + Math.round(frame * 1000 / 60))!.Vector.slice() as Float32Array));
        const solved: { frame: number; angles: number[] }[] = [];
        for (const target of action.targets) {
            const frame = target.frame, keys = [shoulder, elbow].map(joint => joint.Rotation!.Keys.find(k => k.Frame === start + Math.round(frame * 1000 / 60))!);
            const angles = solved.length ? [...solved[solved.length - 1]!.angles] : [0, 0, 0, 0, 0, 0];
            const loss = () => {
                keys.forEach((k, j) => { k.Vector = corrected(bases[j]![frame]!, angles.slice(j * 3, j * 3 + 3)); }); evaluate(index, frame);
                const p = vec3.transformMat4(vec3.create(), headInHand, data.nodes[hand.ObjectId].matrix);
                return (p[0] - target.x) ** 2 + (p[2] - target.z) ** 2 + 0.05 * (p[1] + 12) ** 2;
            };
            for (const step of [30, 10, 3]) for (let pass = 0; pass < 2; pass++) for (let axis = 0; axis < 6; axis++) {
                const center = angles[axis]!; let best = loss(), angle = center;
                for (let delta = -3; delta <= 3; delta++) { angles[axis] = center + delta * step; const score = loss(); if (score < best) { best = score; angle = angles[axis]!; } }
                angles[axis] = angle;
            }
            loss(); solved.push({ frame, angles });
        }
        const anchors = [{ frame: 0, angles: [0, 0, 0, 0, 0, 0] }, ...solved, { frame: action.frames, angles: [0, 0, 0, 0, 0, 0] }];
        for (let frame = 0; frame <= action.frames; frame++) {
            const left = [...anchors].reverse().find(a => a.frame <= frame)!, right = anchors.find(a => a.frame >= frame)!;
            const t = right.frame === left.frame ? 0 : (frame - left.frame) / (right.frame - left.frame), smooth = t * t * (3 - 2 * t);
            const angles = left.angles.map((a, i) => a + (right.angles[i]! - a) * smooth);
            [shoulder, elbow].forEach((joint, j) => { const k = joint.Rotation!.Keys.find(k => k.Frame === start + Math.round(frame * 1000 / 60))!; Object.assign(k, key(joint.Rotation!, k.Frame, corrected(bases[j]![frame]!, angles.slice(j * 3, j * 3 + 3)), true)); });
            evaluate(index, frame);
            const world = mat4.multiply(mat4.create(), data.nodes[hand.ObjectId].matrix, offset), local = mat4.create();
            ensure(mat4.invert(local, data.nodes[root.ObjectId].matrix), "Singular root"); mat4.multiply(local, local, world);
            const rotation = mat4.getRotation(quat.create(), local); quat.normalize(rotation, rotation);
            const pivot = model.PivotPoints[weapon.ObjectId]!, rotated = vec3.transformQuat(vec3.create(), pivot, rotation);
            const translation = Float32Array.from([local[12] - pivot[0]! + rotated[0], local[13] - pivot[1]! + rotated[1], local[14] - pivot[2]! + rotated[2]]);
            for (const [property, vector] of [["Rotation", Float32Array.from(rotation)], ["Translation", translation]] as const) {
                const track = weapon[property]!; const existing = track.Keys.find(k => k.Frame === start + Math.round(frame * 1000 / 60));
                const authored = key(track, start + Math.round(frame * 1000 / 60), vector, property === "Rotation"); if (existing) Object.assign(existing, authored); else track.Keys.push(authored);
            }
        }
        tracks(model, track => track.Keys.sort((a, b) => a.Frame - b.Frame));
        receipts.push({ pose: action.pose, index, donor: { index: action.donor, name: donor.Name, interval: [...donor.Interval] }, frames: action.frames, contact: [action.first, action.last], targets: action.targets });
    }
    const originalTracks = new Map<string, mdx.AnimVector>(); tracks(source, (track, path) => originalTracks.set(path, track));
    let preserved = 0;
    tracks(model, (track, path) => {
        const original = originalTracks.get(path); ensure(original, `Unexpected track ${path}`);
        for (let index = 0; index < model.Sequences.length; index++) if (!changed.has(index)) {
            const [first, last] = model.Sequences[index]!.Interval;
            ensure(isDeepStrictEqual(track.Keys.filter(k => k.Frame >= first && k.Frame <= last), original.Keys.filter(k => k.Frame >= first && k.Frame <= last)), `${path}: unrelated clip ${index} changed`); preserved++;
        }
    });
    const bytes = generateHdBody(model); ensure(isDeepStrictEqual(model, parseHdBody(bytes)), "Weapon model round trip changed data");
    await Bun.write(join(output, "heroforsakenpaladin.mdx"), bytes);
    const drawn = new DrawnModel(bytes, 1.2);
    for (const action of actions) {
        const index = FORSAKEN_PALADIN_CLIPS[action.pose as keyof typeof FORSAKEN_PALADIN_CLIPS].index;
        const panels: PoseFrame[] = [1, -1].flatMap(facing => [0, Math.max(1, action.first - 3), action.first, action.last, Math.min(action.frames, action.last + 5), action.frames].map(frame => ({ frame, phase: frame < action.first ? AttackPhase.startup : frame <= action.last ? AttackPhase.active : AttackPhase.recovery, x: 0, z: 0, facing, parts: [], strikes: [], clip: index, seconds: frame / 60 })));
        await Bun.write(join(output, `${action.pose}.png`), sheet(`Forsaken hammer ${action.pose}`, drawn, panels, 6).png);
    }
    const contact = receipts.map(record => ({ ...record, measured: record.targets.map(target => { const posed = drawn.posed(record.index, target.frame / 60, 1); const x = posed.nodes[reference.ObjectId * 2]!, z = posed.nodes[reference.ObjectId * 2 + 1]!; return { frame: target.frame, x, z, targetX: target.x * 1.2, targetZ: target.z * 1.2, error: Math.hypot(x - target.x * 1.2, z - target.z * 1.2) }; }) }));
    const geometry: string[] = [], changes = [];
    for (const action of actions) {
        if (action.pose === "pummel") continue;
        const normal = normalDonors.find(([pose]) => pose === action.pose);
        const name = action.pose.replace("SpecialAir", "").replace("Special", "") as "neutral" | "side" | "up" | "down";
        const special = normal ? undefined : FORSAKEN_PALADIN_SPECIALS[name]!;
        const form = special ? action.pose.endsWith("Air") ? special.air ?? special.ground : special.ground : undefined;
        const regions = normal ? FORSAKEN_PALADIN_MOVES.normals[normal[1]]!.regions : form?.regions ?? [];
        const index = FORSAKEN_PALADIN_CLIPS[action.pose as keyof typeof FORSAKEN_PALADIN_CLIPS].index;
        for (const [ordinal, region] of regions.entries()) for (let frame = region.firstFrame; frame <= region.lastFrame; frame++) {
            const posed = drawn.posed(index, frame / 60, 1), old = region.hit.strike!;
            const hx = posed.nodes[reference.ObjectId * 2]!, hz = posed.nodes[reference.ObjectId * 2 + 1]!;
            const gx = posed.nodes[weapon.ObjectId * 2]!, gz = posed.nodes[weapon.ObjectId * 2 + 1]!;
            const headOnly = old.x1 === old.x2 && old.z1 === old.z2, handle = action.pose === "forwardSmash" && ordinal >= 3;
            const coordinates = [headOnly ? hx : gx, headOnly ? hz : gz, handle ? gx + (hx - gx) * 0.75 : hx, handle ? gz + (hz - gz) * 0.75 : hz].map(value => Math.fround(Math.round(value * 10) / 10));
            geometry.push(`  ${JSON.stringify(`${action.pose}:${ordinal}:${frame}`)}: [${coordinates.map(v => `f32(${v})`).join(", ")}],`);
            changes.push({ pose: action.pose, frame, region: ordinal, old, new: { x1: coordinates[0], z1: coordinates[1], x2: coordinates[2], z2: coordinates[3], radius: old.radius } });
        }
    }
    await Bun.write(join(import.meta.dir, "../../ts/src/game/sim/heroes/forsakenPaladinWeaponGeometry.ts"), [
        'import { f32 } from "wisp/src/sim/f32";',
        'import { heroRegion, type MoveRegion } from "../heroMoves";',
        'const CONTACTS: Readonly<Record<string, readonly [number, number, number, number]>> = {', ...geometry, '};',
        'export function forsakenWeaponRegions(pose: string, regions: readonly MoveRegion[]): readonly MoveRegion[] {',
        '  const output: MoveRegion[] = [];',
        '  for (let ordinal = 0; ordinal < regions.length; ordinal++) {',
        '    const region = regions[ordinal]; if (region === undefined) continue;',
        '    for (let frame = region.firstFrame; frame <= region.lastFrame; frame++) {',
        '      const contact = CONTACTS[`${pose}:${ordinal}:${frame}`], strike = region.hit.strike;',
        '      if (contact === undefined || strike === undefined) { output.push(region); break; }',
        '      output.push(heroRegion(frame + 1, frame + 1, { x1: contact[0], z1: contact[1], x2: contact[2], z2: contact[3], radius: strike.radius }, region.hit.effect, region.hit.groundedEffect, region.hit.window));',
        '    }', '  }', '  return output;', '}', ''
    ].join("\n"));
    await Bun.write(join(output, "weapon-region-changes.json"), JSON.stringify({ timingChanges: [], damageChanges: [], launchChanges: [], changes }, null, 2) + "\n");
    await Bun.write(join(output, "weapon-clips.json"), JSON.stringify({ preservedTrackIntervals: preserved, changed: [...changed], records: contact }, null, 2) + "\n");
    console.log(JSON.stringify({ changed: changed.size, preservedTrackIntervals: preserved, maxContactError: Math.max(...contact.flatMap(r => r.measured.map(m => m.error))), output }));
}, catch: cause => new WeaponFailure({ cause }) }));
