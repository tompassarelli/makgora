import { join } from 'node:path';
import { fighters, parseSource } from '../tools/animations/original-clips';
import { teamGlowGeosets } from '../tools/animations/timeline-geosets';
const [assets] = process.argv.slice(2);
for (const [, f] of fighters) {
  const m = parseSource(await Bun.file(join(assets, f.source)).arrayBuffer());
  for (const g of teamGlowGeosets(m)) {
    const modes = m.Materials[m.Geosets[g].MaterialID].Layers.map(l => l.FilterMode);
    if (modes.some(x => x <= 2)) console.log(`${f.name} g${g} modes ${modes}`);
  }
}
console.log('END');
