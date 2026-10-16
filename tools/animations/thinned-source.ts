import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { deserialize, serialize } from 'bun:jsc';
import { ImportGraph } from '../../ts/node_modules/wisp/scripts/wisp/importGraph';
import { INPUTS_STORE } from '../../ts/scripts/wisp/buildInputs';
import type { model as mdx } from '../../ts/scripts/clipNodes';
import { parseModelMDX } from '../../ts/scripts/mdxCodec';
import { thinKeys, type KeyThinReport } from '../../ts/scripts/keyThin';

const project = resolve(import.meta.dir, '../..');
export const THINNED_STORE = join(INPUTS_STORE, 'derived/thinned');

let implementation: string | undefined;
function thinImplementation(): string {
    if (implementation !== undefined) return implementation;
    const entry = join(project, 'tools/animations/thinned-source.ts'), graph = new ImportGraph(project);
    graph.add([entry]);
    const hasher = new Bun.CryptoHasher('sha256');
    for (const path of [...graph.dependencies(entry), join(project, 'ts/bun.lock')].sort()) hasher.update(relative(project, path)).update('\0').update(readFileSync(path)).update('\0');
    return implementation = hasher.digest('hex');
}

export function thinnedModel(sourceBytes: ArrayBuffer, store = THINNED_STORE): { model: mdx.Model, report: KeyThinReport } {
    const key = new Bun.CryptoHasher('sha256').update(thinImplementation()).update('\0').update(new Uint8Array(sourceBytes)).digest('hex');
    const path = join(store, `${key}.bin`);
    if (existsSync(path)) return deserialize(readFileSync(path));
    const thin = thinKeys(parseModelMDX(sourceBytes));
    mkdirSync(dirname(path), { recursive: true });
    const staging = `${path}.${process.pid}.next`;
    writeFileSync(staging, new Uint8Array(serialize(thin)));
    chmodSync(staging, 0o444);
    renameSync(staging, path);
    return thin;
}
