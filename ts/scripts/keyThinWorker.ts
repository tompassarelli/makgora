import type { model as mdx } from 'war3-model';
import { THIN_STATUS, type ThinSetup, keepMask, keyTracks, sequenceErrors, thinnableTracks } from './keyThin';

declare const self: Worker;

let setup: ThinSetup | undefined, candidate: mdx.Model | undefined, pristine: readonly mdx.AnimKeyframe[][] = [];

const attempt = (scale: number) => {
    if (setup === undefined || candidate === undefined) throw new Error('A key thinning worker got a scale before its source');
    const { source, bound, indices, workers, order, offsets, masks, results, counts, status } = setup, progress = new Int32Array(status), view = new Uint8Array(masks);
    const tracks = thinnableTracks(source, bound, scale);
    for (let next = Atomics.add(progress, THIN_STATUS.cursor, 1); next < order.length; next = Atomics.add(progress, THIN_STATUS.cursor, 1)) {
        const index = order[next]!, thinnable = tracks[index]!, offset = offsets[index]!, keep = keepMask(thinnable, source.Sequences);
        thinnable.track.Keys.forEach((_, key) => { view[offset + key] = keep === undefined || keep[key] ? 1 : 0; });
    }
    Atomics.add(progress, THIN_STATUS.masked, 1);
    Atomics.notify(progress, THIN_STATUS.masked);
    for (let masked = Atomics.load(progress, THIN_STATUS.masked); masked + Atomics.load(progress, THIN_STATUS.failed) < workers; masked = Atomics.load(progress, THIN_STATUS.masked)) Atomics.wait(progress, THIN_STATUS.masked, masked, 1000);
    if (Atomics.load(progress, THIN_STATUS.failed) > 0) return;
    keyTracks(candidate).forEach((track, index) => { track.Keys = pristine[index]!.filter((_, key) => view[offsets[index]! + key] === 1); });
    const values = new Float64Array(results), integers = new Int32Array(counts);
    sequenceErrors(source, candidate, indices).forEach((error, position) => {
        const index = indices[position]!;
        values.set([error.maxPosition, error.maxRotationDegrees, error.worstFrame], index * 3);
        integers.set([error.samples, error.worstNode], index * 2);
    });
};

self.onmessage = (event: MessageEvent<ThinSetup | { scale: number }>) => {
    if ('source' in event.data) {
        setup = event.data;
        candidate = structuredClone(setup.source);
        pristine = keyTracks(candidate).map(track => track.Keys);
        return;
    }
    const progress = setup === undefined ? undefined : new Int32Array(setup.status);
    try {
        attempt(event.data.scale);
    } catch (cause) {
        console.error(cause);
        if (progress !== undefined) { Atomics.add(progress, THIN_STATUS.failed, 1); Atomics.notify(progress, THIN_STATUS.masked); }
    } finally {
        if (progress !== undefined) { Atomics.add(progress, THIN_STATUS.finished, 1); Atomics.notify(progress, THIN_STATUS.finished); }
    }
};
