import { join } from 'node:path';
import { Effect } from 'effect';
import { ModelRenderer } from 'war3-model';
import { parseModelMDX as parseMDX } from '../../ts/scripts/mdxCodec';
import { assetsView, readManifest } from '../../ts/scripts/wisp/buildInputs';
import { fighters } from '../../ts/scripts/heroModelSource';
import { anatomyFindings, type PoseSample } from '../../ts/scripts/wisp/victoryAnatomy';
import { VICTORY_ANATOMY_RECORD, VICTORY_UNJOINTED, type VictoryAnatomyRecord } from '../../ts/scripts/wisp/victoryAnatomyRecord';
import { originalClipNamed } from '../../ts/src/generated/clips/fighterOriginalClipInfo';
import { victoryAnimation } from '../../ts/src/game/presentation/matchAudio';
import { SELECTABLE_CHARACTERS, fighterName } from '../../ts/src/game/roster/kits';
import { bodyPoseReader } from './victory-pose';
import { ensure } from './original-clips';

const SAMPLE_FRAMES = 3;

await Effect.runPromise(Effect.gen(function*() {
    const assets = assetsView(yield* readManifest());
    const records: VictoryAnatomyRecord[] = [];
    for (const character of SELECTABLE_CHARACTERS) {
        const fighter = fighters.get(character), name = fighterName(character), clip = victoryAnimation(character);
        if (VICTORY_UNJOINTED[name] !== undefined) continue;
        ensure(fighter !== undefined, `No fighter ${name}`);
        const sequence = originalClipNamed(character, clip);
        ensure(sequence !== undefined, `${name} has no victory clip "${clip}"`);
        const model = parseMDX(yield* Effect.promise(() => Bun.file(join(assets, fighter.source)).arrayBuffer()));
        const renderer = new ModelRenderer(model), data = Reflect.get(renderer, 'rendererData'), read = bodyPoseReader(model, renderer, name);
        const rest = read(), [start, end] = model.Sequences[sequence]!.Interval, samples: PoseSample[] = [];
        for (let frame = 0; frame * 1000 / 60 <= end! - start!; frame += SAMPLE_FRAMES) {
            renderer.setSequence(sequence); data.frame = start! + Math.round(frame * 1000 / 60); renderer.update(0);
            samples.push({ frame, pose: read() });
        }
        const findings = anatomyFindings(rest, samples);
        console.log(`VICTORY_ANATOMY ${name} "${clip}" ${samples.length} samples, ${findings.length} findings`);
        for (const finding of findings) console.log(`  frame ${finding.frame} ${['right', 'left'][finding.side]} ${finding.joint}: ${finding.rule} (${finding.value})`);
        records.push({ fighter: name, clip, rest, samples });
    }
    yield* Effect.promise(() => Bun.write(VICTORY_ANATOMY_RECORD, `${JSON.stringify(records)}\n`));
    console.log(`VICTORY_ANATOMY_RECORD ${records.length} fighters; ${VICTORY_ANATOMY_RECORD}`);
}));
