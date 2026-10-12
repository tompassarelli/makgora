import { join } from 'node:path';
import { fighters, parseSource } from '../tools/animations/original-clips';
import { teamGlowGeosets } from '../tools/animations/timeline-geosets';
const [assets] = process.argv.slice(2);
const hit: string[] = [];
for (const [, f] of fighters) {
  const source = parseSource(await Bun.file(join(assets, f.source)).arrayBuffer());
  const g = [...teamGlowGeosets(source)];
  if (g.length > 0) hit.push(`${f.name} [${g.join(',')}]`);
}
console.log(`fighters=${fighters.size} withTeamGlow=${hit.length}\n${hit.join('\n')}`);
