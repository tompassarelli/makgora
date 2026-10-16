import { model as mdx } from '../../ts/scripts/clipNodes';

export function danglingMaterials(model: mdx.Model): string[] {
    const count = model.Materials.length, dangling: string[] = [];
    model.Geosets.forEach((geoset, index) => { if (!(geoset.MaterialID < count)) dangling.push(`geoset ${index} material ${geoset.MaterialID}`); });
    for (const emitter of [...model.RibbonEmitters, ...model.ParticleEmitters2, ...(model.ParticleEmitterPopcorns ?? [])]) {
        const material = (emitter as { MaterialID?: number }).MaterialID;
        if (material !== undefined && !(material < count)) dangling.push(`${emitter.Name} material ${material}`);
    }
    return dangling;
}

export function checkMaterialReferences(label: string, model: mdx.Model) {
    const dangling = danglingMaterials(model);
    if (dangling.length > 0) throw new Error(`${label}: ${dangling.join(', ')} past its ${model.Materials.length} materials`);
}
