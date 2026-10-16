import type { model as mdx } from 'war3-model';
import { sequenceErrors } from './keyThin';

declare const self: Worker;

self.onmessage = (event: MessageEvent<{ source: mdx.Model, candidate: mdx.Model, indices: readonly number[], results: SharedArrayBuffer, counts: SharedArrayBuffer, status: SharedArrayBuffer }>) => {
    const { source, candidate, indices, results, counts, status } = event.data, done = new Int32Array(status);
    try {
        const values = new Float64Array(results), integers = new Int32Array(counts);
        sequenceErrors(source, candidate, indices).forEach((error, position) => {
            const index = indices[position]!;
            values.set([error.maxPosition, error.maxRotationDegrees, error.worstFrame], index * 3);
            integers.set([error.samples, error.worstNode], index * 2);
        });
        Atomics.add(done, 0, 1);
    } catch (cause) {
        console.error(cause);
        Atomics.add(done, 1, 1);
    }
    Atomics.notify(done, 0);
};
