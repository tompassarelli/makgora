import { ModelRenderer, model as mdx } from 'war3-model';
import { transforms } from './modelTracks';

const at = (values: ArrayLike<number>, i: number): number => values[i] ?? 0;

function nodeMatrices(renderer: ModelRenderer): readonly { readonly matrix: Float32Array }[] {
    const data: unknown = Reflect.get(renderer, 'rendererData');
    const nodes: unknown = typeof data === 'object' && data !== null ? Reflect.get(data, 'nodes') : undefined;
    if (!Array.isArray(nodes)) throw new Error('war3-model renderer has no posed nodes');
    return nodes;
}

function setFrame(renderer: ModelRenderer, frame: number): void {
    Reflect.set(Reflect.get(renderer, 'rendererData'), 'frame', frame);
    renderer.update(0);
}


const axesA = new Float64Array(9), axesB = new Float64Array(9);
function unitColumns(m: Float32Array, axes: Float64Array): boolean {
    for (let c = 0; c < 3; c++) {
        const x = at(m, c * 4), y = at(m, c * 4 + 1), z = at(m, c * 4 + 2), length = Math.hypot(x, y, z);
        if (length < 1e-4) return false;
        axes[c * 3] = x / length; axes[c * 3 + 1] = y / length; axes[c * 3 + 2] = z / length;
    }
    return true;
}

function rotationAngle(a: Float32Array, b: Float32Array): number | undefined {
    const okA = unitColumns(a, axesA), okB = unitColumns(b, axesB);
    if (!okA || !okB) return undefined;
    const r = (i: number, j: number) => 0 + at(axesA, i * 3) * at(axesB, j * 3) + at(axesA, i * 3 + 1) * at(axesB, j * 3 + 1) + at(axesA, i * 3 + 2) * at(axesB, j * 3 + 2);
    const sin = Math.hypot(r(2, 1) - r(1, 2), r(0, 2) - r(2, 0), r(1, 0) - r(0, 1)) / 2;
    return Math.atan2(sin, (r(0, 0) + r(1, 1) + r(2, 2) - 1) / 2) * 180 / Math.PI;
}

const sameMatrix = (a: Float32Array, b: Float32Array) => {
    for (let index = 0; index < 16; index++) if (a[index] !== b[index]) return false;
    return true;
};


export interface SequenceError { readonly maxPosition: number, readonly maxRotationDegrees: number, readonly samples: number, readonly worstFrame: number, readonly worstNode: number }

export const sampleFrames = (source: mdx.Model) => {
    const frames = new Set<number>();
    transforms(source, track => { for (const key of track.Keys) frames.add(key.Frame); });
    const sorted = [...frames].sort((a, b) => a - b);
    return (sequence: mdx.Sequence) => {
        const [start, end] = [at(sequence.Interval, 0), at(sequence.Interval, 1)];
        const inside = [start, ...sorted.filter(frame => frame > start && frame < end), end];
        return inside.flatMap((frame, i) => i === 0 ? [frame] : [((inside[i - 1] ?? frame) + frame) / 2, frame]);
    };
};

export function sequenceErrors(source: mdx.Model, candidate: mdx.Model, indices: readonly number[]): SequenceError[] {
    const before = new ModelRenderer(source), after = new ModelRenderer(candidate), samplesOf = sampleFrames(source);
    const nodes = source.Nodes.filter(node => node != null);
    return indices.map(index => {
        let maxPosition = 0, maxRotationDegrees = 0, samples = 0, worstFrame = 0, worstNode = -1;
        before.setSequence(index); after.setSequence(index);
        for (const frame of samplesOf(source.Sequences[index]!)) {
            setFrame(before, frame); setFrame(after, frame);
            const a = nodeMatrices(before), b = nodeMatrices(after);
            nodes.forEach((node, nodeIndex) => {
                const ma = a[node.ObjectId]?.matrix, mb = b[node.ObjectId]?.matrix;
                if (ma === undefined || mb === undefined || sameMatrix(ma, mb)) return;
                const p = source.PivotPoints[node.ObjectId] ?? new Float32Array(3);
                let squared = 0;
                for (let row = 0; row < 3; row++) {
                    const d = (at(ma, row) - at(mb, row)) * at(p, 0) + (at(ma, 4 + row) - at(mb, 4 + row)) * at(p, 1) + (at(ma, 8 + row) - at(mb, 8 + row)) * at(p, 2) + at(ma, 12 + row) - at(mb, 12 + row);
                    squared += d * d;
                }
                if (Math.sqrt(squared) > maxPosition) { worstFrame = frame; worstNode = nodeIndex; }
                maxPosition = Math.max(maxPosition, Math.sqrt(squared));
                maxRotationDegrees = Math.max(maxRotationDegrees, rotationAngle(ma, mb) ?? 0);
            });
            samples++;
        }
        return { maxPosition, maxRotationDegrees, samples, worstFrame, worstNode };
    });
}
