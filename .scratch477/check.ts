import { join } from 'node:path';
import { encodeVerified, fighters, parseSource } from '../tools/animations/original-clips';
import { timelineBody } from '../tools/animations/timeline-body';
import { checkTimelineGeosets, teamGlowGeosets } from '../tools/animations/timeline-geosets';
import { thinKeys } from '../ts/scripts/keyThin';
import { flashableSequences } from '../tools/animations/white-flash-keys';
const [assets, only] = process.argv.slice(2);
let failed = 0;
for (const [character, f] of fighters) {
  if (only && f.name !== only) continue;
  try {
    const source = thinKeys(parseSource(await Bun.file(join(assets, f.source)).arrayBuffer())).model;
    const played = flashableSequences(character, source.Sequences);
    const bytes = encodeVerified(timelineBody(source, played));
    console.log(`${f.name}: drop [${[...teamGlowGeosets(source)]}] ${JSON.stringify(checkTimelineGeosets(source, parseSource(bytes), played))}`);
  } catch (e) { failed++; console.log(`${f.name}: FAIL ${e instanceof Error ? e.message + ' ' + (e.cause instanceof Error ? e.cause.message : '') : e}`); }
}
console.log(`DONE failed=${failed}`);
