import { model as mdx, parseMDX, generateMDX } from '../../ts/scripts/clipNodes';
import { skinChunks } from '../../ts/scripts/mdxCodec';

/** Match bodies use no camera; version 1800's camera record extends the old layout. */
export function parseHdBody(bytes: ArrayBuffer): mdx.Model {
    return parseMDX(skinChunks(bytes, false, true));
}

export function generateHdBody(model: mdx.Model): ArrayBuffer {
    return skinChunks(generateMDX(model), true, true);
}
