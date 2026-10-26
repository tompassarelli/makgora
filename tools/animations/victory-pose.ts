import { type ModelRenderer, type model as mdx } from 'war3-model';
import { mat3, vec3 } from 'gl-matrix';
import { bodyJoint, limbJoint } from '../../ts/scripts/wisp/victoryJoints';
import type { BodyPose, Point } from '../../ts/scripts/wisp/victoryAnatomy';
import { ensure } from './original-clips';

const round = (value: number, places: number) => Math.round(value * 10 ** places) / 10 ** places;

export function standSequence(model: mdx.Model): number {
    const named = (test: (name: string) => boolean) => model.Sequences.findIndex(each => test(each.Name.trim().toLowerCase()));
    return [named(name => name === 'stand'), named(name => /^stand(\s*-?\s*1)?$/.test(name))].find(found => found >= 0) ?? -1;
}

/** Reads the body's joint pivots from whatever pose `renderer` last evaluated, carrying each elbow's hinge from the stand pose on its upper arm. */
export function bodyPoseReader(model: mdx.Model, renderer: ModelRenderer, name: string): () => BodyPose {
    const data = Reflect.get(renderer, 'rendererData');
    const node = (found: mdx.Node | undefined, what: string) => { ensure(found, `${name} has no ${what}; add its names to victoryJoints.ts`); return found; };
    const pelvis = node(bodyJoint(model, 'pelvis'), 'pelvis');
    const arms = ([0, 1] as const).map(side => (['shoulder', 'elbow', 'hand'] as const).map(kind => node(limbJoint(model, kind, side), `${kind} ${side}`)));
    const stand = standSequence(model);
    ensure(stand >= 0, `${name} has no Stand sequence`);
    const pivot = (joint: mdx.Node): Point => { const m = data.nodes[joint.ObjectId].matrix, p = model.PivotPoints[joint.ObjectId]!; return [0, 1, 2].map(r => round(m[r] * p[0]! + m[4 + r] * p[1]! + m[8 + r] * p[2]! + m[12 + r], 2)) as unknown as Point; };
    const turn = (joint: mdx.Node) => { const r = mat3.fromMat4(mat3.create(), data.nodes[joint.ObjectId].matrix); for (const c of [0, 3, 6]) { const n = Math.hypot(r[c]!, r[c + 1]!, r[c + 2]!); r[c]! /= n; r[c + 1]! /= n; r[c + 2]! /= n; } return r; };
    renderer.setSequence(stand); data.frame = model.Sequences[stand]!.Interval[0]!; renderer.update(0);
    const hinges = arms.map(([shoulder, elbow, hand], side) => {
        const [s, e, h] = [pivot(shoulder!), pivot(elbow!), pivot(hand!)];
        const axis = vec3.cross(vec3.create(), vec3.sub(vec3.create(), e, s), vec3.sub(vec3.create(), h, e));
        ensure(vec3.length(axis) / (vec3.distance(e, s) * vec3.distance(h, e)) > Math.sin(3 * Math.PI / 180), `${name}: the stand pose holds arm ${side} straight, so its elbow hinge is unknown`);
        return vec3.transformMat3(vec3.create(), vec3.normalize(axis, axis), mat3.transpose(mat3.create(), turn(shoulder!)));
    });
    return () => ({
        pelvis: pivot(pelvis),
        arms: arms.map(([shoulder, elbow, hand], side) => ({
            shoulder: pivot(shoulder!), elbow: pivot(elbow!), hand: pivot(hand!),
            hinge: Array.from(vec3.transformMat3(vec3.create(), hinges[side]!, turn(shoulder!)), v => round(v, 4)) as unknown as Point,
        })) as unknown as BodyPose['arms'],
    });
}
