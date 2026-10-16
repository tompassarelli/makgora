
import { model as mdx } from "war3-model";

// Warcraft draws team-glow and selection planes even at zero geoset alpha (#346).




export function teamGlowGeosets(model: mdx.Model): Set<number> {
    return new Set(model.Geosets.flatMap((geoset, index) => (model.Materials[geoset.MaterialID] as mdx.Material).Layers
        .some(layer => typeof layer.TextureID === 'number' && model.Textures[layer.TextureID]?.ReplaceableId === 2) ? [index] : []));
}

const HERO_GLOW_FLOOR_AREA = 2000;

// A fighter drawn as a special effect shows its hero glow's floor quads as white planes, while weapon team glow keeps its colour (#477, smashcraft#3).
export function heroGlowGeosets(model: mdx.Model): Set<number> {
    const glow = teamGlowGeosets(model);
    return new Set(model.Geosets.flatMap((geoset, index) => {
        if (!glow.has(index)) return [];
        const vertex = (corner: number, axis: number) => geoset.Vertices[corner * 3 + axis] ?? 0;
        for (let face = 0; face < geoset.Faces.length; face += 3) {
            const [a, b, c] = [0, 1, 2].map(offset => geoset.Faces[face + offset] ?? 0) as [number, number, number];
            const floorArea = Math.abs((vertex(b, 0) - vertex(a, 0)) * (vertex(c, 1) - vertex(a, 1)) - (vertex(c, 0) - vertex(a, 0)) * (vertex(b, 1) - vertex(a, 1))) / 2;
            if (floorArea >= HERO_GLOW_FLOOR_AREA) return [index];
        }
        return [];
    }));
}

export function groundPlaneGeosets(model: mdx.Model): number[] {
  return model.Geosets.flatMap((geoset, index) => {
    const vertices = geoset.Vertices;

    if (vertices.length === 0 || vertices.length > 16 * 3) return [];
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
    vertices.forEach((value, offset) => {
      if (offset % 3 === 0) { minX = Math.min(minX, value); maxX = Math.max(maxX, value); }
      else if (offset % 3 === 1) { minY = Math.min(minY, value); maxY = Math.max(maxY, value); }
      else { minZ = Math.min(minZ, value); maxZ = Math.max(maxZ, value); }
    });
    return maxX - minX >= 150 && maxY - minY >= 150 && maxZ - minZ <= 30 && minZ <= 40 ? [index] : [];
  });
}


export function removeGeosets(model: mdx.Model, removed: ReadonlySet<number>): void {
  const geosetIds = new Map<number, number>(), animationIds = new Map<number, number>();
  model.Geosets.forEach((_, index) => { if (!removed.has(index)) geosetIds.set(index, geosetIds.size); });
  model.GeosetAnims.forEach((animation, index) => { if (!removed.has(animation.GeosetId)) animationIds.set(index, animationIds.size); });
  model.Geosets = model.Geosets.filter((_, index) => geosetIds.has(index));
  model.GeosetAnims = model.GeosetAnims.filter((_, index) => animationIds.has(index));
  for (const animation of model.GeosetAnims) animation.GeosetId = geosetIds.get(animation.GeosetId) ?? animation.GeosetId;
  for (const bone of model.Bones) {

    const references: { GeosetId?: number | null; GeosetAnimId?: number | null } = bone;
    if (typeof references.GeosetId === "number" && references.GeosetId >= 0) references.GeosetId = geosetIds.get(references.GeosetId) ?? null;
    if (typeof references.GeosetAnimId === "number" && references.GeosetAnimId >= 0) references.GeosetAnimId = animationIds.get(references.GeosetAnimId) ?? null;
  }
}
