import { expect, test } from "bun:test";
import { STAGE_DECK_PALETTES } from "../src/game/assets/stagePalette";
import { platformDeckFaces, platformDeckMdl } from "../scripts/stageMaterials";

test("each face of a raised deck samples one texture cell, so a cropped atlas region shows no seam where its edges would meet mid-platform and pull in the neighbouring atlas art [k2 property]", () => {
  const faces = platformDeckFaces();
  for (const { theme, palette, materials } of STAGE_DECK_PALETTES) {
    if (materials === undefined) continue;
    for (const platform of [materials.platform, materials.alternatePlatform]) {
      if (platform === undefined) continue;
      const counts = [...platformDeckMdl(platform, palette).matchAll(/\bVertices (\d+)/g)].map(match => Number(match[1]));
      expect(counts, theme).toEqual([0, 1, 2, 3].map(material => 4 * faces.filter(face => face.material === material).length));
    }
  }
});
