import { separation } from "./contrast";

const PAIRS = ["Shadow Hunter / Chen Stormstout", "Chen Stormstout / Shadow Hunter"] as const;
const EXTREMES = ["near", "far"] as const;

export async function headlessSeparation(args: readonly string[]): Promise<number> {
  const out = args[0] === "--out" ? args[1] ?? "" : `${process.env.XDG_STATE_HOME ?? `${process.env.HOME}/.local/state`}/smashcraft/stage-separation`;
  const stages = (args[0] === "--out" ? args.slice(2) : args).map(Number);
  const { Effect } = await import("../../ts/node_modules/effect/dist/index.js");
  const { installHeadless } = await import("../../ts/node_modules/wisp/host/headless/headless");
  const { captureScene, renderScenes } = await import("../../ts/node_modules/wisp/host/render/headlessRender");
  const { SMASHCRAFT_HEADLESS } = await import("../../ts/scripts/wisp/headless");
  const { headlessRender } = await import("../../ts/scripts/wisp/headlessRender");
  const { start, install } = await import("../../ts/src/host/entries/devMain");
  const { stageModels } = await import("../../ts/src/game/presentation/stagePreload");
  const normalize = (path: string) => path.replaceAll("\\", "/").toLowerCase();
  console.log("stage\tpair\tview\tclient\tfighter\tpixels\tfighter L* P25-P75\tbackdrop L* P25-P75\tgap");
  let worst = Infinity;
  for (const stage of stages) for (const [pairIndex, pair] of PAIRS.entries()) {
    const runtime = installHeadless(SMASHCRAFT_HEADLESS);
    const clients = runtime.clients({ start, install });
    clients.start(); clients.frames(20); clients.chat(0, "-dev items off"); clients.frames(10); clients.chat(0, `-dev quick stage ${stage} pair ${pair}`); clients.frames(15);
    for (const client of clients.clients) clients.chat(client.slot, "-dev view near");
    clients.frames(65);
    const scenes = clients.clients.map(client => captureScene(client));
    clients.frames(245);
    for (const client of clients.clients) clients.chat(client.slot, "-dev view far");
    clients.frames(55);
    scenes.push(...clients.clients.map(client => captureScene(client)));
    const errors = clients.clients.flatMap(client => client.errors);
    runtime.restore();
    if (errors.length > 0) throw new Error(`stage ${stage}: ${errors.join("\n")}`);
    const own = new Set(stageModels(stage).map(normalize));
    for (const client of [0, 1]) {
      const directory = `${out}/${stage}-pair${pairIndex}-p${client}`;
      const captures = scenes.filter(scene => scene.client === client).flatMap(scene => {
        const common = { ...scene, ui: [], textTags: [], filter: undefined };
        return [
          common,
          { ...common, frame: scene.frame + 1000, units: [], effects: scene.effects.filter(effect => own.has(normalize(effect.model))) },
          { ...common, frame: scene.frame + 2000, effects: scene.effects.filter(effect => !own.has(normalize(effect.model))), environment: { ...common.environment, skyVisible: false, fog: undefined } },
        ];
      });
      await Effect.runPromise(renderScenes({ ...headlessRender(), width: 1280, height: client === 0 ? 720 : 540 }, captures, directory, "classic", ["day-night-light", "fog", "height-fog-falloff", "sky", "shadows", "point-lights", "pbr", "point-light-shadows", "ambient-occlusion", "bloom"] as const));
      for (const [index, scene] of scenes.filter(entry => entry.client === client).entries()) {
        const frame = (offset: number) => `${directory}/p${client}-frame-${scene.frame + offset}.png`;
        for (const row of await separation(frame(2000), frame(0), frame(1000))) {
          worst = Math.min(worst, row.gap);
          console.log(`${stage}\t${pair}\t${EXTREMES[index]}\t${client}\t${row.fighter}\t${row.pixels}\t${row.fighterBand.map(v => v.toFixed(1)).join("-")}\t${row.backdropBand.map(v => v.toFixed(1)).join("-")}\t${row.gap.toFixed(1)}`);
        }
      }
    }
  }
  console.log(`${worst >= 0 ? "PASS" : "FAIL"}: worst fighter band gap ${worst.toFixed(1)} L* (limit 0)`);
  return worst >= 0 ? 0 : 1;
}

if (import.meta.main) process.exit(await headlessSeparation(Bun.argv.slice(2)));
