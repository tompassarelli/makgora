import { join } from 'node:path';
import { readdirSync } from 'node:fs';
import { fighters, parseSource } from '../tools/animations/original-clips';
import { thinKeys } from '../ts/scripts/keyThin';
import { flashableSequences } from '../tools/animations/white-flash-keys';
import { ModelRenderer, model as mdx } from '../ts/scripts/clipNodes';

const [assets, only] = process.argv.slice(2);
const family = join(assets, 'original-clips-static-lights/imports/war3mapImported');
const files = readdirSync(family);
function alphaOf(model: mdx.Model) {
  const r = new ModelRenderer(model); const find = Reflect.get(r, 'findAlpha') as Function;
  return (seq: number, frame: number, g: number) => { r.setSequence(seq); r.setFrame(frame); return find.call(r, g) as number; };
}
const glow = (model: mdx.Model, g: mdx.Geoset) => { const m = model.Materials[g.MaterialID];
  return m.Layers.every(l => l.FilterMode === mdx.FilterMode.Additive || l.FilterMode === mdx.FilterMode.AddAlpha)
    || m.Layers.some(l => typeof l.TextureID === 'number' && model.Textures[l.TextureID]?.ReplaceableId === 2); };
for (const [character, f] of fighters) {
  if (only && f.name !== only) continue;
  const tfile = files.find(x => x.startsWith(`${f.name}TimelineBody-`));
  if (!tfile) { console.log(`${f.name}: no timeline body`); continue; }
  const source = thinKeys(parseSource(await Bun.file(join(assets, f.source)).arrayBuffer())).model;
  const body = parseSource(await Bun.file(join(family, tfile)).arrayBuffer());
  const played = flashableSequences(character, source.Sequences);
  const sa = alphaOf(source), ba = alphaOf(body);
  const lines: string[] = [];
  for (const [i, g] of source.Geosets.entries()) {
    if (!glow(source, g)) continue;
    const m = source.Materials[g.MaterialID];
    let stockMax = 0, stockMin = 1, bodyMin = 1, bodyMax = 0, mismatch = 0, n = 0; const seqVis: string[] = [];
    for (const s of played) { const si = source.Sequences.indexOf(s); for (let fr = s.Interval[0]; ; fr = Math.min(s.Interval[1], fr + 1000/60)) {
      const a = sa(si, fr, i); n++; stockMax = Math.max(stockMax, a); stockMin = Math.min(stockMin, a); const b = ba(0, fr, i); if ((a > 0) !== (b > 0)) mismatch++; bodyMin = Math.min(bodyMin, b); bodyMax = Math.max(bodyMax, b); if (fr === s.Interval[1]) break; } }
    const v = g.Vertices; const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (let k = 0; k < v.length; k++) { mn[k%3] = Math.min(mn[k%3], v[k]); mx[k%3] = Math.max(mx[k%3], v[k]); }
    const modes = m.Layers.map(l => `${mdx.FilterMode[l.FilterMode]}${typeof l.TextureID === 'number' ? `/rid${source.Textures[l.TextureID]?.ReplaceableId}:${source.Textures[l.TextureID]?.Image}` : ''}`).join('+');
    const flag = stockMax === 0 && bodyMax > 0 ? ' HIDDEN-IN-STOCK-VISIBLE-IN-BODY' : '';
    lines.push(`  g${i} ${modes} tris=${g.Faces.length/3} ext=[${mn.map(x=>x.toFixed(0))}]..[${mx.map(x=>x.toFixed(0))}] stockAlpha=${stockMin.toFixed(2)}..${stockMax.toFixed(2)} mismatchFrames=${mismatch}/${n} bodyAlpha=${bodyMin.toFixed(2)}..${bodyMax.toFixed(2)}${flag}`);
  }
  console.log(`${f.name} (${source.Geosets.length} geosets, ${played.length} played; body ${tfile.slice(0, 40)}…)`); for (const l of lines) console.log(l);
}
