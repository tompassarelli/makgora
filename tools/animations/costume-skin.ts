import { isDeepStrictEqual } from 'node:util';
import { model as mdx } from '../../ts/scripts/clipNodes';

/** A costume's stock texture swaps, `from` path to `to` path, compared without case or slash direction. */
export interface CostumeSkin { readonly index: number; readonly textures: Readonly<Record<string, string>> }

const texturePath = (path: string) => path.replaceAll('/', '\\').toLowerCase();

/**
 * The body in a costume skin: every layer drawing a swapped texture draws its replacement, a layer that then repeats an
 * earlier layer's texture in the same material is dropped. Only Materials change, and Textures only gain a replacement
 * the body lacked, so the body keeps its skeleton, mesh and every animation key.
 */
export function skinnedBody(body: mdx.Model, skin: CostumeSkin): mdx.Model {
    const model = structuredClone(body);
    const swaps = Object.entries(skin.textures);
    const indexOf = (path: string) => model.Textures.findIndex(texture => texture.ReplaceableId === 0 && texturePath(texture.Image) === path);
    const replaced = new Map<number, number>();
    for (const [from, to] of swaps) {
        const source = indexOf(texturePath(from));
        if (source < 0) throw new Error(`skin ${skin.index}: the body has no texture ${from}`);
        let target = indexOf(texturePath(to));
        if (target < 0) target = model.Textures.push({ ...model.Textures[source]!, Image: to }) - 1;
        replaced.set(source, target);
    }
    for (const material of model.Materials) {
        const drawn = new Set<number>();
        material.Layers = material.Layers.flatMap(layer => {
            if (typeof layer.TextureID !== 'number') {
                if (layer.TextureID?.Keys.some(key => replaced.has(key.Vector[0]!))) throw new Error(`skin ${skin.index}: a flipbook layer draws a swapped texture`);
                return [layer];
            }
            const texture = replaced.get(layer.TextureID) ?? layer.TextureID;
            if (drawn.has(texture)) return [];
            drawn.add(texture);
            return [{ ...layer, TextureID: texture }];
        });
    }
    for (const key of Object.keys(body) as (keyof mdx.Model)[]) {
        if (key === 'Materials') continue;
        if (!isDeepStrictEqual(key === 'Textures' ? body.Textures : body[key], key === 'Textures' ? model.Textures.slice(0, body.Textures.length) : model[key])) throw new Error(`skin ${skin.index}: the skinned body changed ${key}`);
    }
    return model;
}
