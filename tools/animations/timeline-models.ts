import { join, relative, resolve } from 'node:path';
import { existsSync, readdirSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { Effect } from 'effect';
import { hash, parseSource, tracks } from './original-clips';
import { fighters } from '../../ts/scripts/heroModelSource';
import { checkTimelineGeosets } from './timeline-geosets';
import { thinnedModel } from './thinned-source';
import { authoredMotion, fighterBodies, playedMoves } from './hd-models';
import { FIGHTER_RIGS } from './hd-rigs';
import { canonicalMotion } from './canonical-rig';
import { modelFacts } from '../../ts/node_modules/wisp/scripts/wisp/models';
import { replaceModelFacts, writeGenerated } from '../../ts/scripts/wisp/modelFactsTable';
import { DrawnModel } from '../../ts/scripts/wisp/hurtboxView';
import { headlessRender } from '../../ts/scripts/wisp/headlessRender';
import { fighterSlug } from '../../ts/src/game/sim/heroes/registry';
import { DEFINITIVE_FIGHTERS } from '../../ts/src/game/assets/definitiveFighters';
import type { Character } from '../../ts/src/game/sim/codes';
import { CLIPS } from './fighter-shards';
import { readClipRecords, writeClipRecord } from '../../ts/scripts/clipEvidence';

const [assetsArg, outputArg, fighterName] = process.argv.slice(2);
if (assetsArg === undefined || outputArg === undefined || fighterName === undefined) throw new Error('usage: bun tools/animations/timeline-models.ts PRIVATE_ASSETS PRIVATE_POOL FIGHTER');
const assets = resolve(assetsArg), output = resolve(outputArg);
if (!relative(resolve(import.meta.dir, '../..'), output).startsWith('..')) throw new Error('Timeline bodies stay in private storage');
const character = [...fighters].find(([, fighter]) => fighter.name === fighterName)?.[0];
if (character === undefined) throw new Error(`Unknown fighter ${fighterName}`);
const fighter = fighters.get(character)!, rig = FIGHTER_RIGS.get(character);
if (rig === undefined) throw new Error(`${fighter.name} has no canonical rig in hd-rigs`);

async function stockDefinitive(): Promise<ArrayBuffer | undefined> {
    if (!DEFINITIVE_FIGHTERS.has(character as Character)) return undefined;
    const stockName = (rig!.stockPath ?? '').replace(/^war3\.w3mod:_de\.w3mod:/, '').replaceAll('/', '\\');
    const resolved = await headlessRender({ assets, imports: [] }).resolveAsset(stockName, 'definitive');
    if (resolved.bytes === undefined || resolved.selected?.layer !== '_de.w3mod') throw new Error(`${fighter.name}: no stock Definitive ${stockName}`);
    return resolved.bytes.slice().buffer;
}

async function removeOtherBodies(directory: string, kept: string): Promise<void> {
    if (!existsSync(directory)) return;
    for (const file of readdirSync(directory)) if (file.startsWith(`${fighter.name}TimelineBody-`) && file !== kept) await unlink(join(directory, file));
}

await Effect.runPromise(Effect.tryPromise({ try: async () => {
    const authored = await Bun.file(join(assets, fighter.source)).arrayBuffer();
    const source = thinnedModel(authored).model;
    const played = playedMoves(character, source).classic.map(index => source.Sequences[index]!);
    const bodies = fighterBodies(authoredMotion(authored, rig), rig, await stockDefinitive(), undefined, canonicalMotion(source, rig));
    const bytes = bodies.classic;
    const geosets = checkTimelineGeosets(source, parseSource(bytes), played);
    console.log(`TIMELINE_GEOSETS_PASS ${fighter.name}: ${JSON.stringify(geosets)}`);
    tracks(parseSource(bytes), (track, path) => {
        if (track.Keys.length === 0) throw new Error(`${fighter.name}: timeline body left ${path} without keys`);
    });
    const reference = readClipRecords(join(assets, 'original-clips-static-lights')).find((record: { fighter: string }) => record.fighter === fighter.name);
    if (reference === undefined) throw new Error(`Missing clip-pool reference for ${fighter.name}`);
    const timeline = new DrawnModel(bytes, 1);
    let samples = 0, maximumDifference = 0;
    for (const sequence of played) {
        const index = source.Sequences.indexOf(sequence), clip = reference.clips[index];
        const pool = new DrawnModel(await Bun.file(join(assets, 'original-clips-static-lights/imports/war3mapImported', clip.filename)).arrayBuffer(), 1);
        const duration = (sequence.Interval[1] - sequence.Interval[0]) / 1000;
        for (let frame = 0; frame <= Math.ceil(duration * 60); frame++) for (const facing of [-1, 1]) {
            const localMilliseconds = Math.min(sequence.Interval[1] - sequence.Interval[0], frame * 1000 / 60);
            const expected = pool.triangles(0, ((clip.timeline ? sequence.Interval[0] : 0) + localMilliseconds) / 1000, facing);
            const actual = timeline.triangles(0, (sequence.Interval[0] + localMilliseconds) / 1000, facing);
            if (actual.length !== expected.length) throw new Error(`${fighter.name}/${index} frame ${frame}: visible triangle count changed`);
            for (let coordinate = 0; coordinate < actual.length; coordinate++) maximumDifference = Math.max(maximumDifference, Math.abs(actual[coordinate] - expected[coordinate]));
            if (maximumDifference > 0.001) throw new Error(`${fighter.name}/${index} frame ${frame}: drawn pose differs by ${maximumDifference}`);
            samples++;
        }
    }
    console.log(`HEADLESS_TIMELINE_POSES_PASS ${fighter.name}: ${played.length} clips, ${samples} both-facing frame samples, max ${maximumDifference} world units versus clip pool`);
    const sha256 = hash(bytes), filename = `${fighter.name}TimelineBody-${sha256}.mdx`;
    const classicDirectory = join(output, 'imports/war3mapImported'), definitiveDirectory = join(output, 'imports/_de.w3mod/war3mapImported');
    await Bun.write(join(classicDirectory, filename), bytes);
    if (bodies.definitive !== undefined) await Bun.write(join(definitiveDirectory, filename), bodies.definitive.bytes);
    const record = readClipRecords(output).find((record: { fighter: string }) => record.fighter === fighter.name);
    if (record === undefined) throw new Error(`No original clips for ${fighter.name}`);
    const oldBytes = record.bytes;
    const replacedFiles = new Set<string>(record.clips.map((clip: { filename: string }) => clip.filename));
    record.clips = record.clips.map((clip: object) => ({ ...clip, filename, modelPath: `war3mapImported\\${filename}`, sha256, bytes: bytes.byteLength, timeline: true }));
    record.bytes = bytes.byteLength + (record.light?.bytes ?? 0);
    writeClipRecord(output, record);
    for (const replaced of replacedFiles) if (replaced !== filename) await unlink(join(classicDirectory, replaced));
    await removeOtherBodies(classicDirectory, filename);
    await removeOtherBodies(definitiveDirectory, bodies.definitive === undefined ? '' : filename);
    const metadataPath = join(CLIPS, `${fighterSlug(character)}.ts`);
    const modelPath = `war3mapImported\\${filename}`;
    let metadata = await Bun.file(metadataPath).text();
    const prefix = `modelPath: ${JSON.stringify(`war3mapImported\\${fighter.name}`).slice(0, -1)}`;
    metadata = metadata.split('\n').map(line => line.includes(`${prefix}OriginalClip`) || line.includes(`${prefix}TimelineBody`)
        ? line.replace(/modelPath: \"[^\"]+\"/, `modelPath: ${JSON.stringify(modelPath)}`).replace(/looping: (true|false)(?:, timeline: true)? \},$/, 'looping: $1, timeline: true },') : line).join('\n');
    writeGenerated(metadataPath, metadata);
    replaceModelFacts([`war3mapImported\\${fighter.name}OriginalClip`, `war3mapImported\\${fighter.name}TimelineBody`], { [`war3mapImported\\${filename}`]: modelFacts(new Uint8Array(bytes)) });
    console.log(`${fighter.name}: ${played.length}/${record.clips.length} played clips → one timeline; ${oldBytes} → ${record.bytes} raw bytes (${oldBytes - record.bytes} saved); ${bodies.definitive === undefined ? 'Classic body in both looks' : 'Definitive body under the same path in _de.w3mod'}.`);
}, catch: cause => new Error('Timeline export failed', { cause }) }));
