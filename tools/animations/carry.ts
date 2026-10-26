import type { model as mdx } from 'war3-model';
import { mat4, quat, vec3 } from 'gl-matrix';
import { ensure } from './original-clips';

type Pose = { readonly nodes: readonly { readonly matrix: mat4 }[] };

export function carryOffset(pose: Pose, hand: mdx.Node, node: mdx.Node): mat4 {
    const offset = mat4.invert(mat4.create(), pose.nodes[hand.ObjectId]!.matrix);
    ensure(offset, `${hand.Name}'s carry pose is singular`);
    return mat4.multiply(offset, offset, pose.nodes[node.ObjectId]!.matrix);
}

export function carriedKey(model: mdx.Model, pose: Pose, node: mdx.Node, hand: mdx.Node, offset: mat4): { readonly rotation: Float32Array<ArrayBuffer>; readonly translation: Float32Array<ArrayBuffer> } {
    const world = mat4.multiply(mat4.create(), pose.nodes[hand.ObjectId]!.matrix, offset);
    const parent = node.Parent == null || node.Parent === -1 ? undefined : pose.nodes[node.Parent];
    const inverse = parent === undefined ? mat4.create() : mat4.invert(mat4.create(), parent.matrix);
    ensure(inverse, `${node.Name}'s parent pose is singular`);
    const local = mat4.multiply(mat4.create(), inverse, world);
    const [x, y, z] = model.PivotPoints[node.ObjectId]!, p = vec3.fromValues(x!, y!, z!);
    const q = quat.normalize(quat.create(), mat4.getRotation(quat.create(), local)), v = vec3.transformQuat(vec3.create(), p, q);
    return { rotation: new Float32Array(q), translation: new Float32Array([local[12]! - p[0]! + v[0]!, local[13]! - p[1]! + v[1]!, local[14]! - p[2]! + v[2]!]) };
}
