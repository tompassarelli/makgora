import { ModelRenderer, model as mdx } from 'war3-model';
import { bodyJoint } from './victoryJoints';

export const RAISED_FRAME = 28;
export const UPRIGHT_LIMIT_DEGREES = 30;

/** The pelvis-to-head line's angle from vertical, in degrees, at a moment of one sequence. */
export function torsoLean(model: mdx.Model, sequence: number, milliseconds: number, renderer = new ModelRenderer(model)): number {
    const data = Reflect.get(renderer, 'rendererData');
    renderer.setSequence(sequence);
    data.frame = model.Sequences[sequence]!.Interval[0]! + milliseconds;
    renderer.update(0);
    const at = (role: 'pelvis' | 'head') => {
        const node = bodyJoint(model, role);
        if (node === undefined) throw new Error(`${role} missing`);
        const matrix = data.nodes[node.ObjectId].matrix, pivot = model.PivotPoints[node.ObjectId]!;
        return [0, 1, 2].map(row => matrix[row] * pivot[0]! + matrix[4 + row] * pivot[1]! + matrix[8 + row] * pivot[2]! + matrix[12 + row]);
    };
    const [pelvis, head] = [at('pelvis'), at('head')];
    return Math.atan2(Math.hypot(head[0]! - pelvis[0]!, head[1]! - pelvis[1]!), head[2]! - pelvis[2]!) * 180 / Math.PI;
}
