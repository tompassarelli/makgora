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

/** Reads the body's joint pivots from whatever pose `renderer` last evaluated, carrying each elbow's hinge from the stand pose on its upper arm, and how far each shoulder seam has opened. */
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
    const seams = shoulderSeams(model, data, arms.map(([shoulder]) => shoulder!), pivot);
    return () => {
        const now = seams.map(seam => seam.opening());
        return {
            pelvis: pivot(pelvis),
            arms: arms.map(([shoulder, elbow, hand], side) => ({
                shoulder: pivot(shoulder!), elbow: pivot(elbow!), hand: pivot(hand!),
                hinge: Array.from(vec3.transformMat3(vec3.create(), hinges[side]!, turn(shoulder!)), v => round(v, 4)) as unknown as Point,
                seam: round(now[side]!, 3),
            })) as unknown as BodyPose['arms'],
        };
    };
}

const SEAM_REACH = 0.6, SEAM_PAIRS = 3, SEAM_PERCENTILE = 0.1;

/** Pairs each vertex skinned only below a shoulder and within `SEAM_REACH` shoulder widths of it with its nearest vertex skinned to neither arm, in the stand pose the renderer holds, and measures how far those pairs have drawn apart in the pose it holds when asked. */
function shoulderSeams(model: mdx.Model, data: { nodes: { matrix: ArrayLike<number> }[] }, shoulders: readonly mdx.Node[], pivot: (joint: mdx.Node) => Point) {
    const below = (ancestor: mdx.Node) => new Set(model.Nodes.flatMap(each => { for (let at: mdx.Node | undefined = each; at !== undefined; at = at.Parent != null && at.Parent >= 0 ? model.Nodes[at.Parent] : undefined) if (at === ancestor) return [each.ObjectId]; return []; }));
    const limbs = shoulders.map(below);
    const vertices = model.Geosets.flatMap(geoset => Array.from({ length: geoset.Vertices.length / 3 }, (_, vertex) => {
        const skin = geoset.SkinWeights;
        const influences = skin === undefined ? Array.from(geoset.Groups[geoset.VertexGroup[vertex]!] ?? [], node => ({ node, weight: 1 })) : [0, 1, 2, 3].map(at => ({ node: skin[vertex * 8 + at]!, weight: skin[vertex * 8 + 4 + at]! / 255 })).filter(({ weight }) => weight > 0);
        return { at: geoset.Vertices.subarray(vertex * 3, vertex * 3 + 3), influences };
    })).filter(({ influences }) => influences.length > 0);
    const place = ({ at, influences }: typeof vertices[number]): Point => {
        const total = influences.reduce((sum, { weight }) => sum + weight, 0);
        return [0, 1, 2].map(r => influences.reduce((sum, { node, weight }) => { const m = data.nodes[node]!.matrix; return sum + (m[r]! * at[0]! + m[4 + r]! * at[1]! + m[8 + r]! * at[2]! + m[12 + r]!) * weight; }, 0) / total) as unknown as Point;
    };
    const distance = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    const pivots = shoulders.map(pivot), span = distance(pivots[0]!, pivots[1]!), rest = vertices.map(place);
    return limbs.map((limb, side) => {
        const near = (index: number) => distance(rest[index]!, pivots[side]!) < span * SEAM_REACH;
        const arm = vertices.flatMap(({ influences }, index) => influences.every(({ node }) => limb.has(node)) && near(index) ? [index] : []);
        const torso = vertices.flatMap(({ influences }, index) => influences.every(({ node }) => !limbs.some(each => each.has(node))) && near(index) ? [index] : []);
        const pairs = torso.length === 0 ? [] : arm.map(index => { const nearest = torso.reduce((best, each) => distance(rest[index]!, rest[each]!) < distance(rest[index]!, rest[best]!) ? each : best); return { arm: index, torso: nearest, gap: distance(rest[index]!, rest[nearest]!) }; });
        return {
            opening: () => {
                if (pairs.length < SEAM_PAIRS) return 0;
                const openings = pairs.map(pair => (distance(place(vertices[pair.arm]!), place(vertices[pair.torso]!)) - pair.gap) / span).sort((a, b) => a - b);
                return openings[Math.floor(openings.length * SEAM_PERCENTILE)]!;
            },
        };
    });
}
