import { expect, test } from 'bun:test';
import type { model as mdx } from '../scripts/clipNodes';
import { checkMaterialReferences, danglingMaterials } from '../../tools/animations/material-references';

const body = (ribbonMaterial: number) => ({
  Materials: [{ Layers: [] }],
  Geosets: [{ MaterialID: 0 }],
  RibbonEmitters: [{ Name: 'trail', MaterialID: ribbonMaterial }],
  ParticleEmitters2: [],
}) as unknown as mdx.Model;

test('a timeline body whose ribbon points past its material list is refused, one whose ribbon holds a material is not [k2 property]', () => {
  expect(danglingMaterials(body(0))).toEqual([]);
  expect(danglingMaterials(body(2))).toEqual(['trail material 2']);
  expect(() => checkMaterialReferences('Warden Definitive', body(2))).toThrow('trail material 2 past its 1 materials');
  expect(() => checkMaterialReferences('Warden Definitive', body(0))).not.toThrow();
});
