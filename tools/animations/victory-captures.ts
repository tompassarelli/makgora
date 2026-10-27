import { join, relative, resolve } from 'node:path';
import { Effect } from 'effect';
import { captureScene, renderScenes, type RenderScene } from '../../ts/node_modules/wisp/host/render/headlessRender';
import { headlessRender } from '../../ts/scripts/wisp/headlessRender';
import { assetsView, readManifest } from '../../ts/scripts/wisp/buildInputs';
import { createResultSession } from '../../ts/scripts/wisp/resultSession';
import { originalClip, originalClipNamed } from '../../ts/src/generated/clips/fighterOriginalClipInfo';
import { victoryAnimation } from '../../ts/src/game/presentation/matchAudio';
import { SELECTABLE_CHARACTERS, fighterName } from '../../ts/src/game/roster/kits';
import { ensure } from './original-clips';

const VIEWS = ['classic', 'classic-poses'] as const;
const FLAGS = ['--against', '--views'];
const [outputArg, ...names] = process.argv.slice(2);
ensure(outputArg, 'usage: bun tools/animations/victory-captures.ts PRIVATE_OUTPUT [FIGHTER_NAME...] [--against LOSER_NAME...] [--views classic|classic-poses...]');
const flagged = (flag: string) => names.filter((name, at) => !FLAGS.includes(name) && names.slice(0, at).reverse().find(earlier => FLAGS.includes(earlier)) === flag);
const only = names.filter((name, at) => !FLAGS.includes(name) && !names.slice(0, at).some(earlier => FLAGS.includes(earlier)));
const views = flagged('--views').map(view => {
    ensure((VIEWS as readonly string[]).includes(view), `No view named ${view}; views are ${VIEWS.join(', ')}`);
    return view as typeof VIEWS[number];
});
const against = flagged('--against').map(name => {
    const loser = SELECTABLE_CHARACTERS.find(character => fighterName(character) === name);
    ensure(loser !== undefined, `No fighter named ${name}`);
    return loser;
});
const output = resolve(outputArg);
ensure(relative(resolve(import.meta.dir, '../..'), output).startsWith('..'), 'Captures stay private');
const STRIP_FRAMES = 6;

await Effect.runPromise(Effect.gen(function*() {
    const assets = assetsView(yield* readManifest());
    const scenes: RenderScene[] = [];
    for (const [index, winner] of SELECTABLE_CHARACTERS.entries()) {
        if (only.length > 0 && !only.includes(fighterName(winner))) continue;
        const name = fighterName(winner);
        const clipIndex = originalClipNamed(winner, victoryAnimation(winner));
        const clip = clipIndex === undefined ? undefined : originalClip(winner, clipIndex);
        ensure(clip !== undefined, `${name} has no victory clip`);
        const losers = against.length > 0 ? against.filter(loser => loser !== winner) : [SELECTABLE_CHARACTERS[(index + 1) % SELECTABLE_CHARACTERS.length]!];
        for (const loser of losers) {
            const session = yield* Effect.tryPromise({ try: () => createResultSession(winner, loser), catch: cause => new Error(`${name}: result session failed`, { cause }) });
            try {
                const duration = Math.round((clip.endSeconds - clip.startSeconds) * 60);
                for (let step = 0; step < STRIP_FRAMES; step++) {
                    const sample = Math.floor(step * duration / STRIP_FRAMES);
                    while (session.resultFrame() < sample) session.step();
                    const scene = captureScene(session.client, { visibleOnly: true });
                    const body = scene.effects.find(pose => pose.destroyed === undefined && pose.model === clip.modelPath);
                    ensure(body !== undefined, `${name}/${sample}: winner body not drawn`);
                    const into = body.animationElapsed - (clip.timeline === true ? clip.startSeconds : 0);
                    const shown = session.resultFrame();
                    if (step === 0) ensure(Math.abs(into - shown / 60) < 1e-4, `${name}: victory is ${into}s into its clip on result frame ${shown}`);
                    console.log(`VICTORY_POSE ${name} beats ${fighterName(loser)} result frame ${shown}: "${victoryAnimation(winner)}" ${into.toFixed(3)}s of ${(duration / 60).toFixed(3)}s`);
                    scenes.push({ ...scene, frame: (index * 100 + loser) * 1000 + sample });
                }
            } finally { session.close(); }
        }
    }
    const project = headlessRender({ assets });
    const poses = scenes.map(scene => ({ ...scene, ui: [], textTags: [], effects: scene.effects.filter(effect => !effect.model.includes('LevelupCaster')) }));
    for (const [directory, drawn] of [['classic', scenes], ['classic-poses', poses]] as const) {
        if (views.length > 0 && !views.includes(directory)) continue;
        const images = yield* renderScenes(project, drawn, join(output, directory), 'classic');
        for (const image of images) ensure(image.notDrawn.length === 0, `${directory}/${image.frame}: ${image.notDrawn.join('; ')}`);
        console.log(`VICTORY_STRIPS_PASS ${directory}: ${scenes.length / STRIP_FRAMES} strips, ${images.length} frames; ${output}`);
    }
}));
